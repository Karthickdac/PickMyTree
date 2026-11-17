import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, platformUsers, roleGrants, auditEvents } from "@workspace/db";
import { identify, isAdmin, requireMfa } from "../src/lib/platform/access";
import { normalizeOwnerPhone } from "../src/lib/platform/mobile-identity";

// Synthetic SDK contexts exist only in this standalone verification process.
// No live route, real phone number, SMS message or authentication bypass is used.
const runId = randomUUID();
const issuer = `https://owner-access-check.invalid/${runId}/`;
const ownerSubject = `sms|owner-${runId}`;
const customerSubject = `sms|customer-${runId}`;
const ownerPhone = "+919000000000";
const customerPhone = "+15550100102";
const userIds: string[] = [];

function request(subject: string, phone: string, authenticated = true): Request {
  return {
    patSession: { mobileIdentity: { subject, phone } },
    oidc: {
      isAuthenticated: () => authenticated,
      user: { sub: subject },
      idTokenClaims: { iss: issuer, sub: subject, amr: ["sms"] },
    },
  } as unknown as Request;
}

async function identifyRequest(req: Request) {
  let continued = false;
  await identify(req, {} as Response, () => { continued = true; });
  assert.equal(continued, true);
  assert.ok(req.actor);
  return req.actor;
}

async function main() {
  assert.equal(normalizeOwnerPhone(undefined), undefined);
  assert.equal(normalizeOwnerPhone(""), undefined);
  assert.equal(normalizeOwnerPhone("not a phone"), undefined);
  assert.equal(normalizeOwnerPhone("0000000000"), undefined);
  assert.equal(normalizeOwnerPhone("9000000000"), ownerPhone);
  assert.equal(normalizeOwnerPhone("+91 (90000) 00000"), ownerPhone);
  assert.equal(normalizeOwnerPhone("+1 (555) 010-0102"), customerPhone);
  console.log("PASS: local owner numbers normalize without changing verified identity rules");

  // This modifies only this test process, never the project's stored secret.
  process.env.PLATFORM_OWNER_PHONE = "9000000000";
  try {
    const seeded = await db.insert(platformUsers).values([
      { authId: `${issuer}|${ownerSubject}`, displayName: "Synthetic owner", profile: { phone: ownerPhone } },
      { authId: `${issuer}|${customerSubject}`, displayName: "Synthetic customer", profile: { phone: ownerPhone } },
    ]).returning({ id: platformUsers.id, authId: platformUsers.authId });
    userIds.push(...seeded.map(u => u.id));
    const ownerId = seeded.find(u => u.authId === `${issuer}|${ownerSubject}`)!.id;
    await db.insert(roleGrants).values({
      userId: ownerId, role: "administrator", scope: "*", grantedBy: ownerId,
      reason: "Synthetic existing administrator for upgrade verification",
    });

    await assert.rejects(() => identifyRequest(request(ownerSubject, ownerPhone, false)), { status: 401 });
    const mismatched = request(ownerSubject, ownerPhone);
    mismatched.oidc.user!.sub = customerSubject;
    await assert.rejects(() => identifyRequest(mismatched), { status: 401 });
    console.log("PASS: anonymous and mismatched SDK identities cannot receive owner access");

    const customer = await identifyRequest(request(customerSubject, customerPhone));
    assert.equal(isAdmin(customer), false);
    assert.equal(customer.grants.some(g => g.role === "super-administrator"), false);
    console.log("PASS: another verified number cannot gain access by changing its contact profile");

    const owner = await identifyRequest(request(ownerSubject, ownerPhone));
    assert.ok(owner.grants.some(g => g.role === "super-administrator" && g.scope === "*"));
    assert.equal(isAdmin(owner), true);
    assert.throws(() => requireMfa(owner), { status: 403 });
    console.log("PASS: the verified allowlisted owner upgrades to Super Admin without bypassing MFA");

    await Promise.all([
      identifyRequest(request(ownerSubject, ownerPhone)),
      identifyRequest(request(ownerSubject, ownerPhone)),
    ]);
    const grants = await db.select().from(roleGrants).where(and(
      eq(roleGrants.userId, ownerId), eq(roleGrants.role, "super-administrator"),
    ));
    const audits = await db.select().from(auditEvents).where(and(
      eq(auditEvents.actorId, ownerId), eq(auditEvents.action, "owner-access-granted"),
    ));
    assert.equal(grants.length, 1);
    assert.equal(audits.length, 1);
    assert.deepEqual(audits[0].after, { role: "super-administrator", scope: "*" });
    console.log("PASS: repeated requests preserve one durable grant and one audit event");
  } finally {
    if (userIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.actorId, userIds));
      await db.delete(roleGrants).where(inArray(roleGrants.userId, userIds));
      await db.delete(platformUsers).where(inArray(platformUsers.id, userIds));
    }
  }
}

try {
  await main();
} catch (error) {
  console.error("Owner-access verification failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  await pool.end();
}
