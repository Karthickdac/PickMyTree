import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, platformUsers, workflowRecords, auditEvents, consentEvents } from "@workspace/db";
import { GetMeResponse, UpdateProfileBody, UpdateProfileResponse, GetCustomerDashboardResponse } from "@workspace/api-zod";
import { identify, actor } from "../lib/platform/access";
const router: IRouter = Router();
function profileResponse(a: ReturnType<typeof actor>) {
  return { id: a.id, displayName: a.displayName, roles: [...new Set(a.grants.map(g => g.role))], profile: a.profile };
}
router.get("/v1/me", identify, (req, res) => { res.json(GetMeResponse.parse(profileResponse(actor(req)))); });
router.patch("/v1/me/profile", identify, async (req, res): Promise<void> => {
  const a = actor(req), input = UpdateProfileBody.parse(req.body);
  const profile = { ...a.profile, ...input };
  const name = input.displayName?.trim() || a.displayName;
  await db.transaction(async tx => {
    await tx.update(platformUsers).set({ displayName: name, profile, updatedAt: new Date() }).where(eq(platformUsers.id, a.id));
    for (const key of ["emailNotifications", "smsNotifications", "whatsappNotifications"] as const) {
      if (input[key] !== undefined && input[key] !== a.profile[key]) {
        await tx.insert(consentEvents).values({ userId: a.id, purpose: key, version: "notification-preferences-1", accepted: String(input[key]) });
      }
    }
    await tx.insert(auditEvents).values({ actorId: a.id, action: "profile-updated", module: "profile", recordId: a.id, reason: "Customer updated profile or channel preferences", before: null, after: { changedFields: Object.keys(input) } });
  });
  res.json(UpdateProfileResponse.parse(profileResponse({ ...a, displayName: name, profile })));
});
router.get("/v1/me/dashboard", identify, async (req, res): Promise<void> => {
  const a = actor(req);
  const records = await db.select().from(workflowRecords).where(eq(workflowRecords.customerId, a.id));
  const list = (module: string) => records.filter(r => r.module === module).map(r => ({ id: r.id, title: r.title, status: r.status, version: r.version, createdAt: r.createdAt.toISOString(), data: r.data }));
  res.json(GetCustomerDashboardResponse.parse({ adoptions: [], harvests: [], orders: [], notifications: list("notifications"), tickets: list("tickets") }));
});
export default router;
