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
        const msg = err?.message || String(err);
        if (msg.includes("ENETUNREACH") || msg.includes("ECONNREFUSED")) {
          logger.warn("QuicklookRetention job: MongoDB unreachable (%s). Will retry next run.", msg.slice(0, 80));
        } else {
          logger.error("QuicklookRetention job error:", err);
        }
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
  logger.info("Quicklook retention job scheduled");
};

export const startAutoCloseInactiveSessionsJob = () => {
  const isDev = ["development", "dev", undefined].includes(process.env.NODE_ENV);
  // Run every 5 minutes in dev, every 10 minutes in production
  const schedule = isDev ? "*/5 * * * *" : "*/10 * * * *";
  cron.schedule(
    schedule,
    async () => {
      try {
        // Auto-close sessions inactive for 30 minutes
        const result = await QuicklookService.autoCloseInactiveSessions(30 * 60 * 1000);
        if (result.closed > 0) {
          logger.info(`QuicklookAutoClose: closed ${result.closed} inactive sessions`);
        }
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes("ENETUNREACH") || msg.includes("ECONNREFUSED")) {
          logger.warn("QuicklookAutoClose job: MongoDB unreachable (%s). Will retry next run.", msg.slice(0, 80));
        } else {
          logger.error("QuicklookAutoClose job error:", err);
        }
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
  logger.info("Quicklook auto-close inactive sessions job scheduled");
};
