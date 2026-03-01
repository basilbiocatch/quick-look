"use strict";

import { Storage } from "@google-cloud/storage";
import zlib from "zlib";
import logger from "../configs/loggingConfig.js";

/**
 * GCS adapter for quicklook chunk storage.
 * Stores chunks as gzip-compressed JSON at {sessionId}/chunk-{index}.json.gz
 * with custom metadata (owner, projectKey, sessionId) for cost attribution.
 */
export class GcsAdapter {
  constructor(config = {}) {
    const { bucket, projectId, keyFilename } = config;
    if (!bucket) throw new Error("GcsAdapter: bucket is required");
    this.bucketName = String(bucket).toLowerCase();
    this.storage = new Storage({
      ...(projectId && { projectId }),
      ...(keyFilename && { keyFilename }),
    });
    this.bucket = this.storage.bucket(this.bucketName);
  }

  /**
   * Check if the bucket exists. Returns true if it exists, false if 404.
   * @returns {Promise<boolean>}
   */
  async bucketExists() {
    const [exists] = await this.bucket.exists();
    return exists;
  }

  /**
   * Create the bucket if it does not exist. Location from config or default us-central1.
   * @param {string} [location] - e.g. us-central1
   * @returns {Promise<boolean>} true if bucket existed or was created, false on permission error
   */
  async createBucketIfNotExists(location = "us-central1") {
    const [exists] = await this.bucket.exists();
    if (exists) return true;
    try {
      await this.storage.createBucket(this.bucketName, { location });
      logger.info("GCS bucket created", { bucket: this.bucketName, location });
      return true;
    } catch (err) {
      logger.error("GCS bucket creation failed (service account may need Storage Admin)", {
        bucket: this.bucketName,
        error: err.message,
      });
      return false;
    }
  }

  /**
   * Upload a chunk with customer metadata for cost tracking.
   * @param {string} sessionId
   * @param {number} index
   * @param {Array} events - Array of event objects
   * @param {Object} [tags] - { owner, projectKey } for cost attribution
   */
  async uploadChunk(sessionId, index, events, tags = {}) {
    const path = `${sessionId}/chunk-${index}.json.gz`;
    const json = JSON.stringify(events);
    const compressed = zlib.gzipSync(Buffer.from(json, "utf8"));

    const customMetadata = {
      sessionId: String(sessionId),
      uploadedAt: new Date().toISOString(),
      ...(tags.owner && { owner: String(tags.owner) }),
      ...(tags.projectKey && { projectKey: String(tags.projectKey) }),
    };

    const file = this.bucket.file(path);
    await file.save(compressed, {
      metadata: {
        contentType: "application/json",
        contentEncoding: "gzip",
        metadata: customMetadata,
      },
    });
    logger.info("GCS upload", {
      bucket: this.bucketName,
      path,
      owner: tags.owner || "(none)",
      sizeBytes: compressed.length,
    });
  }

  /**
   * List and download all chunks for a session, sorted by index.
   * @param {string} sessionId
   * @returns {Promise<Array<{ index: number, events: Array }>>}
   */
  async downloadChunks(sessionId) {
    const prefix = `${sessionId}/`;
    const [files] = await this.bucket.getFiles({ prefix });
    const chunks = [];
    for (const file of files) {
      const name = file.name;
      const match = name.match(/^[^/]+\/chunk-(\d+)\.json\.gz$/);
      if (!match) continue;
      const index = parseInt(match[1], 10);
      const [contents] = await file.download();
      let events;
      try {
        const decompressed = zlib.gunzipSync(contents);
        events = JSON.parse(decompressed.toString("utf8"));
      } catch (err) {
        if (err.message && err.message.includes("incorrect header check")) {
          events = JSON.parse(contents.toString("utf8"));
        } else {
          logger.error("GCS download chunk parse failed", {
            sessionId: sessionId?.slice(0, 8),
            index,
            error: err.message,
          });
          throw err;
        }
      }
      chunks.push({ index, events });
    }
    chunks.sort((a, b) => a.index - b.index);
    logger.debug("GCS download", {
      bucket: this.bucketName,
      sessionId: sessionId?.slice(0, 8),
      chunkCount: chunks.length,
    });
    return chunks;
  }

  /**
   * Delete all chunks for a session.
   * @param {string} sessionId
   */
  async deleteChunks(sessionId) {
    const prefix = `${sessionId}/`;
    await this.bucket.deleteFiles({ prefix });
    logger.info("GCS delete", { bucket: this.bucketName, sessionId: sessionId?.slice(0, 8), prefix });
  }

  /**
   * Get the most recent chunk for a session (by index) for auto-close logic.
   * @param {string} sessionId
   * @returns {Promise<{ index: number, events: Array, createdAt?: Date } | null>}
   */
  async getLatestChunk(sessionId) {
    const prefix = `${sessionId}/`;
    const [files] = await this.bucket.getFiles({ prefix });
    let latest = null;
    let maxIndex = -1;
    for (const file of files) {
      const match = file.name.match(/^[^/]+\/chunk-(\d+)\.json\.gz$/);
      if (!match) continue;
      const index = parseInt(match[1], 10);
      if (index > maxIndex) {
        maxIndex = index;
        latest = file;
      }
    }
    if (!latest) return null;
    const [metadata] = await latest.getMetadata();
    return {
      index: maxIndex,
      events: [], // Caller only needs createdAt for auto-close
      createdAt: metadata.timeCreated ? new Date(metadata.timeCreated) : null,
    };
  }

  /**
   * Count chunks for a session (list only, no download).
   * @param {string} sessionId
   * @returns {Promise<number>}
   */
  async countChunks(sessionId) {
    const prefix = `${sessionId}/`;
    const [files] = await this.bucket.getFiles({ prefix });
    return files.filter((f) => /\/chunk-\d+\.json\.gz$/.test(f.name)).length;
  }

  /**
   * Get total storage bytes per owner by scanning bucket and summing by metadata.owner.
   * Used by the cost calculation job.
   * @returns {Promise<Map<string, number>>} ownerId -> total bytes
   */
  async getStorageByOwner() {
    const byOwner = new Map();
    const [files] = await this.bucket.getFiles({ autoPaginate: true });
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size || "0", 10);
        const owner = metadata.metadata?.owner;
        if (owner) {
          const current = byOwner.get(owner) || 0;
          byOwner.set(owner, current + size);
        }
      } catch (_) {
        // Skip files that fail metadata read
      }
    }
    return byOwner;
  }
}
