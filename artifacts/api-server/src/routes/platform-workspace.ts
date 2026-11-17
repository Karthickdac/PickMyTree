import { Router, type IRouter } from "express";
import { and, eq, ilike, desc, count, sql } from "drizzle-orm";
import { db, workflowRecords, auditEvents } from "@workspace/db";
import {
  ListWorkspaceModulesResponse, ListRecordsParams, ListRecordsQueryParams, ListRecordsResponse,
  CreateRecordBody, CreateRecordResponse, UpdateRecordParams, UpdateRecordBody, UpdateRecordResponse, GetWorkspaceSummaryResponse,
} from "@workspace/api-zod";
import { identify, actor, can, isAdmin, visibleScope, PlatformError, requireMfa } from "../lib/platform/access";
import { modules, moduleByKey } from "../lib/platform/modules";
import { validateData, presentRecord, ensureReferences, allowedTransitions, transitionGuard, recordStateIsEditable, staffMutation } from "../lib/platform/records";
const router: IRouter = Router();
router.use("/v1/workspace", identify);

router.get("/v1/workspace/modules", (req, res) => {
  const a = actor(req);
  res.json(ListWorkspaceModulesResponse.parse(modules.filter(m => a.grants.some(g => m.roles.includes(g.role))).map(m => ({
    key: m.key, title: m.title, description: m.description,
    canCreate: a.grants.some(g => m.createRoles.includes(g.role)), fields: m.fields, statuses: Object.keys(m.transitions),
  }))));
});
router.get("/v1/workspace/summary", async (req, res): Promise<void> => {
  const a = actor(req), accessible = modules.filter(m => a.grants.some(g => m.roles.includes(g.role)));
  const counts = await Promise.all(accessible.map(async m => {
    const [row] = await db.select({ n: count() }).from(workflowRecords).where(and(eq(workflowRecords.module, m.key), visibleScope(a, m)));
    return { label: m.title, value: row?.n || 0 };
  }));
  const recent = (await Promise.all(accessible.map(async m => {
    const rows = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, m.key), visibleScope(a, m))).orderBy(desc(workflowRecords.createdAt)).limit(3);
    return rows.map(r => presentRecord(a, m, r));
  }))).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  res.json(GetWorkspaceSummaryResponse.parse({ counts, recent }));
});
router.get("/v1/workspace/:module/records", async (req, res): Promise<void> => {
  const { module } = ListRecordsParams.parse(req.params), query = ListRecordsQueryParams.parse(req.query);
  const a = actor(req), m = moduleByKey(module);
  if (!m || !a.grants.some(g => m.roles.includes(g.role))) throw new PlatformError(403, "You do not have access to this area.");
  const page = query.page ?? 1, pageSize = 25;
  const where = and(eq(workflowRecords.module, m.key), visibleScope(a, m),
    query.search ? ilike(workflowRecords.title, `%${query.search.slice(0, 200)}%`) : undefined,
    query.status ? eq(workflowRecords.status, query.status) : undefined);
  const [rows, total] = await Promise.all([
    db.select().from(workflowRecords).where(where).orderBy(desc(workflowRecords.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    db.select({ n: count() }).from(workflowRecords).where(where),
  ]);
  res.json(ListRecordsResponse.parse({ items: rows.map(r => presentRecord(a, m, r)), total: total[0]?.n || 0, page, pageSize }));
});
router.post("/v1/workspace/:module/records", async (req, res): Promise<void> => {
  const { module } = ListRecordsParams.parse(req.params), body = CreateRecordBody.parse(req.body);
  const a = actor(req), m = moduleByKey(module);
  if (!m || !a.grants.some(g => m.createRoles.includes(g.role))) throw new PlatformError(403, "You cannot create records in this area.");
  staffMutation(a, m);
  const data = validateData(m, body.data);
  if (m.key === "tickets" && data.resolution !== undefined) throw new PlatformError(400, "Resolution is reserved for the support workflow.");
  const refs = await ensureReferences(a, m, data, body.farmId, body.treeId);
  const row = await db.transaction(async tx => {
    const [r] = await tx.insert(workflowRecords).values({ module: m.key, title: body.title, data, ...refs, status: m.initial,
      customerId: ["tickets", "privacy-requests"].includes(m.key) ? a.id : null, createdBy: a.id }).returning();
    await tx.insert(auditEvents).values({ actorId: a.id, action: "created", module: m.key, recordId: r!.id, reason: "Created a workflow draft", after: { version: 1, status: r!.status } });
    return r!;
  });
  res.status(201).json(CreateRecordResponse.parse(presentRecord(a, m, row)));
});
router.patch("/v1/workspace/:module/records/:id", async (req, res): Promise<void> => {
  const { module, id } = UpdateRecordParams.parse(req.params), body = UpdateRecordBody.parse(req.body);
  const a = actor(req), m = moduleByKey(module);
  if (!m || !a.grants.some(g => m.roles.includes(g.role))) throw new PlatformError(403, "You cannot access this area.");
  const changed = await db.transaction(async tx => {
    const [before] = await tx.select().from(workflowRecords).where(and(eq(workflowRecords.id, id), eq(workflowRecords.module, m.key), visibleScope(a, m))).for("update");
    if (!before) throw new PlatformError(404, "Record not found.");
    if (before.version !== body.version) throw new PlatformError(409, "This record changed. Reload before saving.");
    const isCustomerOnly = !a.grants.some(g => g.role !== "customer" && m.roles.includes(g.role) && (g.scope === "*" || g.scope === before.farmId));
    if (isCustomerOnly && (body.title !== undefined || body.data !== undefined || body.status !== "reopened" || m.key !== "tickets")) throw new PlatformError(403, "You may reopen your own resolved support case; staff approval is required for other changes.");
    if (!isCustomerOnly) requireMfa(a);
    if (body.status && !allowedTransitions(a, m, before).includes(body.status)) throw new PlatformError(403, "This transition is not permitted for your role or requires independent review.");
    if ((body.data || body.title) && !recordStateIsEditable(m, before)) throw new PlatformError(409, "Submitted or approved records cannot be silently rewritten. Create a corrected draft.");
    const data = body.data ? validateData(m, { ...before.data, ...body.data }) : before.data;
    // A farm or tree cannot be reassigned through a generic edit.
    if (data.farmId !== before.data.farmId || data.treeId !== before.data.treeId || data.treeCode !== before.data.treeCode) throw new PlatformError(409, "Identity and farm assignment are permanent. A separately approved reassignment is required.");
    if (body.status) await transitionGuard(m, before, body.status, data);
    const [after] = await tx.update(workflowRecords).set({ data, title: body.title ?? before.title, status: body.status ?? before.status, version: before.version + 1, updatedAt: new Date() })
      .where(and(eq(workflowRecords.id, before.id), eq(workflowRecords.version, before.version))).returning();
    if (!after) throw new PlatformError(409, "Record changed; reload and retry.");
    await tx.insert(auditEvents).values({ actorId: a.id, action: body.status ? "transitioned" : "draft-updated", module: m.key, recordId: before.id, reason: body.reason,
      before: { title: before.title, status: before.status, version: before.version, data: before.data },
      after: { title: after.title, status: after.status, version: after.version, data: after.data } });
    return after;
  });
  res.json(UpdateRecordResponse.parse(presentRecord(a, m, changed)));
});
export default router;
