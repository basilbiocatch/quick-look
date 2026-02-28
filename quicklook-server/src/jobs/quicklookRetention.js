"use strict";

import cron from "node-cron";
import logger from "../configs/loggingConfig.js";
import { QuicklookService } from "../services/quicklookService.js";

export const startQuicklookRetentionJob = () => {
  const isDev = ["development", "dev", undefined].includes(process.env.NODE_ENV);
  const schedule = isDev ? "*/30 * * * *" : "0 2 * * *";
  cron.schedule(
    schedule,
    async () => {
      try {
        const result = await QuicklookService.purgeExpiredSessions();
        if (result.deleted > 0) {
          logger.info(`QuicklookRetention: deleted ${result.deleted} expired sessions`);
        }
      } catch (err) {
        logger.error("QuicklookRetention job error:", err);
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
  logger.info("Quicklook retention job scheduled");
};
