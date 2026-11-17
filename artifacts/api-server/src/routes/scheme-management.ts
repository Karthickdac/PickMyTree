import { Router, type IRouter } from "express";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { db, workflowRecords, auditEvents } from "@workspace/db";
import {
  CreateManagedSchemeBody, CreateManagedSchemeResponse, UpdateManagedSchemeBody,
  UpdateManagedSchemeParams, UpdateManagedSchemeResponse, GetManagedSchemeParams,
  GetManagedSchemeResponse, ListManagedSchemesResponse, ListSchemeRevisionsParams,
  ListSchemeRevisionsResponse,
} from "@workspace/api-zod";
import { actor, identify, PlatformError } from "../lib/platform/access";
import { requireSchemeAdmin, schemeDTO, schemeSnapshot, validateSchemeConfiguration, validateSchemeReferences } from "../lib/platform/schemes";

const router: IRouter = Router();
router.use("/v1/management/schemes", identify, (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  requireSchemeAdmin(actor(req));
  next();
});

async function findScheme(id: string) {
  const [row] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, id), eq(workflowRecords.module, "schemes")));
  if (!row) throw new PlatformError(404, "Scheme not found.");
  return row;
}

router.get("/v1/management/schemes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(workflowRecords).where(eq(workflowRecords.module, "schemes")).orderBy(desc(workflowRecords.updatedAt));
  res.json(ListManagedSchemesResponse.parse(rows.map(schemeDTO)));
});

router.post("/v1/management/schemes", async (req, res): Promise<void> => {
  const a = actor(req), input = CreateManagedSchemeBody.parse(req.body);
  const name = input.name.trim();
  if (name.length < 2) throw new PlatformError(400, "Enter a scheme name of at least two characters.");
  validateSchemeConfiguration(input.configuration);
  await validateSchemeReferences(input.configuration);
  const row = await db.transaction(async tx => {
    const [created] = await tx.insert(workflowRecords).values({
      module: "schemes", title: name, status: "draft", farmId: input.configuration.farmId,
      createdBy: a.id, data: { configuration: input.configuration },
    }).returning();
    await tx.insert(auditEvents).values({
      actorId: a.id, module: "schemes", recordId: created!.id,
      action: "scheme-draft-created", reason: "Created a scheme configuration draft",
      after: schemeSnapshot(created!),
    });
    return created!;
  });
  res.status(201).json(CreateManagedSchemeResponse.parse(schemeDTO(row)));
});

router.get("/v1/management/schemes/:schemeId", async (req, res): Promise<void> => {
  const { schemeId } = GetManagedSchemeParams.parse(req.params);
  res.json(GetManagedSchemeResponse.parse(schemeDTO(await findScheme(schemeId))));
});

router.patch("/v1/management/schemes/:schemeId", async (req, res): Promise<void> => {
  const { schemeId } = UpdateManagedSchemeParams.parse(req.params), input = UpdateManagedSchemeBody.parse(req.body);
  const a = actor(req), name = input.name.trim(), reason = input.reason.trim();
  if (name.length < 2 || reason.length < 3) throw new PlatformError(400, "Enter a scheme name and a short reason for the change.");
  validateSchemeConfiguration(input.configuration);
  await validateSchemeReferences(input.configuration, input.status === "archived");
  const changed = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(73421891)`);
    const [before] = await tx.select().from(workflowRecords).where(and(eq(workflowRecords.id, schemeId), eq(workflowRecords.module, "schemes"))).for("update");
    if (!before) throw new PlatformError(404, "Scheme not found.");
    schemeDTO(before);
    if (before.status === "approved" && input.status !== "archived") throw new PlatformError(409, "Approved terms are immutable. Copy this scheme to create a new draft, or revoke its approval before editing.");
    if (before.version !== input.version) throw new PlatformError(409, "This scheme changed in another session. Reload before saving; your changes have not been written.");
    if (before.status === "archived" && input.status === "archived") {
      throw new PlatformError(409, "Restore this scheme before editing it.");
    }
    if (before.status === "archived" || input.status === "archived") {
      if (name !== before.title || JSON.stringify(input.configuration) !== JSON.stringify(schemeDTO(before).configuration)) {
        throw new PlatformError(400, "Archive or restore only the saved scheme. Save other changes separately.");
      }
    }
    const [after] = await tx.update(workflowRecords).set({
      title: name, farmId: input.configuration.farmId, status: input.status,
      data: { ...before.data, configuration: input.configuration },
      version: before.version + 1, updatedAt: new Date(),
    }).where(and(eq(workflowRecords.id, before.id), eq(workflowRecords.version, input.version))).returning();
    if (!after) throw new PlatformError(409, "This scheme changed. Reload before saving.");
    await tx.insert(auditEvents).values({
      actorId: a.id, module: "schemes", recordId: after.id, action: "scheme-draft-revised", reason,
      before: schemeSnapshot(before), after: schemeSnapshot(after),
    });
    return after;
  });
  res.json(UpdateManagedSchemeResponse.parse(schemeDTO(changed)));
});

router.get("/v1/management/schemes/:schemeId/revisions", async (req, res): Promise<void> => {
  const { schemeId } = ListSchemeRevisionsParams.parse(req.params);
  await findScheme(schemeId);
  const events = await db.select().from(auditEvents).where(and(
    eq(auditEvents.module, "schemes"), eq(auditEvents.recordId, schemeId),
    inArray(auditEvents.action, ["scheme-draft-created", "scheme-draft-revised"]),
  )).orderBy(desc(auditEvents.createdAt));
  res.json(ListSchemeRevisionsResponse.parse(events.map(event => ({
    ...event.after, recordedAt: event.createdAt.toISOString(), reason: event.reason,
  }))));
});

export default router;
