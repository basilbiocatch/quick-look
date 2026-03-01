"use strict";

import User from "../models/userModel.js";
import { ChunkStorage } from "../storage/chunkStorage.js";
import logger from "../configs/loggingConfig.js";

const costPerGb = parseFloat(process.env.GCS_STORAGE_COST_PER_GB || "0.020", 10);

/**
 * Calculate GCS storage costs per user and update User documents.
 * Only runs when CHUNK_STORAGE=gcs; otherwise no-ops.
 * @returns {{ updated: number, totalCost: number }}
 */
export const StorageCostService = {
  async calculateCostsPerUser() {
    if (process.env.CHUNK_STORAGE !== "gcs") {
      return { updated: 0, totalCost: 0 };
    }
    logger.info("StorageCost: querying GCP Cloud Storage for usage by owner", {
      bucket: process.env.GCS_BUCKET,
    });
    const chunkStorage = new ChunkStorage("gcs", {
      bucket: process.env.GCS_BUCKET,
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE,
    });
    const byOwner = await chunkStorage.getStorageByOwner();
    const users = await User.find().select("_id").lean();
    let updated = 0;
    let totalCost = 0;
    const now = new Date();
    for (const user of users) {
      const userId = user._id.toString();
      const bytes = byOwner.get(userId) || 0;
      const costUsd = (bytes / (1024 ** 3)) * (Number.isFinite(costPerGb) ? costPerGb : 0.02);
      await User.findByIdAndUpdate(userId, {
        storageBytes: bytes,
        storageCostUsd: Math.round(costUsd * 100) / 100,
        lastCostUpdate: now,
      });
      updated++;
      totalCost += costUsd;
    }
    return { updated, totalCost: Math.round(totalCost * 100) / 100 };
  },
};
