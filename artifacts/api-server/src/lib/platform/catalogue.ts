import { and, eq, inArray, sql, count } from "drizzle-orm";
import { db, catalogueImages, workflowRecords, type WorkflowRecord } from "@workspace/db";
import { type Actor, can, isAdmin, PlatformError } from "./access";
import { currentApproval } from "./adoption-eligibility";

export const farmRoles = ["administrator", "super-administrator", "farm-manager"];
export const storageAvailable = () => Boolean(process.env.PRIVATE_OBJECT_DIR);
export const isPublicFarm = (f: WorkflowRecord) => ["listed", "approved"].includes(f.status);
export const isPublicTree = (t: WorkflowRecord) => ["listed", "available", "temporarily-unavailable"].includes(t.status);

export function requireFarmManager(a: Actor, farmId?: string) {
  if (!can(a, farmRoles, farmId)) throw new PlatformError(403, "A farm-manager or administrator account is required.");
}
export const farmManagerScope = (a: Actor) => isAdmin(a) || a.grants.some(g => g.role === "farm-manager" && g.scope === "*")
  ? sql`true`
  : inArray(workflowRecords.id, a.grants.filter(g => g.role === "farm-manager").map(g => g.scope));
export const imageDTO = (i: typeof catalogueImages.$inferSelect) => ({
  id: i.id, url: `/api/v1/catalogue/images/${i.id}`, name: i.name, isIllustrative: i.isIllustrative,
});
export async function photos(ids: unknown) {
  const keys = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === "string") : [];
  if (!keys.length) return [];
  const rows = await db.select().from(catalogueImages).where(and(inArray(catalogueImages.id, keys), eq(catalogueImages.status, "ready")));
  return keys.flatMap(id => { const row = rows.find(i => i.id === id); return row ? [imageDTO(row)] : []; });
}
export async function validatePhotos(a: Actor, ids: string[], beforeIds: unknown = []) {
  if (new Set(ids).size !== ids.length) throw new PlatformError(400, "Choose each photo only once.");
  if (!ids.length) return;
  const existing = Array.isArray(beforeIds) ? beforeIds : [];
  const rows = await db.select().from(catalogueImages).where(and(inArray(catalogueImages.id, ids), eq(catalogueImages.status, "ready")));
  if (rows.length !== ids.length || rows.some(i => i.ownerId !== a.id && !isAdmin(a) && !i.isIllustrative && !existing.includes(i.id))) {
    throw new PlatformError(400, "Use completed photo uploads that belong to you or this record.");
  }
}
export async function farmDTO(f: WorkflowRecord) {
  const images = await photos(f.data.imageIds);
  const [total] = await db.select({ n: count() }).from(workflowRecords).where(and(
    eq(workflowRecords.module, "trees"), eq(workflowRecords.farmId, f.id), sql`${workflowRecords.status} NOT IN ('archived', 'retired')`));
  return { id: f.id, name: f.title, version: f.version, district: String(f.data.district ?? ""),
    description: String(f.data.description ?? ""), location: String(f.data.location ?? ""), areaAcres: Number(f.data.areaAcres ?? 0),
    status: f.status === "approved" ? "listed" : f.status, isSample: f.data.isSample === true && !(await currentApproval(f)), images,
    imageIds: images.map(i => i.id), treeCount: total?.n ?? 0 };
}
export async function treeDTO(t: WorkflowRecord) {
  const images = await photos(t.data.imageIds);
  return { id: t.id, farmId: t.farmId, name: t.title, version: t.version, treeCode: String(t.data.treeCode ?? ""),
    species: String(t.data.species ?? "Mango"), variety: String(t.data.variety ?? ""), zone: String(t.data.zone ?? ""),
    age: String(t.data.age ?? ""), description: String(t.data.description ?? ""), condition: String(t.data.condition ?? ""),
    status: t.status === "available" ? "listed" : t.status, isSample: t.data.isSample === true && !(await currentApproval(t)),
    images, imageIds: images.map(i => i.id) };
}
