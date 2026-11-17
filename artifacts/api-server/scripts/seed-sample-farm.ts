import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, pool, workflowRecords, catalogueImages, auditEvents } from "@workspace/db";
import { catalogueDestination } from "../src/lib/catalogueStorage";

const farmId = "d3f00000-0000-4000-8000-000000000001";
const fixtures = ["farm-landscape", "hero-orchard", "mango", "guava", "coconut"];
let stage = "check-existing";
async function seed() {
  const [existing] = await db.select({ id: workflowRecords.id }).from(workflowRecords).where(eq(workflowRecords.id, farmId));
  if (existing) { console.log("Sample farm already exists; all edits were retained."); return; }
  const imageIds: Record<string, string> = {};
  for (const [index, key] of fixtures.entries()) {
    const id = `d3f10000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    imageIds[key] = id;
    const [existingImage] = await db.select().from(catalogueImages).where(eq(catalogueImages.id, id));
    if (existingImage) continue;
    stage = "read-local-illustration";
    const source = await readFile(resolve("../../attached_assets/generated_images", `${key}.jpg`));
    const clean = await sharp(source).resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    stage = "prepare-storage-destination";
    const destination = catalogueDestination(id);
    stage = "save-illustration-to-storage";
    await destination.file.save(clean, { resumable: false, metadata: { contentType: "image/webp" }, preconditionOpts: { ifGenerationMatch: 0 } });
    stage = "save-image-metadata";
    await db.insert(catalogueImages).values({ id, name: `Illustrative ${key.replaceAll("-", " ")}`,
      status: "ready", contentType: "image/webp", byteSize: clean.length, objectPath: destination.objectPath, isIllustrative: true }).onConflictDoNothing();
  }
  const trees = [
    { species: "Mango", variety: "Neelum", zone: "Block A", age: "6 years", condition: "Sample record — not physically inspected" },
    { species: "Mango", variety: "Alphonso", zone: "Block A", age: "7 years", condition: "Sample record — not physically inspected" },
    { species: "Guava", variety: "Lucknow 49", zone: "Block B", age: "4 years", condition: "Sample record — not physically inspected" },
    { species: "Guava", variety: "Allahabad Safeda", zone: "Block B", age: "5 years", condition: "Sample record — not physically inspected" },
    { species: "Coconut", variety: "East Coast Tall", zone: "Block C", age: "9 years", condition: "Sample record — not physically inspected" },
    { species: "Coconut", variety: "Dwarf", zone: "Block C", age: "6 years", condition: "Sample record — not physically inspected" },
  ];
  stage = "save-sample-inventory";
  await db.transaction(async tx => {
    const inserted = await tx.insert(workflowRecords).values({ id: farmId, module: "farms", title: "Vaigai Sample Farm", status: "listed",
      data: { isSample: true, authorityReviewed: false, district: "Dindigul", location: "Illustrative Madurai–Dindigul orchard; not a visit address",
        areaAcres: 6.5, description: "An editable sample farm with mango, guava and coconut trees. Replace this test content and the illustrative images as you explore farm management. This is not a registered operating farm.",
        imageIds: [imageIds["farm-landscape"], imageIds["hero-orchard"]] } }).onConflictDoNothing().returning();
    if (!inserted.length) return;
    for (const [index, t] of trees.entries()) {
      const name = `${t.variety} ${t.species} · Sample ${index + 1}`;
      await tx.insert(workflowRecords).values({ id: `d3f20000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, module: "trees", farmId, title: name, status: "listed",
        data: { ...t, farmId, treeCode: `SAMPLE-${t.species.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
          isSample: true, provenanceVerified: false, description: `Editable sample ${t.variety} ${t.species.toLowerCase()} profile. Photos are illustrative; no inspection, harvest or adoption entitlement is claimed.`,
          imageIds: [imageIds[t.species.toLowerCase()]] } });
    }
    await tx.insert(auditEvents).values({ action: "sample-inventory-created", module: "farms", recordId: farmId,
      reason: "Project owner explicitly requested one editable test farm with trees and images", after: { sample: true, trees: trees.length, images: fixtures.length } });
  });
  console.log("Created one clearly labelled sample farm, six sample trees and five persistent illustrative photos.");
}
try { await seed(); }
catch (err) {
  const e = err as { name?: string; stack?: string; code?: unknown; status?: number; cause?: { code?: unknown } };
  const safeCode = (code: unknown) => typeof code === "number" || typeof code === "string" && /^[A-Z_0-9]{1,40}$/.test(code) ? code : undefined;
  console.error("Sample farm setup could not finish; no sample edits were overwritten.", { stage, name: e.name, code: safeCode(e.code), status: e.status, causeCode: safeCode(e.cause?.code) });
  console.error(e.stack?.split("\n").slice(1, 5).join("\n"));
  process.exitCode = 1;
}
finally { await pool.end(); }
