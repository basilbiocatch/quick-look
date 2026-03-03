"use strict";

import cron from "node-cron";
import logger from "../configs/loggingConfig.js";
import { StorageCostService } from "../services/storageCostService.js";

export const startStorageCostJob = () => {
  if (process.env.CHUNK_STORAGE !== "gcs") {
    return;
  }
  cron.schedule(
    "0 */3 * * *",
    async () => {
      try {
        const result = await StorageCostService.calculateCostsPerUser();
        logger.info("StorageCost: updated costs", {
          usersUpdated: result.updated,
          totalCostUsd: result.totalCost,
        });
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg.includes("ENETUNREACH") || msg.includes("ECONNREFUSED")) {
          logger.warn("StorageCost job: MongoDB unreachable (%s). Will retry next run.", msg.slice(0, 80));
        } else {
          logger.error("StorageCost job error:", err);
        }
      }
    },
    { scheduled: true, timezone: "UTC" }
  );
  logger.info("Storage cost tracking job scheduled (every 3 hours, data from GCP Cloud Storage)");
};
