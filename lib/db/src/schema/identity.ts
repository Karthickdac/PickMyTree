import { pgTable, text, uuid, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const platformUsers = pgTable("pat_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authId: text("auth_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  profile: jsonb("profile").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const roleGrants = pgTable("pat_role_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => platformUsers.id).notNull(),
  role: text("role").notNull(),
  scope: text("scope").notNull().default("*"),
  grantedBy: text("granted_by").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("pat_grant_unique").on(t.userId, t.role, t.scope)]);
export const insertPlatformUserSchema = createInsertSchema(platformUsers).omit({ id: true, createdAt: true, updatedAt: true });
export type PlatformUser = typeof platformUsers.$inferSelect;
