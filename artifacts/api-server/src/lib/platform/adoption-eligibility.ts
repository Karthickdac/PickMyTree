import { and, desc, eq, inArray } from "drizzle-orm";
import { db, workflowRecords, adoptionApprovals, adoptionOrders, catalogueImages, type WorkflowRecord, type AdoptionApproval } from "@workspace/db";
import { CreateManagedSchemeBody } from "@workspace/api-zod";
import { validateSchemeConfiguration } from "./schemes";

export type Reader = Pick<typeof db, "select">;
export const businessDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function calendarDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export async function currentApproval(record: WorkflowRecord, reader: Reader = db) {
  const [review] = await reader.select().from(adoptionApprovals).where(eq(adoptionApprovals.recordId, record.id)).orderBy(desc(adoptionApprovals.reviewSequence)).limit(1);
  return review?.decision === "approve" && review.sourceVersion === record.version &&
    (!review.validUntil || review.validUntil >= businessDay()) ? review : undefined;
}
export async function contentBlockers(record: WorkflowRecord, reader: Reader = db): Promise<string[]> {
  const blockers: string[] = [];
  if (["archived", "retired", "temporarily-unavailable"].includes(record.status)) blockers.push("This record is not available for adoption.");
  if (record.module === "schemes") {
    const parsed = CreateManagedSchemeBody.safeParse({ name: record.title, configuration: record.data.configuration });
    if (!parsed.success) return [...blockers, "The scheme configuration needs correction."];
    const c = parsed.data.configuration;
    try { validateSchemeConfiguration(c); } catch { blockers.push("Correct the harvest allocation, dates or fulfilment choices."); }
    if (c.feePaise < 100) blockers.push("Set an adoption fee of at least ₹1.");
    if (!c.farmId || !c.treeIds.length) blockers.push("Assign a farm and at least one tree.");
    const required = ["description", "risks", "shortfallPolicy", "cancellationPolicy", "terms", "agreementVersion", "legalReviewReference", "qualityGrades", "lossRules", "inclusions", "exclusions", "fulfilmentPolicy", "renewalPolicy"] as const;
    const labels: Record<string, string> = { shortfallPolicy: "harvest-shortfall remedy", cancellationPolicy: "refund and cancellation policy", agreementVersion: "agreement version", legalReviewReference: "legal review reference", qualityGrades: "quality grades", lossRules: "crop-loss and deduction policy", fulfilmentPolicy: "fulfilment and settlement policy", renewalPolicy: "renewal policy" };
    for (const field of required) if (!c[field].trim()) blockers.push(`Complete ${labels[field] ?? field}.`);
    if (c.fulfilmentMethods.includes("delivery") && !c.deliveryRegions.trim()) blockers.push("Specify delivery regions.");
    if (c.farmId) {
      const [farm] = await reader.select().from(workflowRecords).where(and(eq(workflowRecords.id, c.farmId), eq(workflowRecords.module, "farms")));
      if (!farm || !(await currentApproval(farm, reader))) blockers.push("Verify the assigned farm first.");
      const trees = c.treeIds.length ? await reader.select().from(workflowRecords).where(and(eq(workflowRecords.module, "trees"), inArray(workflowRecords.id, c.treeIds))) : [];
      if (trees.length !== c.treeIds.length || trees.some(t => t.farmId !== c.farmId || t.data.species !== c.species || (c.variety.trim() && String(t.data.variety).trim().toLowerCase() !== c.variety.trim().toLowerCase()))) blockers.push("Correct the tree, farm, species or variety assignments.");
      if ((await Promise.all(trees.map(t => currentApproval(t, reader)))).some(a => !a)) blockers.push("Verify each assigned tree first.");
    }
    return blockers;
  }
  const imageIds = Array.isArray(record.data.imageIds) ? record.data.imageIds.filter((id): id is string => typeof id === "string") : [];
  const images = imageIds.length ? await reader.select().from(catalogueImages).where(and(inArray(catalogueImages.id, imageIds), eq(catalogueImages.status, "ready"))) : [];
  if (images.length !== imageIds.length || images.some(i => i.isIllustrative) || images.length < (record.module === "trees" ? 2 : 1)) {
    blockers.push(record.module === "trees" ? "Upload at least two actual tree photos and remove species imagery." : "Upload an actual farm photo and remove orchard imagery.");
  }
  if (record.module === "trees") {
    const [farm] = record.farmId ? await reader.select().from(workflowRecords).where(and(eq(workflowRecords.id, record.farmId), eq(workflowRecords.module, "farms"))) : [];
    if (!farm || !(await currentApproval(farm, reader))) blockers.push("Verify the parent farm first.");
    if (!record.data.treeCode || !record.data.species || !record.data.variety) blockers.push("Complete the permanent tree identity, species and variety.");
  }
  return blockers;
}
export function offerFromApproval(approval: AdoptionApproval) {
  const input = CreateManagedSchemeBody.parse({ name: approval.snapshot.name, configuration: approval.snapshot.configuration });
  const c = input.configuration;
  const benefit = c.allocationType === "fixed-quantity" ? `${c.quantity} ${c.unit} across ${c.durationMonths} months` :
    c.allocationType === "exclusive-harvest" ? "Full harvest of the assigned tree" : `${c.sharePercent}% of eligible harvest${c.allocationType === "sale-proceeds" ? " sale proceeds" : ""}`;
  return { id: approval.id, schemeId: approval.recordId, name: input.name, version: approval.sourceVersion,
    feePaise: c.feePaise, taxBps: c.taxBps, deliveryFeePaise: c.deliveryFeePaise, durationMonths: c.durationMonths,
    benefit, fulfilmentMethods: c.fulfilmentMethods, deliveryRegions: c.deliveryRegions,
    fulfilmentPolicy: c.fulfilmentPolicy, risks: c.risks, shortfallPolicy: c.shortfallPolicy,
    cancellationPolicy: c.cancellationPolicy, terms: c.terms, agreementVersion: c.agreementVersion, inclusions: c.inclusions, exclusions: c.exclusions };
}
export async function treeOffers(tree: WorkflowRecord, reader: Reader = db) {
  if (!["listed", "available"].includes(tree.status) || !(await currentApproval(tree, reader)) || !tree.farmId || (await contentBlockers(tree, reader)).length) return [];
  const [farm] = await reader.select().from(workflowRecords).where(eq(workflowRecords.id, tree.farmId));
  if (!farm || !["listed", "approved"].includes(farm.status)) return [];
  const records = await reader.select().from(workflowRecords).where(and(eq(workflowRecords.module, "schemes"), eq(workflowRecords.status, "approved")));
  const result: AdoptionApproval[] = [];
  for (const record of records) {
    const c = CreateManagedSchemeBody.safeParse({ name: record.title, configuration: record.data.configuration });
    if (!c.success || !c.data.configuration.treeIds.includes(tree.id)) continue;
    const day = businessDay();
    if (c.data.configuration.enrollmentStart && c.data.configuration.enrollmentStart > day || c.data.configuration.enrollmentEnd && c.data.configuration.enrollmentEnd < day) continue;
    const approval = await currentApproval(record, reader);
    if (approval && !(await contentBlockers(record, reader)).length) result.push(approval);
  }
  return result;
}
export async function capacityUsed(treeId: string, mode: string, reader: Reader = db, excludeId?: string) {
  const orders = await reader.select().from(adoptionOrders).where(and(eq(adoptionOrders.treeId, treeId), eq(adoptionOrders.mode, mode)));
  const now = Date.now();
  return orders.filter(o => o.id !== excludeId && ((o.state === "active" && (!o.endsAt || o.endsAt.valueOf() > now)) ||
    (["reserved", "creating-payment", "payment-pending"].includes(o.state) && o.expiresAt.valueOf() > now)));
}
