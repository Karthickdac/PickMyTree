import { pgTable, text, uuid, timestamp, jsonb, integer, index, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { platformUsers } from "./identity";

// Workflow documents are deliberately not adoption/payment/harvest ledgers.
// Commercial ledgers get dedicated constrained tables before activation.
export const workflowRecords = pgTable("pat_workflow_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  module: text("module").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  farmId: uuid("farm_id"),
  treeId: uuid("tree_id"),
  customerId: uuid("customer_id").references(() => platformUsers.id),
  assigneeId: uuid("assignee_id").references(() => platformUsers.id),
  createdBy: uuid("created_by").references(() => platformUsers.id),
  data: jsonb("data").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index("pat_module_status_idx").on(t.module, t.status),
  index("pat_farm_idx").on(t.farmId),
  index("pat_customer_idx").on(t.customerId),
  check("pat_positive_version", sql`${t.version} > 0`),
  uniqueIndex("pat_tree_code_unique").on(sql`(${t.data}->>'treeCode')`).where(sql`${t.module} = 'trees'`),
]);
export const auditEvents = pgTable("pat_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => platformUsers.id),
  action: text("action").notNull(),
  module: text("module").notNull(),
  recordId: uuid("record_id"),
  reason: text("reason").notNull(),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("pat_audit_record_idx").on(t.recordId, t.createdAt)]);
export const consentEvents = pgTable("pat_consent_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => platformUsers.id),
  recordId: uuid("record_id").references(() => workflowRecords.id),
  purpose: text("purpose").notNull(),
  version: text("version").notNull(),
  accepted: text("accepted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const insertWorkflowRecordSchema = createInsertSchema(workflowRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type WorkflowRecord = typeof workflowRecords.$inferSelect;
