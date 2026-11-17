import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, workflowRecords, consentEvents } from "@workspace/db";
import {
  ListPublicTreesQueryParams, ListPublicTreesResponse, GetPublicTreeResponse,
  ListPublicFarmsResponse, ListArticlesResponse, SubmitEnquiryBody, SubmitEnquiryResponse, GetReadinessResponse,
} from "@workspace/api-zod";
import { PlatformError } from "../lib/platform/access";
import { isPublicFarm, isPublicTree, farmDTO, photos } from "../lib/platform/catalogue";
const router: IRouter = Router();

router.get("/v1/readiness", (_req, res) => {
  res.json(GetReadinessResponse.parse({
    adoptionsOpen: false,
    message: "Explore farms, trees and growing seasons. Payment is available only after tree verification, approved scheme terms and a connected checkout.",
    gates: ["Real farm authority and verified tree evidence", "Approved scheme terms and harvest remedies", "Connected and verified payment gateway", "Complete commercial and fulfilment workflows"],
  }));
});
router.get("/v1/public/farms", async (_req, res): Promise<void> => {
  const farms = await db.select().from(workflowRecords).where(eq(workflowRecords.module, "farms"));
  const listings = await Promise.all(farms.filter(isPublicFarm).map(farmDTO));
  res.json(ListPublicFarmsResponse.parse(listings.map(f => ({ ...f, image: f.images[0]?.url }))));
});
async function treeInventory() {
  const farms = (await db.select().from(workflowRecords).where(eq(workflowRecords.module, "farms"))).filter(isPublicFarm);
  const trees = (await db.select().from(workflowRecords).where(eq(workflowRecords.module, "trees"))).filter(isPublicTree);
  const listings = await Promise.all(trees.map(async t => {
    const farm = farms.find(f => f.id === t.farmId);
    if (!farm) return null;
    const images = await photos(t.data.imageIds);
    return { id: t.id, treeCode: t.data.treeCode, name: t.title, species: t.data.species, variety: t.data.variety,
      farmName: farm.title, zone: t.data.zone, status: t.status, description: t.data.description, age: t.data.age,
      inspectedAt: t.data.inspectedAt, productiveAssessment: t.data.productiveAssessment,
      images, image: images[0]?.url, farmId: farm.id, isSample: t.data.isSample === true || farm.data.isSample === true,
      adoptionEligible: false };
  }));
  return listings.filter((t): t is NonNullable<typeof t> => t !== null);
}
router.get("/v1/public/trees", async (req, res): Promise<void> => {
  const query = ListPublicTreesQueryParams.parse(req.query);
  const trees = (await treeInventory()).filter(t => (!query.species || String(t.species).toLowerCase() === query.species.toLowerCase()) &&
    (!query.search || `${t.name} ${t.variety} ${t.treeCode}`.toLowerCase().includes(query.search.toLowerCase())));
  res.json(ListPublicTreesResponse.parse(trees));
});
router.get("/v1/public/trees/:id", async (req, res): Promise<void> => {
  const tree = (await treeInventory()).find(t => t.id === req.params.id || t.treeCode === req.params.id);
  if (!tree) throw new PlatformError(404, "This tree is not in the public directory.");
  res.json(GetPublicTreeResponse.parse({ tree, schemes: [] }));
});
router.get("/v1/public/articles", async (_req, res): Promise<void> => {
  const articles = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, "articles"), eq(workflowRecords.status, "published")));
  res.json(ListArticlesResponse.parse(articles.map(a => ({ id: a.id, title: a.title, category: a.data.category,
    excerpt: a.data.excerpt, body: a.data.body, readingMinutes: a.data.readingMinutes }))));
});
router.post("/v1/public/enquiries", async (req, res): Promise<void> => {
  const input = SubmitEnquiryBody.parse(req.body);
  if (input.consent !== true) throw new PlatformError(400, "Please explicitly consent to being contacted about this enquiry.");
  if (input.eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) || Number.isNaN(Date.parse(input.eventDate)))) throw new PlatformError(400, "Event date must be a valid date.");
  const id = await db.transaction(async tx => {
    const [row] = await tx.insert(workflowRecords).values({ module: "enquiries", title: `${input.kind} enquiry`, status: "new", data: { ...input, consent: undefined } }).returning();
    await tx.insert(consentEvents).values({ recordId: row!.id, purpose: "enquiry-contact", version: "enquiry-contact-1", accepted: "true" });
    return row!.id;
  });
  res.status(201).json(SubmitEnquiryResponse.parse({ id, message: "Your enquiry has been recorded. Keep this reference for follow-up. This does not reserve a tree or confirm an order." }));
});
export default router;
