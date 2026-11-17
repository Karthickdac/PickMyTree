import app from "./app";
import { logger } from "./lib/logger";
import { reconcilePendingPayments } from "./lib/platform/adoption-orders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  const reconciliation = setInterval(() => {
    void reconcilePendingPayments().catch(() => logger.warn({ event: "payment-reconciliation-delayed" }, "Payment reconciliation will retry"));
  }, 60_000);
  reconciliation.unref();
});
