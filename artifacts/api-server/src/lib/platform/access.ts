import type { Request, RequestHandler } from "express";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db, platformUsers, roleGrants, workflowRecords } from "@workspace/db";
import type { ModuleDefinition } from "./modules";
import { PlatformError } from "./errors";
import { hasRecentMfa } from "./mobile-identity";
export { PlatformError } from "./errors";
export type Actor = {
  id: string; authId: string; displayName: string; profile: Record<string, unknown>;
  grants: { role: string; scope: string }[]; recentMfa: boolean;
};
declare global {
  namespace Express { interface Request { actor?: Actor } }
}
export const identify: RequestHandler = async (req, _res, next) => {
  const identity = req.patSession?.mobileIdentity;
  if (!req.oidc?.isAuthenticated() || !identity || identity.subject !== req.oidc.user?.sub) {
    throw new PlatformError(401, "Please sign in with your mobile number to continue.");
  }
  const claims: Record<string, unknown> = req.oidc.idTokenClaims ?? {};
  if (typeof claims.iss !== "string") throw new PlatformError(401, "Please sign in again.");
  const authId = `${claims.iss}|${identity.subject}`;
  let [user] = await db.select().from(platformUsers).where(eq(platformUsers.authId, authId));
  if (!user) {
    [user] = await db.insert(platformUsers).values({
      authId, displayName: "Tree adopter", profile: { phone: identity.phone, language: "en" },
    }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(platformUsers).where(eq(platformUsers.authId, authId));
  }
  if (!user) throw new PlatformError(500, "Could not initialize your profile.");
  // Explicit owner allowlist, never "first visitor becomes admin". The configured
  // number must first complete Auth0's real SMS verification.
  const ownerPhone = process.env.PLATFORM_OWNER_PHONE?.replace(/[\s()-]/g, "");
  if (ownerPhone && /^\+[1-9]\d{6,14}$/.test(ownerPhone) && identity.phone === ownerPhone) {
    const { auditEvents } = await import("@workspace/db");
    await db.transaction(async tx => {
      const granted = await tx.insert(roleGrants).values({ userId: user!.id, role: "administrator", scope: "*", grantedBy: user!.id, reason: "Project-owner verified mobile allowlist" }).onConflictDoNothing().returning();
      if (granted.length) await tx.insert(auditEvents).values({ actorId: user!.id, action: "owner-access-granted", module: "access", reason: "Verified the explicitly configured project-owner mobile number" });
    });
  }
  const grants = await db.select({ role: roleGrants.role, scope: roleGrants.scope }).from(roleGrants).where(eq(roleGrants.userId, user.id));
  req.actor = { ...user, grants: [{ role: "customer", scope: user.id }, ...grants],
    recentMfa: hasRecentMfa(claims) };
  next();
};
export function actor(req: Request): Actor {
  if (!req.actor) throw new PlatformError(401, "Please sign in to continue.");
  return req.actor;
}
export function isAdmin(a: Actor): boolean {
  return a.grants.some(g => ["administrator", "super-administrator"].includes(g.role) && g.scope === "*");
}
export function can(a: Actor, roles: string[], farmId?: string | null): boolean {
  return a.grants.some(g => roles.includes(g.role) && (g.scope === "*" || (farmId && g.scope === farmId) || (g.role === "customer" && g.scope === a.id)));
}
export function requireMfa(a: Actor): void {
  if (!a.recentMfa) throw new PlatformError(403, "A recent second-factor verification is required for staff changes. Ask the platform owner to enable MFA before privileged use.");
}
export function visibleScope(a: Actor, m: ModuleDefinition): SQL {
  const conditions: SQL[] = [];
  for (const grant of a.grants.filter(g => m.roles.includes(g.role))) {
    if (grant.role === "customer") {
      conditions.push(eq(workflowRecords.customerId, a.id));
    } else if (grant.role === "farm-worker") {
      if (m.key === "tasks") conditions.push(eq(workflowRecords.assigneeId, a.id));
      else conditions.push(and(eq(workflowRecords.farmId, grant.scope), m.key === "updates" ? eq(workflowRecords.createdBy, a.id) : sql`true`)!);
    } else if (grant.scope === "*") {
      conditions.push(sql`true`);
    } else {
      conditions.push(m.key === "farms" ? eq(workflowRecords.id, grant.scope) : eq(workflowRecords.farmId, grant.scope));
    }
  }
  return or(...conditions) ?? sql`false`;
}
