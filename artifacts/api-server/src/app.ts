import express, { type Express, type ErrorRequestHandler } from "express";
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createPhoneAuth } from "./middlewares/auth0";
import { PlatformError } from "./lib/platform/access";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
app.use((req, res, next) => {
  const id = randomUUID();
  res.setHeader("X-Request-ID", id);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() ?? req.get("host");
    let crossOrigin = false;
    try { crossOrigin = Boolean(origin && new URL(origin).host !== host); } catch { crossOrigin = true; }
    if (req.get("sec-fetch-site") === "cross-site" || crossOrigin) {
      res.status(403).json({ error: "Cross-site requests are not permitted.", requestId: id }); return;
    }
  }
  next();
});
app.use("/api/v1", rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api/v1/public/enquiries", rateLimit({ windowMs: 15 * 60_000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many enquiries. Please try again later." } }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(createPhoneAuth());

app.use("/api", router);
app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found." }); });
const errors: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(res.getHeader("X-Request-ID") ?? "");
  if (err instanceof PlatformError) { res.status(err.status).json({ error: err.message, requestId }); return; }
  if (err?.name === "ZodError") { res.status(400).json({ error: "Some fields are missing or invalid. Please check your entries.", requestId }); return; }
  if (err?.code === "23505") { res.status(409).json({ error: "This identifier already exists.", requestId }); return; }
  if (err?.status === 400) { res.status(400).json({ error: "Invalid request.", requestId }); return; }
  req.log.error({ err, requestId }, "Request failed");
  res.status(500).json({ error: "We could not complete this request. Please try again.", requestId });
};
app.use(errors);

export default app;
