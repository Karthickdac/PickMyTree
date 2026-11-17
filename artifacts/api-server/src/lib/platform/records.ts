import { and, eq, sql } from "drizzle-orm";
import { db, workflowRecords, auditEvents, platformUsers, type WorkflowRecord } from "@workspace/db";
import { type Actor, can, isAdmin, PlatformError, requireMfa } from "./access";
import { type ModuleDefinition } from "./modules";

export function validateData(m: ModuleDefinition, raw: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const keys = new Set(m.fields.map(f => f.key));
  for (const key of Object.keys(raw)) if (!keys.has(key)) throw new PlatformError(400, `Unknown field: ${key}`);
  for (const field of m.fields) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === "") {
      if (field.required) throw new PlatformError(400, `${field.label} is required.`);
      continue;
    }
    if (field.type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new PlatformError(400, `${field.label} must be a finite number.`);
      if (!["latitude", "longitude"].includes(field.key) && value < 0) throw new PlatformError(400, `${field.label} cannot be negative.`);
      if (["version", "feePaise", "durationMonths", "pricePaise", "budgetPaise", "quantity", "readingMinutes"].includes(field.key) && !Number.isSafeInteger(value)) throw new PlatformError(400, `${field.label} must be a whole safe integer.`);
      if (field.key === "latitude" && Math.abs(value) > 90 || field.key === "longitude" && Math.abs(value) > 180) throw new PlatformError(400, "Invalid coordinates.");
    } else if (field.type === "boolean") {
      if (typeof value !== "boolean") throw new PlatformError(400, `${field.label} must be true or false.`);
    } else {
      if (typeof value !== "string" || value.length > 20000) throw new PlatformError(400, `${field.label} is invalid or too long.`);
      if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value)) throw new PlatformError(400, `${field.label} needs a valid calendar date.`);
      if (field.type === "select" && !field.options?.includes(value)) throw new PlatformError(400, `${field.label} is not an allowed choice.`);
      if (["farmId", "treeId", "assigneeId", "assessmentId", "productId"].includes(field.key) && !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) throw new PlatformError(400, `${field.label} needs a valid record ID.`);
    }
    data[field.key] = value;
  }
  if (m.key === "schemes" && (Number(data.version) < 1 || Number(data.durationMonths) < 1)) throw new PlatformError(400, "Scheme version and duration must be positive.");
  if (m.key === "harvest" && Number(data.rejectedQuantity) + Number(data.retainedQuantity) > Number(data.grossQuantity)) throw new PlatformError(400, "Rejected and retained quantities exceed the measured gross quantity.");
  if (m.key === "batches" && String(data.expiresAt) < String(data.purchasedAt)) throw new PlatformError(400, "Batch expiry cannot precede purchase.");
  return data;
}

export function allowedTransitions(a: Actor, m: ModuleDefinition, r: WorkflowRecord): string[] {
  const next = m.transitions[r.status] ?? [];
  const customerCase = ["tickets", "privacy-requests"].includes(m.key);
  const staff = a.grants.some(g => g.role !== "customer" && m.roles.includes(g.role) && (g.scope === "*" || g.scope === r.farmId));
  if (customerCase && !staff) {
    return m.key === "tickets" && r.customerId === a.id ? next.filter(s => s === "reopened") : [];
  }
  if (m.key === "tasks" && r.assigneeId === a.id && !can(a, m.reviewRoles ?? [], r.farmId)) {
    return next.filter(s => ["accepted", "in-progress", "evidence-submitted", "blocked", "delayed-by-weather"].includes(s));
  }
  if (!staff) return [];
  return next.filter(s => {
    if (["approved", "available", "published", "reviewed", "completed", "resolved", "retention-required"].includes(s)) {
      return can(a, m.reviewRoles ?? [], r.farmId) && (r.createdBy !== a.id || ["tickets", "privacy-requests", "articles", "farms"].includes(m.key));
    }
    return true;
  });
}
export function presentRecord(a: Actor, m: ModuleDefinition, r: WorkflowRecord) {
  let data = r.data;
  if (m.key === "tickets" && !can(a, ["support", "administrator", "super-administrator"])) data = { ...data };
  return { ...r, createdAt: r.createdAt.toISOString(), updatedAt: undefined, createdBy: undefined, assigneeId: undefined,
    data, allowedTransitions: allowedTransitions(a, m, r) };
}

