import { Router, type IRouter, type ErrorRequestHandler } from "express";
import { auth } from "express-openid-connect";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";
import { PlatformError } from "../lib/platform/errors";
import { verifiedMobileIdentity, type MobileIdentity } from "../lib/platform/mobile-identity";

declare global {
  namespace Express {
    interface Request {
      patSession?: { mobileIdentity?: MobileIdentity };
    }
  }
}

function getSettings() {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  const base = process.env.AUTH0_BASE_URL;
  const clientID = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const secret = process.env.SESSION_SECRET;
  if (!issuer || !base || !clientID || !clientSecret || !secret || secret.length < 32) return null;
  try {
    const issuerURL = new URL(issuer), baseURL = new URL(base);
    if (issuerURL.protocol !== "https:" || baseURL.protocol !== "https:" ||
      issuerURL.username || issuerURL.password || issuerURL.search || issuerURL.hash ||
      baseURL.username || baseURL.password || baseURL.search || baseURL.hash ||
      issuerURL.pathname !== "/" || baseURL.pathname !== "/") return null;
    return { issuerBaseURL: issuerURL.origin, baseURL: baseURL.origin, clientID, clientSecret, secret };
  } catch { return null; }
}
const settings = getSettings();
export const phoneAuthConfigured = Boolean(settings);
export const phoneAuthOrigin = settings?.baseURL;

export function createPhoneAuth(): IRouter {
  const router: IRouter = Router();
  router.use("/api/auth", rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait before trying again." } }));
  router.use("/api/auth", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });
  if (!settings) {
    logger.warn("Phone sign-in is disabled: secure Auth0 settings or application origin are missing or invalid.");
    router.all("/api/auth/{*path}", (_req, res) => {
      res.status(503).json({ error: "Mobile sign-in has not been configured. Please contact the platform owner." });
    });
    return router;
  }
  router.use(auth({
    ...settings,
    authRequired: false,
    auth0Logout: true,
    idpLogout: true,
    routes: { login: false, logout: false, callback: "/api/auth/callback" },
    authorizationParams: { response_type: "code", response_mode: "query", scope: "openid profile phone", connection: "sms", prompt: "login" },
    getLoginState: () => ({ returnTo: `${settings.baseURL}/portal` }),
    session: { name: "patSession", rolling: true, rollingDuration: 86400, absoluteDuration: 604800,
      cookie: { httpOnly: true, secure: true, sameSite: "Lax", path: "/" } },
    legacySameSiteCookie: false,
    httpTimeout: 10000,
    afterCallback: async (req, _res, session) => {
      const mobileIdentity = verifiedMobileIdentity(req.oidc.user ?? {}, await req.oidc.fetchUserInfo());
      return { ...session, mobileIdentity };
    },
  }));
  router.get("/api/auth/login", async (_req, res): Promise<void> => {
    await res.oidc.login({ returnTo: `${settings.baseURL}/portal` });
  });
  // A cross-site GET must not be able to log a user out.
  router.post("/api/auth/logout", async (req, res): Promise<void> => {
    if (req.get("origin") !== settings.baseURL) throw new PlatformError(403, "Sign out must be requested from this website.");
    await res.oidc.logout({ returnTo: settings.baseURL });
  });
  const errors: ErrorRequestHandler = (err, req, res, next) => {
    if (!req.path.startsWith("/api/auth/")) { next(err); return; }
    if (req.path === "/api/auth/logout" && err instanceof PlatformError) {
      res.status(err.status).json({ error: err.message }); return;
    }
    // Never log raw provider errors, tokens, code/state, cookies or client secrets.
    req.log.warn({ event: "phone-auth-failed", stage: req.path.endsWith("/callback") ? "callback" : "redirect" }, "Phone authentication did not complete");
    const reason = err instanceof PlatformError && err.status === 403 ? "mobile-verification-required" : "authentication-failed";
    res.redirect(303, `/sign-in?error=${reason}`);
  };
  router.use(errors);
  return router;
}
