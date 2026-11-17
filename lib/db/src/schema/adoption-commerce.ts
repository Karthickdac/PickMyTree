import { pgTable, uuid, text, integer, bigserial, jsonb, timestamp, date, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { platformUsers } from "./identity";
import { workflowRecords } from "./records";

// Append-only review snapshots. Never use public catalogue photos as private
// ownership documents; evidenceReference points to the reviewed external record.
export const adoptionApprovals = pgTable("pat_adoption_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  reviewSequence: bigserial("review_sequence", { mode: "number" }).notNull().unique(),
  recordId: uuid("record_id").notNull().references(() => workflowRecords.id),
  sourceVersion: integer("source_version").notNull(),
  kind: text("kind").notNull(),
  decision: text("decision").notNull(),
  reviewerId: uuid("reviewer_id").notNull().references(() => platformUsers.id),
  reason: text("reason").notNull(),
  evidenceReference: text("evidence_reference").notNull().default(""),
  validUntil: date("valid_until", { mode: "string" }),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index("pat_approval_record_idx").on(t.recordId, t.createdAt),
  check("pat_approval_decision", sql`${t.decision} IN ('approve','revoke')`),
  check("pat_approval_kind", sql`${t.kind} IN ('farms','trees','schemes')`),
]);

export const adoptionOrders = pgTable("pat_adoption_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => platformUsers.id),
  treeId: uuid("tree_id").notNull().references(() => workflowRecords.id),
  approvalId: uuid("approval_id").notNull().references(() => adoptionApprovals.id),
  idempotencyKey: uuid("idempotency_key").notNull(),
  state: text("state").notNull().default("reserved"),
  mode: text("mode").notNull(),
  capacityBps: integer("capacity_bps").notNull(),
  feePaise: integer("fee_paise").notNull(),
  taxPaise: integer("tax_paise").notNull(),
  deliveryFeePaise: integer("delivery_fee_paise").notNull(),
  totalPaise: integer("total_paise").notNull(),
  fulfilment: text("fulfilment").notNull(),
  customerName: text("customer_name").notNull(),
  verifiedPhone: text("verified_phone").notNull(),
  deliveryAddress: text("delivery_address").notNull().default(""),
  treeSnapshot: jsonb("tree_snapshot").$type<Record<string, unknown>>().notNull(),
  agreement: jsonb("agreement").$type<Record<string, unknown>>().notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
  providerOrderId: text("provider_order_id"),
  paymentId: text("payment_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  uniqueIndex("pat_adoption_idempotency").on(t.customerId, t.idempotencyKey),
  uniqueIndex("pat_adoption_provider_order").on(t.providerOrderId),
  uniqueIndex("pat_adoption_payment").on(t.paymentId),
  index("pat_adoption_tree_state").on(t.treeId, t.state, t.expiresAt),
  index("pat_adoption_customer").on(t.customerId, t.createdAt),
  check("pat_adoption_capacity", sql`${t.capacityBps} > 0 AND ${t.capacityBps} <= 10000`),
  check("pat_adoption_amount", sql`${t.totalPaise} > 0 AND ${t.totalPaise} = ${t.feePaise} + ${t.taxPaise} + ${t.deliveryFeePaise}`),
  check("pat_adoption_state", sql`${t.state} IN ('reserved','creating-payment','payment-pending','active','expired','payment-review')`),
  check("pat_adoption_mode", sql`${t.mode} IN ('test','live')`),
]);
export const insertAdoptionApprovalSchema = createInsertSchema(adoptionApprovals).omit({ id: true, createdAt: true });
export const insertAdoptionOrderSchema = createInsertSchema(adoptionOrders).omit({ id: true, createdAt: true, updatedAt: true });
export type AdoptionApproval = typeof adoptionApprovals.$inferSelect;
export type AdoptionOrderRecord = typeof adoptionOrders.$inferSelect;
