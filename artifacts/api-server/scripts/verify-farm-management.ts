import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import sharp from "sharp";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, platformUsers, roleGrants, workflowRecords, catalogueImages, auditEvents } from "@workspace/db";
import management from "../src/routes/farm-management";
import imageRoutes from "../src/routes/catalogue-images";
import publicRoutes from "../src/routes/platform-public";
import { PlatformError } from "../src/lib/platform/errors";
import { verifiedMobileIdentity, hasRecentMfa } from "../src/lib/platform/mobile-identity";
import { catalogueStorage } from "../src/lib/catalogueStorage";

// This isolated test server is never mounted in the application. Only this
// process supplies synthetic SDK context, on a loopback-only ephemeral port.
const suffix = randomUUID();
const issuer = "https://verification.invalid/";
const principals = [
  { key: "manager", id: randomUUID(), subject: `sms|verification-manager-${suffix}`, phone: "+919000000001", role: "administrator", scope: "*" },
  { key: "customer", id: randomUUID(), subject: `sms|verification-customer-${suffix}`, phone: "+919000000002", role: "", scope: "" },
  { key: "scoped", id: randomUUID(), subject: `sms|verification-scoped-${suffix}`, phone: "+919000000003", role: "farm-manager", scope: randomUUID() },
];
const farmIds: string[] = [], treeIds: string[] = [], imageIds: string[] = [], objectPaths: string[] = [];
let passed = 0;
const pass = (label: string) => { passed++; console.log(`PASS ${label}`); };
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const p = principals.find(p => p.key === req.get("x-verification-persona"));
  req.log = { warn() {}, error() {} } as never;
  if (p) {
    req.oidc = { isAuthenticated: () => true, user: { sub: p.subject }, idTokenClaims: { iss: issuer, sub: p.subject } } as never;
    req.patSession = { mobileIdentity: { subject: p.subject, phone: p.phone } };
  }
  next();
});
app.use("/api", management, imageRoutes, publicRoutes);
const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  res.status(err instanceof PlatformError ? err.status : err?.name === "ZodError" ? 400 : 500).json({
    error: err instanceof PlatformError ? err.message : err?.name === "ZodError" ? "Invalid fields" : "Verification request failed",
  });
};
app.use(errors);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api`;
const call = (path: string, method = "GET", body?: unknown, persona = "manager") => fetch(base + path, {
  method, headers: { "Content-Type": "application/json", ...(persona ? { "x-verification-persona": persona } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function json(path: string, method = "GET", body?: unknown, expected = 200, persona = "manager") {
  const response = await call(path, method, body, persona);
  assert.equal(response.status, expected, `${method} ${path} returned ${response.status}, expected ${expected}`);
  return response.json() as Promise<Record<string, any>>;
}
try {
  for (const p of principals) {
    await db.insert(platformUsers).values({ id: p.id, authId: `${issuer}|${p.subject}`, displayName: "Automated verification account" });
    if (p.role) await db.insert(roleGrants).values({ userId: p.id, role: p.role, scope: p.scope, grantedBy: p.id, reason: "Isolated automated verification" });
  }
  await json("/v1/management/farms", "GET", undefined, 401, "");
  await json("/v1/management/farms", "GET", undefined, 403, "customer");
  pass("anonymous and customer accounts cannot edit farms");

  assert.throws(() => verifiedMobileIdentity({ sub: "auth0|email" }, { sub: "auth0|email", phone_number: "+919000000001" }));
  assert.throws(() => verifiedMobileIdentity({ sub: "sms|one" }, { sub: "sms|two", phone_number: "+919000000001" }));
  assert.throws(() => verifiedMobileIdentity({ sub: "sms|one" }, { sub: "sms|one", phone_number: "+919000000001", phone_number_verified: false }));
  assert.equal(verifiedMobileIdentity({ sub: "sms|one" }, { sub: "sms|one", phone_number: "+919000000001" }).subject, "sms|one");
  assert.equal(hasRecentMfa({ amr: ["sms"], auth_time: 100 }, 110), false);
  assert.equal(hasRecentMfa({ amr: ["mfa"], auth_time: 100 }, 110), true);
  assert.equal(hasRecentMfa({ amr: ["mfa"], auth_time: 100 }, 800), false);
  pass("only matching SMS identities are accepted; OTP alone is not staff MFA");

  const farmInput = { name: `Verification farm ${suffix}`, district: "Dindigul", location: "Automated test, not an address",
    description: "Temporary verification record", areaAcres: 2.5, status: "draft", imageIds: [] };
  await json("/v1/management/farms", "POST", { ...farmInput, areaAcres: -1 }, 400);
  const farm = await json("/v1/management/farms", "POST", { ...farmInput, isSample: true, authorityReviewed: true }, 201);
  farmIds.push(farm.id);
  assert.equal(farm.isSample, false);
  const [stored] = await db.select().from(workflowRecords).where(eq(workflowRecords.id, farm.id));
  assert.equal(stored?.data.authorityReviewed, false);
  assert.equal(stored?.title, farmInput.name);
  await json(`/v1/management/farms/${farm.id}/trees`, "GET", undefined, 404, "scoped");
  pass("farm creation persists, validates fields and enforces farm scopes");

  const photo = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#12764b" } }).jpeg().toBuffer();
  const upload = await json("/v1/management/images/request-upload", "POST", { name: "verification.jpg", contentType: "image/jpeg", size: photo.length }, 201);
  imageIds.push(upload.id);
  objectPaths.push(catalogueStorage.normalizeObjectEntityPath(upload.uploadURL));
  const origin = "https://688aabd1-1d0a-4bf0-80b3-9c39da11ed03-00-24y5k1cp75wqa.pike.replit.dev";
  const preflight = await fetch(upload.uploadURL, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
  assert(preflight.ok);
  assert(["*", origin].includes(preflight.headers.get("access-control-allow-origin") ?? ""), "Direct uploads must allow the app's browser origin");
  assert((await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo })).ok);
  await json(`/v1/management/images/${upload.id}/complete`, "POST", undefined, 403, "customer");
  const completed = await json(`/v1/management/images/${upload.id}/complete`, "POST");
  const [photoRow] = await db.select().from(catalogueImages).where(eq(catalogueImages.id, upload.id));
  objectPaths.push(photoRow!.objectPath!);
  const publicPhoto = await fetch(new URL(completed.url, base).href);
  assert.equal(publicPhoto.status, 200);
  assert.equal(publicPhoto.headers.get("content-type"), "image/webp");
  const firstHash = createHash("sha256").update(Buffer.from(await publicPhoto.arrayBuffer())).digest("hex");
  assert((await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo })).ok);
  const secondPhoto = await fetch(new URL(completed.url, base).href);
  assert.equal(createHash("sha256").update(Buffer.from(await secondPhoto.arrayBuffer())).digest("hex"), firstHash);
  pass("browser CORS, direct upload, validation, public serving and sealed photos work");

  const listed = await json(`/v1/management/farms/${farm.id}`, "PATCH", { ...farmInput, name: `${farmInput.name} edited`, status: "listed", imageIds: [upload.id], version: farm.version });
  assert.equal(listed.version, farm.version + 1);
  assert.equal(listed.images[0].id, upload.id);
  const farmsPublic = await (await call("/v1/public/farms")).json() as any[];
  assert(farmsPublic.some(f => f.id === farm.id && f.image === completed.url));
  await json(`/v1/management/farms/${farm.id}`, "PATCH", { ...farmInput, version: farm.version }, 409);
  pass("farm edits, photo attachment and public listings persist; stale edits are rejected");

  const treeInput = { name: "Verification tree", species: "Mango", variety: "Neelum", zone: "Test block", age: "6 years",
    description: "Temporary verification tree", condition: "Not physically inspected", status: "listed", imageIds: [upload.id] };
  const tree = await json(`/v1/management/farms/${farm.id}/trees`, "POST", treeInput, 201);
  treeIds.push(tree.id);
  const updatedTree = await json(`/v1/management/trees/${tree.id}`, "PATCH", { ...treeInput, name: "Edited verification tree", version: tree.version });
  assert.equal(updatedTree.treeCode, tree.treeCode);
  const treePublic = await json(`/v1/public/trees/${tree.id}`);
  assert.equal(treePublic.tree.name, "Edited verification tree");
  assert.equal(treePublic.tree.adoptionEligible, false);
  assert.equal(treePublic.tree.image, completed.url);
  await json(`/v1/management/trees/${tree.id}`, "PATCH", { ...treeInput, version: tree.version }, 409);
  pass("tree edits and photos persist, codes stay fixed and checkout is not fabricated");

  const malicious = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>");
  const bad = await json("/v1/management/images/request-upload", "POST", { name: "not-a-photo.png", contentType: "image/png", size: malicious.length }, 201);
  imageIds.push(bad.id); objectPaths.push(catalogueStorage.normalizeObjectEntityPath(bad.uploadURL));
  assert((await fetch(bad.uploadURL, { method: "PUT", headers: { "Content-Type": "image/png" }, body: malicious })).ok);
  await json(`/v1/management/images/${bad.id}/complete`, "POST", undefined, 400);
  await json(`/v1/catalogue/images/${bad.id}`, "GET", undefined, 404, "");
  pass("disguised SVG/script uploads are rejected and never served");

  await json(`/v1/management/trees/${tree.id}`, "PATCH", { ...treeInput, status: "archived", version: updatedTree.version });
  await json(`/v1/public/trees/${tree.id}`, "GET", undefined, 404);
  await json(`/v1/management/farms/${farm.id}`, "PATCH", { ...farmInput, status: "archived", version: listed.version });
  const afterArchive = await (await call("/v1/public/farms")).json() as any[];
  assert(!afterArchive.some(f => f.id === farm.id));
  assert((await db.select().from(workflowRecords).where(eq(workflowRecords.id, tree.id))).length);
  pass("archiving hides farm/tree listings without deleting the records");
  console.log(`${passed} coherent verification groups passed.`);
} finally {
  for (const path of new Set(objectPaths)) {
    try { const file = await catalogueStorage.getObjectEntityFile(path); await file.delete({ ignoreNotFound: true }); } catch { /* Original pending objects may already have been deleted. */ }
  }
  if (treeIds.length) await db.delete(workflowRecords).where(inArray(workflowRecords.id, treeIds));
  if (farmIds.length) await db.delete(workflowRecords).where(inArray(workflowRecords.id, farmIds));
  if (imageIds.length) await db.delete(catalogueImages).where(inArray(catalogueImages.id, imageIds));
  await db.delete(auditEvents).where(inArray(auditEvents.actorId, principals.map(p => p.id)));
  await db.delete(roleGrants).where(inArray(roleGrants.userId, principals.map(p => p.id)));
  await db.delete(platformUsers).where(inArray(platformUsers.id, principals.map(p => p.id)));
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  await pool.end();
}
