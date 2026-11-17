import { createHmac, timingSafeEqual } from "node:crypto";
import { PlatformError } from "./access";

export function paymentAvailability() {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  const mode = id?.startsWith("rzp_test_") && secret ? "test" : id?.startsWith("rzp_live_") && secret ? "live" : "unconfigured";
  return {
    configured: mode !== "unconfigured", mode,
    acceptingPayments: mode === "test" || (mode === "live" && process.env.PAYMENTS_LIVE_ENABLED === "true" && Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)),
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  } as { configured: boolean; mode: "test" | "live" | "unconfigured"; acceptingPayments: boolean; webhookConfigured: boolean };
}

export async function razorpayRequest<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  if (!paymentAvailability().configured) throw new PlatformError(503, "Razorpay credentials are not configured.");
  if (!/^\/(?:orders|payments)(?:[/?][A-Za-z0-9_?=&/-]*)?$/.test(path)) throw new PlatformError(500, "Invalid payment operation.");
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new PlatformError(503, "Razorpay did not respond. Check this order's status before trying another payment."); }
  if (!response.ok) {
    // Provider response bodies/headers may contain sensitive account details.
    throw new PlatformError(response.status === 401 ? 503 : 502,
      response.status === 401 ? "Razorpay could not authenticate the configured credentials. Ask the owner to check the matching key pair." : "Razorpay could not complete this operation. No adoption has been confirmed.");
  }
  return response.json() as Promise<T>;
}

export function validSignature(payload: string | Buffer, signature: string, secret: string | undefined): boolean {
  if (!secret || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function verifyCheckoutSignature(storedOrderId: string, paymentId: string, signature: string): boolean {
  return validSignature(`${storedOrderId}|${paymentId}`, signature, process.env.RAZORPAY_KEY_SECRET);
}
export type GatewayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
export type GatewayPayment = { id: string; order_id: string; amount: number; currency: string; status: string; captured: boolean; created_at: number };
