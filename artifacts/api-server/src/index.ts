import app from "./app";
import { seedPotholesIfEmpty } from "./lib/seed";
import { purgeExpiredSessions } from "./lib/auth";
import { logger } from "./lib/logger";

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

  // Startup housekeeping, deliberately after listen() so a slow or briefly
  // unavailable database delays the demo data rather than the health check.
  // Neither of these is required for the server to serve traffic.
  void seedPotholesIfEmpty().catch((err: unknown) => {
    logger.error({ err }, "Failed to seed potholes");
  });

  void purgeExpiredSessions()
    .then((count) => {
      if (count > 0) logger.info({ count }, "Purged expired sessions");
    })
    .catch((err: unknown) => {
      logger.error({ err }, "Failed to purge expired sessions");
    });
});
