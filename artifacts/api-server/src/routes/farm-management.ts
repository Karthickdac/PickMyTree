import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, desc } from "drizzle-orm";
import { db, workflowRecords, auditEvents } from "@workspace/db";
import {
  CreateManagedFarmBody, UpdateManagedFarmBody, CreateManagedTreeBody, UpdateManagedTreeBody,
  ListManagedFarmsResponse, CreateManagedFarmResponse, UpdateManagedFarmResponse,
  ListManagedTreesResponse, CreateManagedTreeResponse, UpdateManagedTreeResponse,
} from "@workspace/api-zod";
import { z } from "zod";
import { actor, identify, PlatformError, can } from "../lib/platform/access";
import { farmRoles, farmManagerScope, requireFarmManager, farmDTO, treeDTO, validatePhotos, storageAvailable } from "../lib/platform/catalogue";
import { commerceLock } from "../lib/platform/adoption-orders";

const router: IRouter = Router();
const uuid = z.string().uuid();
router.use("/v1/management", identify, (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

async function ownedFarm(a: ReturnType<typeof actor>, id: string) {
  const [f] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, uuid.parse(id)), eq(workflowRecords.module, "farms"), farmManagerScope(a)));
  if (!f) throw new PlatformError(404, "Farm not found or not assigned to your account.");
  return f;
}
router.get("/v1/management/farms", async (req, res) => {
  const a = actor(req);
  if (!a.grants.some(g => farmRoles.includes(g.role))) throw new PlatformError(403, "Farm-manager access is required. Ask the project owner to configure your account.");
  const farms = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, "farms"), farmManagerScope(a))).orderBy(desc(workflowRecords.createdAt));
  res.json(ListManagedFarmsResponse.parse({ items: await Promise.all(farms.map(farmDTO)), storageAvailable: storageAvailable() }));
});
router.post("/v1/management/farms", async (req, res) => {
  const a = actor(req); requireFarmManager(a);
  const input = CreateManagedFarmBody.parse(req.body);
  if (input.status === "archived") throw new PlatformError(400, "A new farm cannot start archived.");
  await validatePhotos(a, input.imageIds);
  const { name, status, ...data } = input;
  const f = await db.transaction(async tx => {
    const [row] = await tx.insert(workflowRecords).values({ module: "farms", title: name, status,
      createdBy: a.id, data: { ...data, isSample: false, authorityReviewed: false } }).returning();
    await tx.insert(auditEvents).values({ actorId: a.id, module: "farms", recordId: row!.id, action: "catalogue-created", reason: "Registered a farm profile", after: { title: name, status } });
    return row!;
  });
  res.status(201).json(CreateManagedFarmResponse.parse(await farmDTO(f)));
});
router.patch("/v1/management/farms/:farmId", async (req, res) => {
  const a = actor(req), before = await ownedFarm(a, req.params.farmId), input = UpdateManagedFarmBody.parse(req.body);
  if (before.version !== input.version) throw new PlatformError(409, "This farm changed in another session. Reload it before saving.");
  requireFarmManager(a, before.id);
  await validatePhotos(a, input.imageIds, before.data.imageIds);
  const { name, status, version, ...data } = input;
  const after = await db.transaction(async tx => {
    await tx.execute(commerceLock);
    const [row] = await tx.update(workflowRecords).set({ title: name, status, data: { ...before.data, ...data, authorityReviewed: false },
      version: before.version + 1, updatedAt: new Date() }).where(and(eq(workflowRecords.id, before.id), eq(workflowRecords.version, version))).returning();
    if (!row) throw new PlatformError(409, "This farm changed in another session. Reload it before saving.");
    await tx.insert(auditEvents).values({ actorId: a.id, module: "farms", recordId: row.id, action: "catalogue-updated", reason: "Edited farm profile or photos",
      before: { title: before.title, data: before.data, status: before.status }, after: { title: row.title, data: row.data, status: row.status } });
    return row;
  });
  res.json(UpdateManagedFarmResponse.parse(await farmDTO(after)));
});
router.get("/v1/management/farms/:farmId/trees", async (req, res) => {
  const a = actor(req), f = await ownedFarm(a, req.params.farmId);
  const trees = await db.select().from(workflowRecords).where(and(eq(workflowRecords.module, "trees"), eq(workflowRecords.farmId, f.id))).orderBy(desc(workflowRecords.createdAt));
  res.json(ListManagedTreesResponse.parse(await Promise.all(trees.map(treeDTO))));
});
router.post("/v1/management/farms/:farmId/trees", async (req, res) => {
  const a = actor(req), f = await ownedFarm(a, req.params.farmId), input = CreateManagedTreeBody.parse(req.body);
  if (f.status === "archived") throw new PlatformError(409, "Restore this farm before adding trees.");
  if (input.status === "archived") throw new PlatformError(400, "A new tree cannot start archived.");
  await validatePhotos(a, input.imageIds);
  const { name, status, ...data } = input;
  const t = await db.transaction(async tx => {
    const [row] = await tx.insert(workflowRecords).values({ module: "trees", farmId: f.id, title: name, status, createdBy: a.id,
      data: { ...data, farmId: f.id, treeCode: `PAT-${randomUUID().slice(0, 8).toUpperCase()}`, isSample: f.data.isSample === true, provenanceVerified: false } }).returning();
    await tx.insert(auditEvents).values({ actorId: a.id, module: "trees", recordId: row!.id, action: "catalogue-created", reason: "Registered a tree profile", after: { title: name, farmId: f.id, status } });
    return row!;
  });
  res.status(201).json(CreateManagedTreeResponse.parse(await treeDTO(t)));
});
router.patch("/v1/management/trees/:treeId", async (req, res) => {
  const a = actor(req), input = UpdateManagedTreeBody.parse(req.body);
  const [before] = await db.select().from(workflowRecords).where(and(eq(workflowRecords.id, uuid.parse(req.params.treeId)), eq(workflowRecords.module, "trees")));
  if (!before?.farmId) throw new PlatformError(404, "Tree not found.");
  if (before.version !== input.version) throw new PlatformError(409, "This tree changed in another session. Reload it before saving.");
  await ownedFarm(a, before.farmId);
  requireFarmManager(a, before.farmId);
  await validatePhotos(a, input.imageIds, before.data.imageIds);
  const { name, status, version, ...data } = input;
  const after = await db.transaction(async tx => {
    await tx.execute(commerceLock);
    const [row] = await tx.update(workflowRecords).set({ title: name, status, version: before.version + 1, updatedAt: new Date(),
      data: { ...before.data, ...data, provenanceVerified: false } }).where(and(eq(workflowRecords.id, before.id), eq(workflowRecords.version, version))).returning();
    if (!row) throw new PlatformError(409, "This tree changed in another session. Reload it before saving.");
    await tx.insert(auditEvents).values({ actorId: a.id, module: "trees", recordId: row.id, action: "catalogue-updated", reason: "Edited tree profile or photos",
      before: { title: before.title, data: before.data, status: before.status }, after: { title: row.title, data: row.data, status: row.status } });
    return row;
  });
  res.json(UpdateManagedTreeResponse.parse(await treeDTO(after)));
});
export default router;
