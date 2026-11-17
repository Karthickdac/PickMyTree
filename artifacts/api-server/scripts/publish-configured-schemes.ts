import { and, eq, sql } from "drizzle-orm";
import { db, pool, workflowRecords, auditEvents } from "@workspace/db";
import { schemeDTO, schemeSnapshot, validateSchemePublication, validateSchemeReferences } from "../src/lib/platform/schemes";

// Explicit workspace-owner maintenance action, never a startup seed or an
// assertion that an authenticated app reviewer performed an inspection.
const ids = [
  "d3f30000-0000-4000-8000-000000000001",
  "d3f30000-0000-4000-8000-000000000002",
  "d3f30000-0000-4000-8000-000000000003",
];
try {
  const results = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(73421891)`);
    const result = [];
    for (const id of ids) {
      const [before] = await tx.select().from(workflowRecords).where(and(eq(workflowRecords.id, id), eq(workflowRecords.module, "schemes"))).for("update");
      if (!before) throw new Error("A configured scheme was not found. No publication changes were committed.");
      const scheme = schemeDTO(before);
      if (["published", "approved"].includes(scheme.status)) { result.push({ name: scheme.name, status: scheme.status, feePaise: scheme.configuration.feePaise }); continue; }
      if (scheme.status !== "draft") throw new Error("Restore the archived scheme before publishing it.");
      validateSchemePublication(scheme.configuration);
      await validateSchemeReferences(scheme.configuration);
      const [after] = await tx.update(workflowRecords).set({ status: "published", version: before.version + 1, updatedAt: new Date() }).where(eq(workflowRecords.id, id)).returning();
      await tx.insert(auditEvents).values({
        actorId: null, module: "schemes", recordId: id, action: "scheme-draft-revised",
        reason: "Workspace owner explicitly requested publication of the configured scheme listing; no physical verification or payment approval was asserted",
        before: schemeSnapshot(before), after: schemeSnapshot(after!),
      });
      result.push({ name: scheme.name, status: "published", feePaise: scheme.configuration.feePaise });
    }
    return result;
  });
  console.log(JSON.stringify({ publishedListings: results, treeVerificationChanged: false, paymentEligibilityChanged: false }));
} finally { await pool.end(); }