export async function ensureReferences(a: Actor, m: ModuleDefinition, data: Record<string, unknown>, topFarm?: string | null, topTree?: string | null) {
  const farmId = typeof data.farmId === "string" ? data.farmId : topFarm || null;
  const treeId = typeof data.treeId === "string" ? data.treeId : topTree || null;
  if (topFarm && data.farmId && topFarm !== data.farmId || topTree && data.treeId && topTree !== data.treeId) throw new PlatformError(400, "Conflicting record references.");
  if (m.fields.some(f => f.key === "farmId" && f.required) && !farmId) throw new PlatformError(400, "A farm is required.");
  if (farmId) {
    const [farm] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, farmId), eq(workflowRecords.module, "farms")));
    if (!farm) throw new PlatformError(400, "Farm record does not exist.");
    if (!can(a, m.createRoles, farmId)) throw new PlatformError(403, "You cannot change records for this farm.");
  } else if (!isAdmin(a) && !can(a, m.createRoles)) {
    throw new PlatformError(403, "A valid farm scope is required.");
  }
  if (treeId) {
    const [tree] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, treeId), eq(workflowRecords.module, "trees")));
    if (!tree || tree.farmId !== farmId) throw new PlatformError(400, "Tree must belong to the selected farm.");
    if (a.grants.some(g => g.role === "farm-worker") && !isAdmin(a) && !can(a, ["farm-manager"], farmId)) {
      const assigned = await db.select({ id: workflowRecords.id }).from(workflowRecords).where(and(
        eq(workflowRecords.module, "tasks"), eq(workflowRecords.treeId, treeId), eq(workflowRecords.assigneeId, a.id),
        sql`${workflowRecords.status} NOT IN ('completed', 'cancelled')`,
      )).limit(1);
      if (!assigned.length) throw new PlatformError(403, "Tree evidence is restricted to your assigned active work.");
    }
  }
  let assigneeId: string | null = null;
  if (typeof data.assigneeId === "string") {
    const [person] = await db.select({ id: platformUsers.id }).from(platformUsers).where(eq(platformUsers.id, data.assigneeId));
    if (!person) throw new PlatformError(400, "Assigned worker does not exist.");
    assigneeId = person.id;
  }
  return { farmId, treeId, assigneeId };
}
export async function transitionGuard(m: ModuleDefinition, r: WorkflowRecord, target: string, data: Record<string, unknown>) {
  if (m.key === "farms" && target === "approved") {
    if (data.authorityReviewed !== true || String(data.agreementExpires) <= new Date().toISOString().slice(0, 10)) throw new PlatformError(409, "Reviewed, unexpired farm authority is required.");
  }
  if (m.key === "trees" && ["approved", "available"].includes(target)) {
    // Fail closed: draft evidence references are not genuine verified files.
    throw new PlatformError(409, "Tree activation is locked until registration files, physical inspection and approved media verification are connected. Drafts can be recorded but cannot be offered for adoption.");
  }
  if (["schemes", "harvest", "recommendations"].includes(m.key) && target === "approved") {
    throw new PlatformError(409, "Approval is gated until the dedicated versioned commercial, harvest or expert-consent ledger is implemented and verified.");
  }
  if (m.key === "updates" && target === "approved") throw new PlatformError(409, "Publishing field evidence requires verified private media provenance; this capability is not enabled yet.");
  if (m.key === "tasks") {
    if (target === "assigned" && !data.assigneeId) throw new PlatformError(409, "Assign a worker before assigning the task.");
    if (["evidence-submitted", "reviewed", "completed"].includes(target)) throw new PlatformError(409, "Evidence submission and completion require the verified upload and review workflow, which is not enabled yet.");
  }
}
export async function audit(actorId: string, action: string, module: string, recordId: string, reason: string, before: unknown, after: unknown) {
  await db.insert(auditEvents).values({ actorId, action, module, recordId, reason,
    before: before as Record<string, unknown>, after: after as Record<string, unknown> });
}
export const recordStateIsEditable = (m: ModuleDefinition, r: WorkflowRecord) =>
  [m.initial, "draft", "rejected", "planned"].includes(r.status) || (m.key === "tasks" && !["completed", "cancelled"].includes(r.status)) || (m.key === "tickets" && !["closed"].includes(r.status));

export function staffMutation(a: Actor, m: ModuleDefinition): void {
  if (!["tickets", "privacy-requests"].includes(m.key)) requireMfa(a);
}
