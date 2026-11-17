import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db, workflowRecords, adoptionApprovals, adoptionOrders, auditEvents, type AdoptionOrderRecord } from "@workspace/db";
import { CreateManagedSchemeBody, GetAdoptionOrderResponse, ReserveAdoptionBody } from "@workspace/api-zod";
import type { z } from "zod";
import { PlatformError, type Actor } from "./access";
import { capacityUsed, offerFromApproval, treeOffers } from "./adoption-eligibility";
import { paymentAvailability, razorpayRequest, type GatewayOrder, type GatewayPayment } from "./razorpay";
import { logger } from "../logger";

export const commerceLock = sql`SELECT pg_advisory_xact_lock(73421891)`;
export function orderDTO(row: AdoptionOrderRecord) {
  const agreement = row.agreement;
  const expired = row.expiresAt.valueOf() <= Date.now() && ["reserved", "creating-payment", "payment-pending"].includes(row.state);
  const status = expired ? "expired" : row.state;
  const message = status === "active" ? (row.mode === "test" ? "The payment simulation was verified. No live adoption or real charge was created." : "Payment was verified and your adoption is active.") :
    status === "payment-review" ? (row.paymentId ? "Payment was received, but this adoption needs staff review. Do not pay again. Contact support with this order reference." : "Payment setup needs review. No adoption has been confirmed. Check with support before creating another payment.") :
    status === "expired" ? "This reservation has expired. If a payment was completed, check its status before starting another order." :
    "Your tree allocation is held until the displayed expiry. Adoption is confirmed only after server verification of captured payment.";
  return GetAdoptionOrderResponse.parse({
    id: row.id, treeId: row.treeId, treeName: row.treeSnapshot.name, treeCode: row.treeSnapshot.treeCode,
    schemeName: agreement.name, schemeVersion: agreement.version, status,
    feePaise: row.feePaise, taxPaise: row.taxPaise, deliveryFeePaise: row.deliveryFeePaise, totalPaise: row.totalPaise,
    fulfilment: row.fulfilment, expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(),
    activatedAt: row.activatedAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null,
    paymentId: row.paymentId, paymentMode: row.mode, agreement, message,
  });
}
export async function ownOrder(id: string, customerId: string) {
  const [row] = await db.select().from(adoptionOrders).where(and(eq(adoptionOrders.id, id), eq(adoptionOrders.customerId, customerId)));
  if (!row) throw new PlatformError(404, "Adoption order not found.");
  return row;
}
export async function reserve(a: Actor, verifiedPhone: string, input: z.infer<typeof ReserveAdoptionBody>) {
  const availability = paymentAvailability();
  if (!availability.acceptingPayments || availability.mode === "unconfigured") throw new PlatformError(503, "Payment collection is not enabled. No reservation or order was created.");
  if (!input.acceptedTerms || input.name.trim().length < 2) throw new PlatformError(400, "Enter your name and explicitly accept the displayed scheme agreement.");
  if (input.fulfilment === "delivery" && (input.deliveryAddress?.trim().length ?? 0) < 10) throw new PlatformError(400, "Enter the complete delivery address.");
  return db.transaction(async tx => {
    await tx.execute(commerceLock);
    const [existing] = await tx.select().from(adoptionOrders).where(and(eq(adoptionOrders.customerId, a.id), eq(adoptionOrders.idempotencyKey, input.idempotencyKey)));
    if (existing) {
      if (existing.treeId !== input.treeId || existing.approvalId !== input.offerId || existing.fulfilment !== input.fulfilment ||
        existing.customerName !== input.name.trim() || existing.deliveryAddress !== (input.fulfilment === "delivery" ? input.deliveryAddress!.trim() : "")) throw new PlatformError(409, "This request reference was already used for different checkout details.");
      return existing;
    }
    const [tree] = await tx.select().from(workflowRecords).where(and(eq(workflowRecords.id, input.treeId), eq(workflowRecords.module, "trees"))).for("update");
    if (!tree) throw new PlatformError(404, "Tree not found.");
    const approval = (await treeOffers(tree, tx)).find(offer => offer.id === input.offerId);
    if (!approval) throw new PlatformError(409, "This approved scheme or tree is no longer available. Reload the current offers.");
    const offer = offerFromApproval(approval), c = CreateManagedSchemeBody.parse({ name: approval.snapshot.name, configuration: approval.snapshot.configuration }).configuration;
    if (!offer.fulfilmentMethods.includes(input.fulfilment)) throw new PlatformError(400, "Choose an allowed harvest fulfilment option.");
    const used = await capacityUsed(tree.id, availability.mode, tx);
    const capacityBps = c.allocationType === "fixed-quantity" ? Math.ceil(10000 / c.maxAdopters) : c.allocationType === "exclusive-harvest" ? 10000 : Math.ceil(c.sharePercent * 100);
    if (used.reduce((total, o) => total + o.capacityBps, 0) + capacityBps > 10000 ||
      used.filter(o => o.approvalId === approval.id).length >= c.maxAdopters) throw new PlatformError(409, "This tree's harvest allocation is currently reserved. Please choose another available tree.");
    const taxPaise = Math.round(c.feePaise * c.taxBps / 10000), deliveryFeePaise = input.fulfilment === "delivery" ? c.deliveryFeePaise : 0;
    const [order] = await tx.insert(adoptionOrders).values({
      id: randomUUID(), customerId: a.id, treeId: tree.id, approvalId: approval.id, idempotencyKey: input.idempotencyKey,
      state: "reserved", mode: availability.mode, capacityBps, feePaise: c.feePaise, taxPaise, deliveryFeePaise,
      totalPaise: c.feePaise + taxPaise + deliveryFeePaise, fulfilment: input.fulfilment,
      customerName: input.name.trim(), verifiedPhone, deliveryAddress: input.fulfilment === "delivery" ? input.deliveryAddress!.trim() : "",
      treeSnapshot: { name: tree.title, treeCode: tree.data.treeCode, farmId: tree.farmId, sourceVersion: tree.version },
      agreement: { ...offer }, expiresAt: new Date(Date.now() + 10 * 60_000),
    }).returning();
    await tx.insert(auditEvents).values({ actorId: a.id, module: "adoptions", recordId: order!.id,
      action: "adoption-reserved", reason: "Customer accepted this exact approved scheme version and price",
      after: { treeId: tree.id, approvalId: approval.id, totalPaise: order!.totalPaise, mode: availability.mode } });
    return order!;
  });
}

