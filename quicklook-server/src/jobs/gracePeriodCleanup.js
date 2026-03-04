"use strict";

import cron from "node-cron";
import User from "../models/userModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import logger from "../configs/loggingConfig.js";

const FREE_RETENTION_DAYS = 30;
const FREE_SESSION_CAP = 1000;

export function startGracePeriodCleanupJob() {
  cron.schedule(
    "0 * * * *",
    async () => {
      try {
        const now = new Date();
        const users = await User.find({
          gracePeriodEnd: { $lt: now },
          plan: { $ne: "free" },
        }).select("_id plan billing");
        for (const user of users) {
          try {
            user.previousPlan = user.plan;
            user.plan = "free";
            user.sessionCap = FREE_SESSION_CAP;
            user.gracePeriodEnd = undefined;
            if (user.billing && typeof user.billing === "object") {
              user.billing.subscriptionId = undefined;
              user.billing.status = "canceled";
            }
            await user.save();
            await QuicklookProject.updateMany(
              { owner: user._id.toString() },
              { $set: { retentionDays: FREE_RETENTION_DAYS } }
            );
            logger.info("Grace period cleanup: downgraded user to free", { userId: user._id.toString() });
          } catch (err) {
            logger.error("Grace period cleanup: failed for user", { userId: user._id?.toString(), error: err.message });
          }
        }
      } catch (err) {
        logger.error("Grace period cleanup job error", { error: err.message });
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
  logger.info("Grace period cleanup job scheduled (hourly)");
}
