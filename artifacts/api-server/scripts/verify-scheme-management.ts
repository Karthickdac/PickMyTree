import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, platformUsers, roleGrants, workflowRecords, auditEvents } from "@workspace/db";
import schemes from "../src/routes/scheme-management";
import workspace from "../src/routes/platform-workspace";
import { PlatformError } from "../src/lib/platform/errors";
import type { SchemeConfiguration } from "../src/lib/platform/schemes";

// Isolated loopback harness only: no test identity or bypass is added to the app.
const run = randomUUID(), farmId = randomUUID(), treeId = randomUUID();
const people = [
  { key: "admin", role: "administrator", scope: "*", id: randomUUID(), phone: "+919000000101" },
  { key: "customer", role: "customer", scope: "*", id: randomUUID(), phone: "+919000000102" },
  { key: "manager", role: "farm-manager", scope: "*", id: randomUUID(), phone: "+919000000103" },
  { key: "scoped", role: "administrator", scope: farmId, id: randomUUID(), phone: "+919000000104" },
];
const ids: string[] = [farmId, treeId];
const app = express(); app.use(express.json());
app.use((req, _res, next) => {
  const person = people.find(p => p.key === req.get("x-verification-persona"));
  if (person) {
    const subject = `sms|${run}-${person.key}`;
    req.oidc = { isAuthenticated: () => true, user: { sub: subject }, idTokenClaims: { iss: "https://verification.invalid/", sub: subject } } as never;
    req.patSession = { mobileIdentity: { subject, phone: person.phone } };
  }
  next();
});
app.use("/api", schemes, workspace);
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error instanceof PlatformError ? error.status : error?.name === "ZodError" ? 400 : 500).json({ error: error instanceof PlatformError ? error.message : "Invalid request" });
};
app.use(errors);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address(); assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api`;
async function request(path: string, method = "GET", body?: unknown, expected = 200, persona = "admin"): Promise<any> {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-verification-persona": persona }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}
const c: SchemeConfiguration = {
  description: "Harvest entitlement", species: "Mango", variety: "Neelum", farmId, treeIds: [treeId],
  durationMonths: 12, feePaise: 988800, taxBps: 500, allocationType: "fixed-quantity", quantity: 10,
  unit: "kg", sharePercent: 100, maxAdopters: 3, enrollmentStart: "2027-01-01", enrollmentEnd: "2027-03-31",
  season: "2027", roundingRule: "down", qualityGrades: "", lossRules: "",
  fulfilmentMethods: ["pickup", "delivery", "sale-settlement"], deliveryFeePaise: 15000,
  deliveryRegions: "", fulfilmentPolicy: "", inclusions: "", exclusions: "", risks: "",
  shortfallPolicy: "", cancellationPolicy: "", renewalPolicy: "", agreementVersion: "", terms: "", legalReviewReference: "",
};
try {
  for (const p of people) {
    await db.insert(platformUsers).values({ id: p.id, authId: `https://verification.invalid/|sms|${run}-${p.key}`, displayName: "Verification" });
    await db.insert(roleGrants).values({ userId: p.id, role: p.role, scope: p.scope, grantedBy: p.id, reason: "Isolated automated verification" });
  }
  await db.insert(workflowRecords).values([
    { id: farmId, module: "farms", title: "Verification", status: "draft", createdBy: people[0]!.id },
    { id: treeId, module: "trees", title: "Verification", status: "draft", farmId, createdBy: people[0]!.id, data: { species: "Mango", variety: "Neelum" } },
  ]);
  await request("/v1/management/schemes", "GET", undefined, 401, "");
  for (const persona of ["customer", "manager", "scoped"]) await request("/v1/management/schemes", "GET", undefined, 403, persona);
  console.log("PASS anonymous and non-global administrators cannot access scheme management");
  for (const configuration of [
    { ...c, quantity: 0 }, { ...c, treeIds: [treeId, treeId] }, { ...c, farmId: null },
    { ...c, enrollmentEnd: "2027-02-30" }, { ...c, enrollmentEnd: "2026-01-01" },
    { ...c, species: "Coconut" }, { ...c, variety: "Alphonso" },
    { ...c, allocationType: "exclusive-harvest" }, { ...c, unit: "count", quantity: 1.5 },
    { ...c, fulfilmentMethods: [] }, { ...c, feePaise: 9888.5 },
  ]) await request("/v1/management/schemes", "POST", { name: "Verification", configuration }, 400);
  console.log("PASS numeric, calendar, entitlement, assignment and fulfilment validations");
  const created = await request("/v1/management/schemes", "POST", { name: `Verification ${run}`, configuration: c, status: "approved" }, 201);
  ids.push(created.id); assert.equal(created.status, "draft"); assert.equal(created.configuration.feePaise, 988800);
  assert.equal(created.configuration.enrollmentStart, "2027-01-01");
  assert((await request("/v1/management/schemes")).some((r: any) => r.id === created.id));
  assert.equal((await request(`/v1/management/schemes/${created.id}`)).configuration.quantity, 10);
  const body = { name: created.name, configuration: { ...c, feePaise: 1488800 }, version: 1, status: "draft", reason: "Updated requested price" };
  const responses = await Promise.all([1, 2].map(() => fetch(`${base}/v1/management/schemes/${created.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-verification-persona": "admin" }, body: JSON.stringify(body),
  })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const current = await request(`/v1/management/schemes/${created.id}`);
  assert.equal(current.version, 2); assert.equal(current.configuration.feePaise, 1488800);
  const history = await request(`/v1/management/schemes/${created.id}/revisions`);
  assert.equal(history.length, 2); assert.equal(history.find((r: any) => r.version === 1).configuration.feePaise, 988800);
  console.log("PASS real persistence, exact paise, immutable snapshots and concurrent-edit conflicts");
  await request(`/v1/management/schemes/${created.id}`, "PATCH", { ...body, version: 2, status: "approved" }, 400);
  await request(`/v1/management/schemes/${created.id}`, "PATCH", { ...body, version: 2, status: "archived", name: "Unsaved edit" }, 400);
  const archived = await request(`/v1/management/schemes/${created.id}`, "PATCH", { ...body, version: 2, status: "archived" });
  await request(`/v1/management/schemes/${created.id}`, "PATCH", { ...body, version: archived.version, status: "archived" }, 409);
  const restored = await request(`/v1/management/schemes/${created.id}`, "PATCH", { ...body, version: archived.version, status: "draft" });
  assert.equal(restored.version, 4);
  await request("/v1/workspace/schemes/records", "POST", { title: "Bypass", data: {} }, 409);
  await request(`/v1/workspace/schemes/records/${created.id}`, "PATCH", { version: 4, status: "approved", reason: "Attempted bypass" }, 409);
  console.log("PASS archive/restore, retained versions and blocked approval/generic-editor bypasses");
  assert.equal((await db.select().from(workflowRecords).where(eq(workflowRecords.id, created.id)))[0]!.status, "draft");
  console.log("Four verification groups passed. No commercial activation or live payments occurred.");
} finally {
  await db.delete(auditEvents).where(inArray(auditEvents.recordId, ids));
  await db.delete(workflowRecords).where(inArray(workflowRecords.id, ids));
  await db.delete(roleGrants).where(inArray(roleGrants.userId, people.map(p => p.id)));
  await db.delete(platformUsers).where(inArray(platformUsers.id, people.map(p => p.id)));
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await pool.end();
}
