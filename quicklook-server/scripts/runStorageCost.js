#!/usr/bin/env node
"use strict";

/**
 * Run the storage cost calculation once (same logic as the in-process cron job).
 * Use this to test locally or to run on-demand without waiting for the 3-hour schedule.
 *
 * Usage (from quicklook-server):
 *   node scripts/runStorageCost.js
 *
 * Requires .env (or env) with CHUNK_STORAGE=gcs, GCS_BUCKET, GCP_PROJECT_ID, GCS_KEY_FILE, QUICKLOOK_DB.
 */

import "dotenv/config";
import { StorageCostService } from "../src/services/storageCostService.js";

async function main() {
  if (process.env.CHUNK_STORAGE !== "gcs") {
    console.log("CHUNK_STORAGE is not 'gcs'. Cost job only runs for GCS. Set CHUNK_STORAGE=gcs and GCS_* env to run.");
    process.exit(0);
  }
  if (!process.env.GCS_BUCKET) {
    console.error("GCS_BUCKET is required when CHUNK_STORAGE=gcs.");
    process.exit(1);
  }

  console.log("Running storage cost calculation...");
  const result = await StorageCostService.calculateCostsPerUser();
  console.log("Done:", { usersUpdated: result.updated, totalCostUsd: result.totalCost });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