export async function startPayment(id: string, customerId: string) {
  let create = false;
  let order = await db.transaction(async tx => {
    await tx.execute(commerceLock);
    const [row] = await tx.select().from(adoptionOrders).where(and(eq(adoptionOrders.id, id), eq(adoptionOrders.customerId, customerId))).for("update");
    if (!row) throw new PlatformError(404, "Adoption order not found.");
    const payment = paymentAvailability();
    if (!payment.acceptingPayments || row.mode !== payment.mode) throw new PlatformError(503, "This payment environment is not enabled for the reserved order.");
    if (row.state === "active" || row.state === "payment-review" || row.state === "expired" || row.expiresAt.valueOf() <= Date.now()) throw new PlatformError(409, "This order cannot start another payment. Check its current status.");
    if (row.providerOrderId) return row;
    if (row.state === "creating-payment") throw new PlatformError(409, "Payment setup is already being processed. Check this order's status; do not create a second payment.");
    create = true;
    const [changed] = await tx.update(adoptionOrders).set({ state: "creating-payment", updatedAt: new Date() }).where(eq(adoptionOrders.id, id)).returning();
    return changed!;
  });
  if (create) {
    try {
      const external = await razorpayRequest<GatewayOrder>("/orders", { amount: order.totalPaise, currency: "INR", receipt: `PAT${order.id.replaceAll("-", "")}`, notes: { adoption_order_id: order.id } });
      if (!/^order_[A-Za-z0-9]+$/.test(external.id) || external.amount !== order.totalPaise || external.currency !== "INR") throw new PlatformError(502, "Razorpay returned an inconsistent order. Contact support before paying.");
      [order] = await db.update(adoptionOrders).set({ providerOrderId: external.id, state: "payment-pending", updatedAt: new Date() }).where(eq(adoptionOrders.id, order.id)).returning() as [AdoptionOrderRecord];
    } catch (error) {
      await db.update(adoptionOrders).set({ state: "payment-review", updatedAt: new Date() }).where(eq(adoptionOrders.id, order.id));
      throw error;
    }
  }
  return { keyId: process.env.RAZORPAY_KEY_ID!, providerOrderId: order.providerOrderId!, amount: order.totalPaise,
    currency: "INR", name: order.customerName, contact: order.verifiedPhone, order: orderDTO(order) };
}

