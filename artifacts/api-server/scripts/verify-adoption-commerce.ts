import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler } from "express";
import { and, eq, count } from "drizzle-orm";
import { db, pool, platformUsers, roleGrants, workflowRecords, catalogueImages, adoptionOrders, adoptionApprovals, auditEvents } from "@workspace/db";
import approvals from "../src/routes/adoption-approvals";
import checkout from "../src/routes/adoption-checkout";
import schemes from "../src/routes/scheme-management";
import account from "../src/routes/platform-account";
import { PlatformError } from "../src/lib/platform/errors";
import { paymentAvailability, validSignature } from "../src/lib/platform/razorpay";
import { applyCapturedPayment, ownOrder } from "../src/lib/platform/adoption-orders";
import { currentApproval, treeOffers } from "../src/lib/platform/adoption-eligibility";
import { safeAuthReturnTo } from "../src/middlewares/auth0";
import { logger } from "../src/lib/logger";

// Tests run in a disposable, private PostgreSQL schema. They cannot publish fake
// approvals or photos in the real catalogue. No authentication bypass is added
// to the running app. Only one unpaid Razorpay Test Mode order is created.
assert.equal(paymentAvailability().mode, "test", "This verification requires Razorpay Test Mode. Live operations are forbidden.");
const schema = `verification_${randomUUID().replaceAll("-", "")}`;
const admin = await pool.connect();
const names = await admin.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ~ '^pat_[a-z0-9_]+$'");
await admin.query(`CREATE SCHEMA "${schema}"`);
for (const { tablename } of names.rows) await admin.query(`CREATE TABLE "${schema}"."${tablename}" (LIKE public."${tablename}" INCLUDING ALL)`);
await admin.query(`CREATE SEQUENCE "${schema}".review_sequence`);
await admin.query(`ALTER TABLE "${schema}".pat_adoption_approvals ALTER COLUMN review_sequence SET DEFAULT nextval('"${schema}".review_sequence')`);
pool.options.options = `${pool.options.options ?? ""} -c search_path=${schema},public`.trim();
assert.equal((await pool.query("SELECT current_schema() AS name")).rows[0].name, schema, "Verification must never write to the public schema.");
const app = express();
app.use(express.json());
const people = ["editor", "reviewer", "customer", "other", "no-mfa"].map((key, n) => ({
  key, id: randomUUID(), phone: `+91900000100${n}`, subject: `sms|isolated-${schema}-${key}`,
  role: key === "editor" ? "super-administrator" : ["reviewer", "no-mfa"].includes(key) ? "administrator" : "customer",
}));
app.use((req, _res, next) => {
  const person = people.find(p => p.key === req.get("x-isolated-persona"));
  if (person) {
    req.oidc = { isAuthenticated: () => true, user: { sub: person.subject },
      idTokenClaims: { iss: "https://verification.invalid/", sub: person.subject, amr: person.key === "no-mfa" ? ["sms"] : ["sms", "mfa"], auth_time: Math.floor(Date.now() / 1000) } } as never;
    req.patSession = { mobileIdentity: { subject: person.subject, phone: person.phone } };
  }
  req.log = logger;
  next();
});
app.use("/api", approvals, checkout, schemes, account);
const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error instanceof PlatformError ? error.status : error?.name === "ZodError" ? 400 : 500)
    .json({ error: error instanceof PlatformError ? error.message : "Invalid request" });
};
app.use(errors);
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address(); assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api`;
async function request(path: string, method = "GET", body?: unknown, expected = 200, persona = "reviewer"): Promise<any> {
  const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", "x-isolated-persona": persona }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: expected HTTP ${expected}, received ${response.status}`);
  return result;
}
const editor = people[0]!;
const farmId = randomUUID(), treeId = randomUUID(), schemeId = randomUUID();
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const configuration = {
  description: "A private verification agreement", species: "Mango", variety: "Neelum", farmId, treeIds: [treeId],
  durationMonths: 12, feePaise: 988800, taxBps: 500, allocationType: "exclusive-harvest", quantity: null,
  unit: "kg", sharePercent: 100, maxAdopters: 1, enrollmentStart: null, enrollmentEnd: null,
  season: "Annual harvest", roundingRule: "down", qualityGrades: "As accepted in this verification agreement",
  lossRules: "Actual crop loss is measured and reported", fulfilmentMethods: ["pickup", "delivery", "sale-settlement"],
  deliveryFeePaise: 15000, deliveryRegions: "Dindigul", fulfilmentPolicy: "Delivery, pickup or actual sale settlement by agreement",
  inclusions: "Harvest share", exclusions: "No land ownership", risks: "Actual harvest depends on growing conditions",
  shortfallPolicy: "Apply the stated shortfall remedy", cancellationPolicy: "Apply the reviewed cancellation remedy",
  renewalPolicy: "No automatic renewal", agreementVersion: "verification-1", terms: "Explicitly accepted immutable agreement",
  legalReviewReference: "Private verification fixture, never a public offer",
};
try {
  for (const p of people) {
    await db.insert(platformUsers).values({ id: p.id, authId: `https://verification.invalid/|${p.subject}`, displayName: "Private verification" });
    await db.insert(roleGrants).values({ userId: p.id, role: p.role, scope: "*", grantedBy: p.id, reason: "Isolated schema verification" });
  }
  const imageIds = [randomUUID(), randomUUID()];
  await db.insert(catalogueImages).values(imageIds.map(id => ({ id, ownerId: editor.id, name: "Private verification photo", status: "ready", contentType: "image/webp", byteSize: 100, objectPath: "/private-verification-only", isIllustrative: false })));
  await db.insert(workflowRecords).values([
    { id: farmId, module: "farms", title: "Private verification orchard", status: "listed", createdBy: editor.id, data: { imageIds } },
    { id: treeId, module: "trees", title: "Private verification Neelum", status: "listed", farmId, createdBy: editor.id, data: { imageIds, treeCode: `PAT-${randomUUID().slice(0, 8)}`, species: "Mango", variety: "Neelum" } },
    { id: schemeId, module: "schemes", title: "Private verification harvest", status: "draft", createdBy: editor.id, data: { configuration } },
  ]);
  const decision = (recordId: string) => ({ recordId, version: 1, decision: "approve", reason: "Actually reviewed the private verification fixture and exact revision", evidenceReference: "Private verification record", validUntil: day(365), inspectedOn: day(-1), qualification: "Private verification inspector", attested: true });
  await request("/v1/management/adoption-readiness", "GET", undefined, 401, "");
  await request("/v1/management/adoption-readiness", "GET", undefined, 403, "customer");
  await request("/v1/management/adoption-approvals", "POST", decision(farmId), 403, "no-mfa");
  await request("/v1/management/adoption-approvals", "POST", { ...decision(farmId), version: 99 }, 409);
  await request("/v1/management/adoption-approvals", "POST", { ...decision(farmId), validUntil: "2027-02-30" }, 400);
  await request("/v1/management/adoption-approvals", "POST", decision(farmId), 403, "editor");
  await request("/v1/management/adoption-approvals", "POST", decision(treeId), 409);
  await request("/v1/management/adoption-approvals", "POST", decision(farmId));
  await request("/v1/management/adoption-approvals", "POST", decision(treeId));
  await request("/v1/management/adoption-approvals", "POST", decision(schemeId));
  const [scheme] = await db.select().from(workflowRecords).where(eq(workflowRecords.id, schemeId));
  const approval = (await currentApproval(scheme!))!;
  assert(approval);
  console.log("PASS private-schema review permissions, recent second factor, reviewer separation, dates, versions and dependency order");
  await request(`/v1/management/schemes/${schemeId}`, "PATCH", { name: scheme!.title, configuration, version: 1, status: "draft", reason: "Attempted approved-term rewrite" }, 409, "editor");
  const input = { treeId, offerId: approval.id, idempotencyKey: randomUUID(), fulfilment: "delivery", name: "Private verification customer", deliveryAddress: "Private verification address", acceptedTerms: true, totalPaise: 1 };
  await request("/v1/adoption-orders", "POST", { ...input, acceptedTerms: false }, 400, "customer");
  const races = await Promise.all(["customer", "other"].map(persona => fetch(base + "/v1/adoption-orders", { method: "POST", headers: { "Content-Type": "application/json", "x-isolated-persona": persona }, body: JSON.stringify({ ...input, idempotencyKey: randomUUID() }) }).then(async response => ({ persona, status: response.status, data: await response.json() }))));
  assert.deepEqual(races.map(r => r.status).sort(), [201, 409]);
  const winner = races.find(r => r.status === 201)!, orderId = winner.data.id;
  assert.equal(winner.data.totalPaise, 1053240);
  const original = await ownOrder(orderId, people.find(p => p.key === winner.persona)!.id);
  const replayInput = { ...input, idempotencyKey: original.idempotencyKey };
  assert.equal((await request("/v1/adoption-orders", "POST", replayInput, 201, winner.persona)).id, orderId);
  await request("/v1/adoption-orders", "POST", { ...replayInput, name: "Changed request" }, 409, winner.persona);
  await request(`/v1/adoption-orders/${orderId}`, "GET", undefined, 404, winner.persona === "customer" ? "other" : "customer");
  console.log("PASS single-winner reservation races, capacity, server-owned totals, explicit consent, request idempotency and order privacy");
  const payment = await request(`/v1/adoption-orders/${orderId}/payment`, "POST", undefined, 200, winner.persona);
  const repeated = await request(`/v1/adoption-orders/${orderId}/payment`, "POST", undefined, 200, winner.persona);
  assert.equal(payment.providerOrderId, repeated.providerOrderId);
  assert.equal(payment.amount, 1053240);
  const proof = { paymentId: "pay_UncapturedVerification", providerOrderId: payment.providerOrderId, signature: "0".repeat(64) };
  await request(`/v1/adoption-orders/${orderId}/verify`, "POST", proof, 400, winner.persona);
  const validForMissingPayment = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${payment.providerOrderId}|${proof.paymentId}`).digest("hex");
  await request(`/v1/adoption-orders/${orderId}/verify`, "POST", { ...proof, signature: validForMissingPayment }, 502, winner.persona);
  const held = await ownOrder(orderId, original.customerId);
  assert.equal(held.state, "payment-pending"); assert.equal(held.paymentId, null);
  console.log("PASS one real unpaid Razorpay Test Mode order, replay-safe setup and rejection of invalid signatures or nonexistent provider payments");
  // Domain tests below simulate a TRUSTED provider response only. They do not
  // claim a real gateway payment occurred; all resulting rows remain isolated.
  const captured = { id: "pay_UnitCapturedVerification", order_id: payment.providerOrderId, amount: held.totalPaise, currency: "INR", status: "captured", captured: true, created_at: Math.floor(Date.now() / 1000) };
  await assert.rejects(() => applyCapturedPayment(held, { ...captured, amount: 1 }));
  const activated = await applyCapturedPayment(held, captured);
  assert.equal(activated.state, "active"); assert(activated.endsAt && activated.activatedAt);
  assert.equal((await applyCapturedPayment(held, captured)).id, activated.id);
  const [activationCount] = await db.select({ n: count() }).from(auditEvents).where(and(eq(auditEvents.recordId, held.id), eq(auditEvents.action, "adoption-activated")));
  assert.equal(activationCount!.n, 1);
  const dashboard = await request("/v1/me/dashboard", "GET", undefined, 200, winner.persona);
  assert.equal(dashboard.adoptions[0].id, orderId);
  const lateId = randomUUID();
  await db.insert(adoptionOrders).values({ ...held, id: lateId, idempotencyKey: randomUUID(), providerOrderId: "order_UnitLateVerification", paymentId: null, state: "payment-pending", expiresAt: new Date(Date.now() - 60000) });
  const late = (await db.select().from(adoptionOrders).where(eq(adoptionOrders.id, lateId)))[0]!;
  const lateResult = await applyCapturedPayment(late, { ...captured, id: "pay_UnitLateVerification", order_id: late.providerOrderId! });
  assert.equal(lateResult.state, "payment-review"); assert.equal(lateResult.activatedAt, null);
  console.log("PASS simulated capture activation, duplicate-event idempotency, wrong-amount rejection, customer dashboard and late-payment review");
  await request(`/v1/management/schemes/${schemeId}`, "PATCH", { name: scheme!.title, configuration, version: 1, status: "archived", reason: "Archived reviewed offer without rewriting accepted contracts" }, 200, "editor");
  const afterArchive = await ownOrder(orderId, original.customerId);
  assert.equal(afterArchive.agreement.feePaise, 988800);
  assert.deepEqual(afterArchive.agreement, held.agreement);
  const tree = (await db.select().from(workflowRecords).where(eq(workflowRecords.id, treeId)))[0]!;
  assert.equal((await treeOffers(tree)).length, 0);
  const signed = createHmac("sha256", "ephemeral-verification-key").update("original body").digest("hex");
  assert(validSignature(Buffer.from("original body"), signed, "ephemeral-verification-key"));
  assert(!validSignature(Buffer.from("changed body"), signed, "ephemeral-verification-key"));
  assert.equal(safeAuthReturnTo("https://untrusted.invalid/"), "/portal");
  assert.equal(safeAuthReturnTo(`//untrusted.invalid/checkout/${treeId}`), "/portal");
  assert.equal(safeAuthReturnTo(`/checkout/${treeId}`), `/checkout/${treeId}`);
  console.log("PASS immutable accepted agreements, archive eligibility, raw-byte HMAC checks and safe sign-in continuation");
  console.log("Five verification groups passed. No live charges, real captures or public catalogue changes occurred.");
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  admin.release();
  await pool.end();
}
