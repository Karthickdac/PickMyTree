import { getAuth, clerkClient } from "@clerk/express";
import type { Request, RequestHandler } from "express";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db, platformUsers, roleGrants, workflowRecords } from "@workspace/db";
import type { ModuleDefinition } from "./modules";

export class PlatformError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Actor = {
  id: string; authId: string; displayName: string; profile: Record<string, unknown>;
  grants: { role: string; scope: string }[]; recentMfa: boolean;
};
declare global {
  namespace Express { interface Request { actor?: Actor } }
}
export const identify: RequestHandler = async (req, _res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) throw new PlatformError(401, "Please sign in to continue.");
  let [user] = await db.select().from(platformUsers).where(eq(platformUsers.authId, auth.userId));
  if (!user) {
    const remote = await clerkClient.users.getUser(auth.userId);
    if (!remote.emailAddresses.some(e => e.verification?.status === "verified")) {
      throw new PlatformError(403, "Verify your email address before continuing.");
    }
    [user] = await db.insert(platformUsers).values({
      authId: auth.userId, displayName: remote.firstName || remote.username || "Tree adopter",
    }).onConflictDoNothing().returning();
    if (!user) [user] = await db.select().from(platformUsers).where(eq(platformUsers.authId, auth.userId));
  }
  if (!user) throw new PlatformError(500, "Could not initialize your profile.");
  const grants = await db.select({ role: roleGrants.role, scope: roleGrants.scope }).from(roleGrants).where(eq(roleGrants.userId, user.id));
  const fva = auth.sessionClaims?.fva;
  req.actor = { ...user, grants: [{ role: "customer", scope: user.id }, ...grants],
    recentMfa: Array.isArray(fva) && typeof fva[1] === "number" && fva[1] >= 0 && fva[1] <= 10 };
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
