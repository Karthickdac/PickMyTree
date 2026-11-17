import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import { and, eq } from "drizzle-orm";
import { db, catalogueImages, auditEvents } from "@workspace/db";
import { RequestFarmImageUploadBody, RequestFarmImageUploadResponse, CompleteFarmImageUploadResponse } from "@workspace/api-zod";
import { z } from "zod";
import { identify, actor, isAdmin, PlatformError } from "../lib/platform/access";
import { farmRoles, storageAvailable, imageDTO } from "../lib/platform/catalogue";
import { catalogueDestination, catalogueStorage } from "../lib/catalogueStorage";
import { ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const uuid = z.string().uuid();
router.use("/v1/management/images", identify, (req, _res, next) => {
  if (!actor(req).grants.some(g => farmRoles.includes(g.role))) throw new PlatformError(403, "Farm-manager access is required for catalogue uploads.");
  next();
});
router.use("/v1/management/images/request-upload", rateLimit({ windowMs: 3600_000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false }));
router.post("/v1/management/images/request-upload", async (req, res) => {
  if (!storageAvailable()) throw new PlatformError(503, "Photo storage is not connected. Please ask the project owner to connect App Storage.");
  const a = actor(req), input = RequestFarmImageUploadBody.parse(req.body);
  let uploadURL: string;
  try { uploadURL = await catalogueStorage.getObjectEntityUploadURL(); }
  catch { throw new PlatformError(503, "Photo storage is temporarily unavailable. Your farm details have not been changed."); }
  const objectPath = catalogueStorage.normalizeObjectEntityPath(uploadURL);
  if (!/^\/objects\/uploads\/[a-f0-9-]+$/.test(objectPath)) throw new PlatformError(503, "Photo storage returned an invalid upload location.");
  const [row] = await db.insert(catalogueImages).values({ ownerId: a.id, name: input.name, byteSize: input.size, contentType: input.contentType, objectPath }).returning();
  res.status(201).json(RequestFarmImageUploadResponse.parse({ id: row!.id, uploadURL }));
});
router.post("/v1/management/images/:imageId/complete", async (req, res) => {
  const a = actor(req), id = uuid.parse(req.params.imageId);
  const [image] = await db.select().from(catalogueImages).where(eq(catalogueImages.id, id));
  if (!image || image.ownerId !== a.id && !isAdmin(a)) throw new PlatformError(404, "Upload not found.");
  if (image.status === "ready") { res.json(CompleteFarmImageUploadResponse.parse(imageDTO(image))); return; }
  if (image.status !== "pending" || !image.objectPath) throw new PlatformError(400, "This upload was rejected. Please choose the image again.");
  if (Date.now() - image.createdAt.getTime() > 30 * 60_000) throw new PlatformError(400, "The upload expired. Please choose the image again.");
  let source;
  try { source = await catalogueStorage.getObjectEntityFile(image.objectPath); }
  catch (err) {
    if (err instanceof ObjectNotFoundError) throw new PlatformError(409, "The image has not finished uploading.");
    throw new PlatformError(503, "Photo storage is temporarily unavailable.");
  }
  let clean: Buffer;
  try {
    const [metadata] = await source.getMetadata();
    if (Number(metadata.size) !== image.byteSize || Number(metadata.size) > 10485760 || metadata.contentType !== image.contentType) throw new Error("Upload metadata mismatch");
    const [bytes] = await source.download();
    const decoder = sharp(bytes, { limitInputPixels: 36_000_000, failOn: "error" });
    const header = await decoder.metadata();
    if (!header.format || !["jpeg", "png", "webp"].includes(header.format)) throw new Error("Unsupported image");
    // Decode and re-encode rather than trusting extensions/MIME. EXIF (including
    // location) is stripped; no SVG/HTML or original untrusted bytes are served.
    clean = await decoder.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (clean.length > 10485760) throw new Error("Image too large");
  } catch {
    await db.update(catalogueImages).set({ status: "rejected" }).where(eq(catalogueImages.id, id));
    await source.delete({ ignoreNotFound: true }).catch(() => undefined);
    throw new PlatformError(400, "Use a valid JPEG, PNG or WebP photo up to 10 MB and 36 megapixels.");
  }
  // The public file has no signed PUT URL. An outstanding upload URL can never
  // replace bytes after validation, even if the client retries its original PUT.
  const destination = catalogueDestination(id);
  try {
    await destination.file.save(clean, { resumable: false, metadata: { contentType: "image/webp", cacheControl: "public,max-age=3600,immutable" }, preconditionOpts: { ifGenerationMatch: 0 } });
  } catch { throw new PlatformError(503, "We could not store the validated photo. Please retry."); }
  const ready = await db.transaction(async tx => {
    const [row] = await tx.update(catalogueImages).set({ objectPath: destination.objectPath, status: "ready", contentType: "image/webp", byteSize: clean.length })
      .where(and(eq(catalogueImages.id, id), eq(catalogueImages.status, "pending"))).returning();
    if (!row) throw new PlatformError(409, "This upload was already processed. Please reload.");
    await tx.insert(auditEvents).values({ actorId: a.id, module: "catalogue-images", recordId: id, action: "photo-uploaded", reason: "Validated and stored a public catalogue photo", after: { size: clean.length, contentType: "image/webp" } });
    return row;
  });
  await source.delete({ ignoreNotFound: true }).catch(() => req.log.warn({ event: "pending-photo-cleanup" }, "Pending upload cleanup needed"));
  res.json(CompleteFarmImageUploadResponse.parse(imageDTO(ready)));
});
router.get("/v1/catalogue/images/:imageId", async (req, res, next) => {
  const [image] = await db.select().from(catalogueImages).where(and(eq(catalogueImages.id, uuid.parse(req.params.imageId)), eq(catalogueImages.status, "ready")));
  if (!image?.objectPath) throw new PlatformError(404, "Photo not found.");
  let file;
  try { file = await catalogueStorage.getObjectEntityFile(image.objectPath); }
  catch (err) {
    if (err instanceof ObjectNotFoundError) throw new PlatformError(404, "Photo not found.");
    throw new PlatformError(503, "Photo storage is temporarily unavailable.");
  }
  res.set({ "Content-Type": image.contentType, "Cache-Control": "public, max-age=3600, immutable", "X-Content-Type-Options": "nosniff" });
  const stream = file.createReadStream();
  stream.on("error", (err) => { if (res.headersSent) res.destroy(); else next(err); });
  stream.pipe(res);
});
export default router;
