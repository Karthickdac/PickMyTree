import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, adoptionOrders, workflowRecords } from "@workspace/db";
import {
  GetAdoptionCheckoutParams, GetAdoptionCheckoutResponse, ReserveAdoptionBody, ReserveAdoptionResponse,
  GetAdoptionOrderParams, GetAdoptionOrderResponse, StartAdoptionPaymentParams, StartAdoptionPaymentResponse,
  VerifyAdoptionPaymentParams, VerifyAdoptionPaymentBody, VerifyAdoptionPaymentResponse,
} from "@workspace/api-zod";
import { actor, identify, PlatformError } from "../lib/platform/access";
import { treeInventory } from "./platform-public";
import { treeOffers, offerFromApproval, capacityUsed } from "../lib/platform/adoption-eligibility";
import { paymentAvailability, validSignature, verifyCheckoutSignature } from "../lib/platform/razorpay";
import { reserve, ownOrder, orderDTO, startPayment, checkPayment } from "../lib/platform/adoption-orders";

declare global { namespace Express { interface Request { rawPaymentBody?: Buffer } } }
const router: IRouter = Router();
router.get("/v1/adoption-checkout/:treeId", async (req, res): Promise<void> => {
  const { treeId } = GetAdoptionCheckoutParams.parse(req.params);
  const tree = (await treeInventory()).find(t => t.id === treeId);
  if (!tree) throw new PlatformError(404, "This tree is not publicly listed.");
  const [record] = await db.select().from(workflowRecords).where(eq(workflowRecords.id, treeId));
  const approvals = await treeOffers(record!);
  const payment = paymentAvailability(), offers = approvals.map(offerFromApproval);
  const blockers: string[] = [];
  if (!tree.adoptionEligible) blockers.push(offers.length ? "This tree's harvest allocation is currently reserved." : "This tree does not yet have current farm/tree verification and an approved scheme.");
  if (!payment.acceptingPayments) blockers.push(payment.mode === "live" ? "Live payment collection has not been enabled by the owner." : "Payment collection is not configured.");
  res.setHeader("Cache-Control", "no-store");
  res.json(GetAdoptionCheckoutResponse.parse({ tree, offers, payment, blockers }));
});
router.post("/v1/payments/razorpay/webhook", async (req, res): Promise<void> => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw new PlatformError(503, "Payment webhook verification is not configured.");
  if (!req.rawPaymentBody || !validSignature(req.rawPaymentBody, req.get("x-razorpay-signature") ?? "", process.env.RAZORPAY_WEBHOOK_SECRET)) throw new PlatformError(400, "Invalid payment webhook signature.");
  const payload = z.object({ event: z.string(), payload: z.unknown().optional() }).parse(req.body);
  if (["payment.captured", "order.paid"].includes(payload.event)) {
    const parsed = z.object({ payment: z.object({ entity: z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/), order_id: z.string().regex(/^order_[A-Za-z0-9]+$/) }) }) }).safeParse(payload.payload);
    if (parsed.success) {
      const p = parsed.data.payment.entity;
      const [order] = await db.select().from(adoptionOrders).where(eq(adoptionOrders.providerOrderId, p.order_id));
      if (order) await checkPayment(order, p.id);
    }
  }
  res.json({ received: true });
});
router.use("/v1/adoption-orders", identify, (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.post("/v1/adoption-orders", async (req, res): Promise<void> => {
  const a = actor(req), input = ReserveAdoptionBody.parse(req.body);
  const phone = req.patSession!.mobileIdentity!.phone;
  res.status(201).json(ReserveAdoptionResponse.parse(orderDTO(await reserve(a, phone, input))));
});
router.get("/v1/adoption-orders/:orderId", async (req, res): Promise<void> => {
  const { orderId } = GetAdoptionOrderParams.parse(req.params);
  let order = await ownOrder(orderId, actor(req).id);
  if (order.providerOrderId && !["active", "payment-review"].includes(order.state)) {
    // A provider outage does not erase a previously saved order. The persisted
    // pending state is returned honestly; background reconciliation also retries.
    try { order = await checkPayment(order); } catch { req.log.warn({ event: "adoption-status-refresh-delayed", orderId }, "Payment status refresh deferred"); }
  }
  res.json(GetAdoptionOrderResponse.parse(orderDTO(order)));
});
router.post("/v1/adoption-orders/:orderId/payment", async (req, res): Promise<void> => {
  const { orderId } = StartAdoptionPaymentParams.parse(req.params);
  res.json(StartAdoptionPaymentResponse.parse(await startPayment(orderId, actor(req).id)));
});
router.post("/v1/adoption-orders/:orderId/verify", async (req, res): Promise<void> => {
  const { orderId } = VerifyAdoptionPaymentParams.parse(req.params), input = VerifyAdoptionPaymentBody.parse(req.body);
  const order = await ownOrder(orderId, actor(req).id);
  if (!order.providerOrderId || order.providerOrderId !== input.providerOrderId || !verifyCheckoutSignature(order.providerOrderId, input.paymentId, input.signature)) throw new PlatformError(400, "Payment signature verification failed. No adoption has been confirmed.");
  res.json(VerifyAdoptionPaymentResponse.parse(orderDTO(await checkPayment(order, input.paymentId))));
});
export default router;
