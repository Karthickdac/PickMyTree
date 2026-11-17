import { and, eq, inArray } from "drizzle-orm";
import { db, workflowRecords, type WorkflowRecord } from "@workspace/db";
import { CreateManagedSchemeBody } from "@workspace/api-zod";
import { schemeBenefit, validateSchemePublication } from "./schemes";

// A public scheme listing is deliberately separate from treeOffers(), which
// remains the authority for immutable approved contracts and purchase eligibility.
export async function publishedSchemesForTree(tree: WorkflowRecord) {
  const records = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, "schemes"), inArray(workflowRecords.status, ["published", "approved"])));
  return records.flatMap(record => {
    const input = CreateManagedSchemeBody.safeParse({ name: record.title, configuration: record.data.configuration });
    if (!input.success) return [];
    const c = input.data.configuration;
    if (c.farmId !== tree.farmId || !c.treeIds.includes(tree.id) || c.species !== tree.data.species ||
      (c.variety.trim() && c.variety.trim().toLowerCase() !== String(tree.data.variety).trim().toLowerCase())) return [];
    try { validateSchemePublication(c); } catch { return []; }
    return [{
      id: record.id, name: record.title, version: record.version, feePaise: c.feePaise,
      durationMonths: c.durationMonths, entitlement: schemeBenefit(c),
      disclosures: [c.risks, c.shortfallPolicy, c.cancellationPolicy,
        "Review the final harvest, fulfilment and cancellation terms before purchase. Publishing a scheme does not confirm tree verification or availability."].filter(Boolean).join("\n\n"),
    }];
  });
}