function endOfTerm(start: Date, months: number) {
  const result = new Date(start), day = result.getUTCDate();
  result.setUTCDate(1); result.setUTCMonth(result.getUTCMonth() + months);
  const end = new Date(result); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0);
  result.setUTCDate(Math.min(day, end.getUTCDate())); return result;
}
export async function applyCapturedPayment(order: AdoptionOrderRecord, payment: GatewayPayment) {
  return db.transaction(async tx => {
    await tx.execute(commerceLock);
    const [current] = await tx.select().from(adoptionOrders).where(eq(adoptionOrders.id, order.id)).for("update");
    if (!current) throw new PlatformError(404, "Adoption order not found.");
    if (current.state === "active") {
      if (current.paymentId !== payment.id) throw new PlatformError(409, "This order already has a recorded payment.");
      return current;
    }
    if (current.state === "payment-review" && current.paymentId === payment.id) return current;
    if (payment.order_id !== current.providerOrderId || payment.amount !== current.totalPaise || payment.currency !== "INR" || payment.status !== "captured" || payment.captured !== true) {
      throw new PlatformError(409, "Payment has not been captured for the exact reserved order and amount. No adoption has been activated.");
    }
    const [tree] = await tx.select().from(workflowRecords).where(eq(workflowRecords.id, current.treeId)).for("update");
    const available = tree && (await treeOffers(tree, tx)).some(a => a.id === current.approvalId);
    const used = await capacityUsed(current.treeId, current.mode, tx, current.id);
    const inTime = Number.isFinite(payment.created_at) && payment.created_at * 1000 <= current.expiresAt.valueOf();
    const canActivate = available && inTime && used.reduce((sum, other) => sum + other.capacityBps, 0) + current.capacityBps <= 10000;
    const now = new Date();
    const [changed] = await tx.update(adoptionOrders).set({
      state: canActivate ? "active" : "payment-review", paymentId: payment.id,
      activatedAt: canActivate ? now : null,
      endsAt: canActivate ? endOfTerm(now, Number(current.agreement.durationMonths)) : null,
      updatedAt: now, lastCheckedAt: now,
    }).where(eq(adoptionOrders.id, current.id)).returning();
    await tx.insert(auditEvents).values({ actorId: current.customerId, module: "adoptions", recordId: current.id,
      action: canActivate ? "adoption-activated" : "captured-payment-needs-review",
      reason: canActivate ? "Server verified the captured payment, accepted scheme version and available tree capacity" : "Captured payment requires review because the hold, verification or capacity changed",
      after: { paymentId: payment.id, totalPaise: current.totalPaise, mode: current.mode } });
    return changed!;
  });
}
export async function checkPayment(order: AdoptionOrderRecord, paymentId?: string) {
  if (!order.providerOrderId || order.state === "active" || order.mode !== paymentAvailability().mode) return order;
  const payment = paymentId ? await razorpayRequest<GatewayPayment>(`/payments/${paymentId}`) :
    (await razorpayRequest<{ items: GatewayPayment[] }>(`/orders/${order.providerOrderId}/payments`)).items.find(p => p.status === "captured" || p.status === "authorized");
  if (!payment) return order;
  if (!/^pay_[A-Za-z0-9]+$/.test(payment.id) || payment.order_id !== order.providerOrderId || payment.amount !== order.totalPaise || payment.currency !== "INR") {
    throw new PlatformError(409, "The provider payment does not match this order.");
  }
  let confirmed = payment;
  if (payment.status === "authorized" && paymentAvailability().acceptingPayments) {
    if (order.expiresAt.valueOf() <= Date.now()) return order;
    const allowed = await db.transaction(async tx => {
      await tx.execute(commerceLock);
      const [tree] = await tx.select().from(workflowRecords).where(eq(workflowRecords.id, order.treeId));
      if (!tree || !(await treeOffers(tree, tx)).some(a => a.id === order.approvalId)) return false;
      const used = await capacityUsed(order.treeId, order.mode, tx, order.id);
      return used.reduce((sum, other) => sum + other.capacityBps, 0) + order.capacityBps <= 10000;
    });
    if (!allowed) return order;
    confirmed = await razorpayRequest<GatewayPayment>(`/payments/${payment.id}/capture`, { amount: order.totalPaise, currency: "INR" });
  }
  return confirmed.status === "captured" ? applyCapturedPayment(order, confirmed) : order;
}
let reconciling = false;
export async function reconcilePendingPayments() {
  if (reconciling || !paymentAvailability().configured) return;
  reconciling = true;
  try {
    const pending = await db.select().from(adoptionOrders).where(and(
      inArray(adoptionOrders.state, ["payment-pending", "payment-review"]), eq(adoptionOrders.mode, paymentAvailability().mode),
      isNotNull(adoptionOrders.providerOrderId), isNull(adoptionOrders.paymentId),
      gt(adoptionOrders.createdAt, new Date(Date.now() - 7 * 86400_000)),
    )).orderBy(sql`${adoptionOrders.lastCheckedAt} ASC NULLS FIRST`, desc(adoptionOrders.createdAt)).limit(10);
    for (const order of pending) {
      if (!order.providerOrderId || order.paymentId || order.createdAt.valueOf() < Date.now() - 7 * 86400_000) continue;
      try { await checkPayment(order); } catch { logger.warn({ event: "adoption-payment-reconciliation-delayed", orderId: order.id }, "Provider reconciliation will be retried"); }
      await db.update(adoptionOrders).set({ lastCheckedAt: new Date() }).where(eq(adoptionOrders.id, order.id));
    }
  } finally { reconciling = false; }
}
