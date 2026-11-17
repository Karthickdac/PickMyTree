import { and, eq, inArray } from "drizzle-orm";
import { db, pool, workflowRecords, catalogueImages, auditEvents } from "@workspace/db";
import { CreateManagedSchemeBody } from "@workspace/api-zod";
import { validateSchemeConfiguration, schemeSnapshot, type SchemeConfiguration } from "../src/lib/platform/schemes";

// Explicit workspace maintenance, never a startup hook or production migration.
if (process.env.NODE_ENV === "production") throw new Error("Run catalogue preparation only in the development workspace.");
const farmId = "d3f00000-0000-4000-8000-000000000001";
const treeId = (n: number) => `d3f20000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const schemeId = (n: number) => `d3f30000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const imageId = (n: number) => `d3f10000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const names = ["Orchard landscape image", "Orchard trees image", "Mango species image", "Guava species image", "Coconut species image"];

try {
  await db.transaction(async tx => {
    const profiles = await tx.select().from(workflowRecords).where(inArray(workflowRecords.id, [farmId, ...[1, 2, 3, 4, 5, 6].map(treeId)])).for("update");
    if (!profiles.some(r => r.id === farmId && r.module === "farms")) throw new Error("The existing farm must be present before preparing its catalogue.");
    for (const before of profiles) {
      const data = { ...before.data };
      let title = before.title;
      if (before.module === "farms") {
        if (title === "Vaigai Sample Farm") title = "Vaigai Orchard";
        if (/illustrative/i.test(String(data.location))) data.location = "Location pending confirmation";
        if (/sample|test content|illustrative/i.test(String(data.description))) data.description = "A mango, guava and coconut orchard profile. Explore individual varieties and growing blocks. Farm details and visit arrangements are subject to confirmation.";
      } else if (before.module === "trees") {
        title = title.replace(/\s*·\s*Sample\s*(\d+)$/i, " · $1");
        if (String(data.treeCode).startsWith("SAMPLE-")) data.treeCode = String(data.treeCode).replace(/^SAMPLE-/, "PAT-");
        if (/sample/i.test(String(data.condition))) data.condition = "Inspection pending";
        if (/sample|illustrative/i.test(String(data.description))) data.description = `${data.variety} ${String(data.species).toLowerCase()} in ${data.zone}. Tree measurements and harvest availability are subject to on-farm verification.`;
      }
      // Retain source/provenance flags and photos. Copy editing is not verification.
      if (title !== before.title || JSON.stringify(data) !== JSON.stringify(before.data)) {
        const [after] = await tx.update(workflowRecords).set({ title, data, version: before.version + 1, updatedAt: new Date() }).where(eq(workflowRecords.id, before.id)).returning();
        await tx.insert(auditEvents).values({ module: before.module, recordId: before.id, action: "catalogue-copy-refined",
          reason: "Owner requested ordinary editable catalogue names without development wording",
          before: { title: before.title, data: before.data }, after: { title: after!.title, data: after!.data } });
      }
    }
    for (let n = 1; n <= names.length; n++) {
      await tx.update(catalogueImages).set({ name: names[n - 1]! }).where(and(eq(catalogueImages.id, imageId(n)), eq(catalogueImages.isIllustrative, true)));
    }
    const base: SchemeConfiguration = {
      description: "", species: "Mango", variety: "", farmId, treeIds: [], durationMonths: 12,
      feePaise: 988800, taxBps: 0, allocationType: "fixed-quantity", quantity: 10, unit: "kg",
      sharePercent: 100, maxAdopters: 1, enrollmentStart: null, enrollmentEnd: null, season: "",
      roundingRule: "down", qualityGrades: "", lossRules: "", fulfilmentMethods: ["pickup", "delivery"],
      deliveryFeePaise: 0, deliveryRegions: "", fulfilmentPolicy: "", inclusions: "", exclusions: "",
      risks: "Harvest quantity and quality can vary with weather, crop health and farm conditions.",
      shortfallPolicy: "", cancellationPolicy: "", renewalPolicy: "", agreementVersion: "", terms: "", legalReviewReference: "",
    };
    const inputs = [
      { name: "Mango Harvest Box", configuration: { ...base, description: "A fixed quantity of mango harvest over the scheme duration.", variety: "Neelum", treeIds: [treeId(1)], maxAdopters: 4 } },
      { name: "Full Mango Harvest", configuration: { ...base, description: "The full harvest of one assigned mango tree, delivered or sold with proceeds settled separately.", variety: "Alphonso", treeIds: [treeId(2)], allocationType: "exclusive-harvest", quantity: null, feePaise: 1488800, fulfilmentMethods: ["pickup", "delivery", "sale-settlement"] } },
      { name: "Full Coconut Harvest", configuration: { ...base, description: "The full harvest of one assigned coconut tree, collected, delivered or sold under the configured terms.", species: "Coconut", variety: "East Coast Tall", treeIds: [treeId(5)], allocationType: "exclusive-harvest", quantity: null, unit: "count", feePaise: 1488800, fulfilmentMethods: ["pickup", "delivery", "sale-settlement"] } },
    ];
    for (let n = 0; n < inputs.length; n++) {
      const input = CreateManagedSchemeBody.parse(inputs[n]);
      validateSchemeConfiguration(input.configuration);
      const [created] = await tx.insert(workflowRecords).values({ id: schemeId(n + 1), module: "schemes", title: input.name, farmId,
        status: "draft", data: { configuration: input.configuration } }).onConflictDoNothing().returning();
      if (created) await tx.insert(auditEvents).values({ module: "schemes", recordId: created.id, action: "scheme-draft-created",
        reason: "Owner requested editable initial schemes; commercial terms require completion and approval", after: schemeSnapshot(created) });
    }
  });
  console.log("Prepared the existing farm, six tree profiles and three editable scheme drafts. Verification and payment gates were retained.");
} finally {
  await pool.end();
}
