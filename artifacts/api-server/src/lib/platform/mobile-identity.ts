import { PlatformError } from "./errors";

export type MobileIdentity = { subject: string; phone: string };

// Only for the private owner allowlist. Auth0 identities must remain verified
// E.164 numbers; Indian owner configuration may use its local mobile format.
export function normalizeOwnerPhone(value: string | undefined): string | undefined {
  const phone = value?.replace(/[\s()-]/g, "");
  if (!phone) return undefined;
  if (/^[6-9]\d{9}$/.test(phone)) return `+91${phone}`;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : undefined;
}

// These inputs must only come from the Auth0 SDK's validated callback context.
// An SMS OTP is one factor, not privileged-role MFA.
export function verifiedMobileIdentity(
  tokenUser: Record<string, unknown>,
  userInfo: Record<string, unknown>,
): MobileIdentity {
  const subject = tokenUser.sub;
  if (typeof subject !== "string" || !subject.startsWith("sms|") || userInfo.sub !== subject) {
    throw new PlatformError(403, "Please use mobile-number verification to sign in.");
  }
  const phone = userInfo.phone_number ?? tokenUser.phone_number;
  if (typeof phone !== "string" || !/^\+[1-9]\d{6,14}$/.test(phone) ||
    userInfo.phone_number_verified === false || tokenUser.phone_number_verified === false) {
    throw new PlatformError(403, "Your provider did not return a verified mobile profile.");
  }
  return { subject, phone };
}

export function hasRecentMfa(claims: Record<string, unknown>, nowSeconds = Date.now() / 1000): boolean {
  return Array.isArray(claims.amr) && claims.amr.includes("mfa") &&
    typeof claims.auth_time === "number" &&
    claims.auth_time <= nowSeconds && nowSeconds - claims.auth_time <= 600;
}
