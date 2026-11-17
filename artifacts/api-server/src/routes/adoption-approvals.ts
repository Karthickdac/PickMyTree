import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, workflowRecords, adoptionApprovals, auditEvents } from "@workspace/db";
import { GetAdoptionReadinessResponse, RecordAdoptionApprovalBody, RecordAdoptionApprovalResponse } from "@workspace/api-zod";
import { actor, identify, requireMfa, PlatformError, type Actor } from "../lib/platform/access";
import { requireSchemeAdmin } from "../lib/platform/schemes";
import { calendarDate, businessDay, contentBlockers, currentApproval } from "../lib/platform/adoption-eligibility";
import { paymentAvailability } from "../lib/platform/razorpay";

const router: IRouter = Router();
router.use(["/v1/management/adoption-readiness", "/v1/management/adoption-approvals"], identify, (req, res, next) => {
  requireSchemeAdmin(actor(req)); res.setHeader("Cache-Control", "no-store"); next();
});
async function readiness(a: Actor) {
  const records = await db.select().from(workflowRecords).where(inArray(workflowRecords.module, ["farms", "trees", "schemes"])).orderBy(desc(workflowRecords.createdAt));
  const items = await Promise.all(records.map(async r => ({
    id: r.id, kind: r.module, name: r.title, version: r.version,
    approved: Boolean(await currentApproval(r)), blockers: await contentBlockers(r),
  })));
  return { recentMfa: a.recentMfa, payment: paymentAvailability(), items };
}
router.get("/v1/management/adoption-readiness", async (req, res): Promise<void> => {
  res.json(GetAdoptionReadinessResponse.parse(await readiness(actor(req))));
});
router.post("/v1/management/adoption-approvals", async (req, res): Promise<void> => {
  const a = actor(req), input = RecordAdoptionApprovalBody.parse(req.body);
  requireMfa(a);
  if (!input.attested || input.reason.trim().length < 20) throw new PlatformError(400, "Confirm the actual review and provide a detailed reason.");
  await db.transaction(async tx => {
    // A shared catalogue lock gives review/expiry/reservation changes one order,
    // avoiding cross-record approval races while still locking the target row.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(73421891)`);
    const [r] = await tx.select().from(workflowRecords).where(eq(workflowRecords.id, input.recordId)).for("update");
    if (!r || !["farms", "trees", "schemes"].includes(r.module)) throw new PlatformError(404, "Review target not found.");
    if (r.version !== input.version) throw new PlatformError(409, "The record changed. Reload its current details before reviewing.");
    const previous = await currentApproval(r, tx);
    if (input.decision === "approve") {
      if (previous) throw new PlatformError(409, "This exact revision is already approved.");
      const blockers = await contentBlockers(r, tx);
      if (blockers.length) throw new PlatformError(409, blockers.join(" "));
      if (!input.evidenceReference?.trim()) throw new PlatformError(400, "Record the reference of the actual document or evidence reviewed. Do not upload private authority documents as public photos.");
      const [lastEdit] = await tx.select().from(auditEvents).where(and(eq(auditEvents.recordId, r.id), inArray(auditEvents.action, ["catalogue-created", "catalogue-updated", "scheme-draft-created", "scheme-draft-revised"]))).orderBy(desc(auditEvents.createdAt)).limit(1);
      const ownEdit = (lastEdit?.actorId ?? r.createdBy) === a.id;
      if (ownEdit && !(a.grants.some(g => g.role === "super-administrator" && g.scope === "*") && (input.ownerOverrideReason?.trim().length ?? 0) >= 20)) {
        throw new PlatformError(403, "An independent reviewer is required. A verified Super Admin may record an explicit, reasoned owner-review override.");
      }
      if (r.module !== "schemes" && (!calendarDate(input.validUntil) || input.validUntil! <= businessDay())) throw new PlatformError(400, "Set a future authority or inspection review expiry.");
      if (r.module === "trees" && (!calendarDate(input.inspectedOn) || input.inspectedOn! > businessDay() || !input.qualification?.trim())) throw new PlatformError(400, "Record the actual inspection date and inspector qualification.");
      if (input.validUntil && !calendarDate(input.validUntil)) throw new PlatformError(400, "Use a real calendar date for review expiry.");
    } else if (!previous) throw new PlatformError(409, "There is no current approval to revoke.");
    const snapshot = { name: r.title, configuration: r.data.configuration, data: r.data,
      recordVersion: r.version, inspectedOn: input.inspectedOn, qualification: input.qualification,
      ownerOverrideReason: input.ownerOverrideReason, attested: true };
    const [approval] = await tx.insert(adoptionApprovals).values({
      recordId: r.id, sourceVersion: r.version, kind: r.module, decision: input.decision,
      reviewerId: a.id, reason: input.reason.trim(), evidenceReference: input.evidenceReference?.trim() ?? "",
      validUntil: input.validUntil ?? null, snapshot,
    }).returning();
    if (r.module === "schemes") await tx.update(workflowRecords).set({ status: input.decision === "approve" ? "approved" : "draft", updatedAt: new Date() }).where(eq(workflowRecords.id, r.id));
    await tx.insert(auditEvents).values({ actorId: a.id, module: r.module, recordId: r.id, action: `adoption-${input.decision}`, reason: input.reason.trim(), after: { approvalId: approval!.id, sourceVersion: r.version, evidenceReference: input.evidenceReference, ownerOverrideReason: input.ownerOverrideReason } });
  });
  res.json(RecordAdoptionApprovalResponse.parse(await readiness(a)));
});
export default router;
