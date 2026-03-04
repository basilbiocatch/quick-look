"use strict";

import { Storage } from "@google-cloud/storage";
import zlib from "zlib";
import logger from "../configs/loggingConfig.js";

/**
 * GCS adapter for quicklook chunk storage.
 * Stores chunks as gzip-compressed JSON at {sessionId}/chunk-{index}.json.gz
 * with custom metadata (owner, projectKey, sessionId) for cost attribution.
 * 
 * Timeout configuration:
 * - Long sessions can have 100+ chunks, making list operations slow
 * - Network conditions vary; generous timeouts prevent spurious ECONNRESET errors
 * - Resumable uploads handle large chunks and network interruptions
 */
export class GcsAdapter {
  constructor(config = {}) {
    const { bucket, projectId, keyFilename } = config;
    if (!bucket) throw new Error("GcsAdapter: bucket is required");
    this.bucketName = String(bucket).toLowerCase();
    this.storage = new Storage({
      ...(projectId && { projectId }),
      ...(keyFilename && { keyFilename }),
      timeout: 300000, // 5 minutes timeout for all operations (upload, download, list)
      retryOptions: {
        autoRetry: true,
        retryDelayMultiplier: 2,
        totalTimeout: 600000, // 10 minutes total retry window
        maxRetryDelay: 64000,
        maxRetries: 6,
        idempotencyStrategy: 1, // Always retry (even non-idempotent operations)
      },
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
      timeout: 300000, // 5 minutes timeout for upload
      resumable: compressed.length > 2 * 1024 * 1024, // Use resumable upload for chunks >2MB (more reliable)
    });
    logger.info("GCS upload", {
      bucket: this.bucketName,
      path,
      owner: tags.owner || "(none)",
      sizeBytes: compressed.length,
    });
  }

  /**
   * List chunk files for a session using paginated list (smaller requests, less ECONNRESET).
   * @param {string} sessionId
   * @returns {Promise<Array<import('@google-cloud/storage').File>>}
   */
  async _listChunkFilesPaginated(sessionId) {
    const prefix = `${sessionId}/`;
    const listPageSize = 50;
    const allFiles = [];
    let query = { prefix, autoPaginate: false, maxResults: listPageSize };

    while (query) {
      const result = await this.bucket.getFiles(query);
      const files = Array.isArray(result[0]) ? result[0] : result;
      const nextQuery = result[1];
      const chunkFiles = files.filter((f) => f && /^[^/]+\/chunk-(\d+)\.json\.gz$/.test(f.name));
      allFiles.push(...chunkFiles);
      const nextToken = nextQuery && (nextQuery.pageToken ?? nextQuery.nextPageToken);
      if (nextToken) {
        query = { prefix, autoPaginate: false, maxResults: listPageSize, pageToken: nextToken };
      } else {
        query = null;
      }
    }
    return allFiles;
  }

  /**
   * Download a single chunk file and parse to { index, events }.
   */
  async _downloadOneChunk(file, sessionId) {
    const match = file.name.match(/^[^/]+\/chunk-(\d+)\.json\.gz$/);
    const index = parseInt(match[1], 10);
    const [contents] = await file.download({ timeout: 180000 });
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
    return { index, events };
  }

  /** Max concurrent chunk downloads per batch to avoid ECONNRESET / connection exhaustion */
  static DOWNLOAD_BATCH_SIZE = 12;

  /**
   * List and download all chunks for a session, sorted by index.
   * Uses paginated list and batched downloads to avoid ECONNRESET on long sessions.
   * @param {string} sessionId
   * @returns {Promise<Array<{ index: number, events: Array }>>}
   */
  async downloadChunks(sessionId) {
    const fileList = await this._listChunkFilesPaginated(sessionId);
    const chunks = [];
    const batchSize = GcsAdapter.DOWNLOAD_BATCH_SIZE;

    for (let i = 0; i < fileList.length; i += batchSize) {
      const batch = fileList.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((file) => this._downloadOneChunk(file, sessionId))
      );
      chunks.push(...batchResults);
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
   * Download a range of chunks for a session (for progressive loading).
   * @param {string} sessionId
   * @param {number} start - 0-based start index (chunk position, not chunk index)
   * @param {number} limit - max chunks to return
   * @returns {Promise<Array<{ index: number, events: Array }>>}
   */
  async downloadChunkRange(sessionId, start, limit) {
    const fileList = await this._listChunkFilesPaginated(sessionId);
    const sorted = fileList
      .map((f) => {
        const match = f.name.match(/^[^/]+\/chunk-(\d+)\.json\.gz$/);
        return match ? { file: f, index: parseInt(match[1], 10) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    const slice = sorted.slice(start, start + limit);
    const batchSize = Math.min(GcsAdapter.DOWNLOAD_BATCH_SIZE, slice.length || 1);
    const chunks = [];
    for (let i = 0; i < slice.length; i += batchSize) {
      const batch = slice.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ file }) => this._downloadOneChunk(file, sessionId))
      );
      chunks.push(...batchResults);
    }
    chunks.sort((a, b) => a.index - b.index);
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
   * Only objects with custom metadata.owner are counted; objects without it are skipped.
   * @returns {Promise<Map<string, number>>} ownerId -> total bytes
   */
  async getStorageByOwner() {
    const byOwner = new Map();
    const [files] = await this.bucket.getFiles({ autoPaginate: true });
    logger.info("StorageCost: GCS bucket listed", {
      bucket: this.bucketName,
      fileCount: files.length,
    });
    let withOwner = 0;
    let withoutOwner = 0;
    let totalBytesWithOwner = 0;
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size || "0", 10);
        const owner = metadata.metadata?.owner;
        if (owner) {
          withOwner++;
          totalBytesWithOwner += size;
          const current = byOwner.get(owner) || 0;
          byOwner.set(owner, current + size);
        } else {
          withoutOwner++;
        }
      } catch (_) {
        // Skip files that fail metadata read
      }
    }
    logger.info("StorageCost: GCS bucket scan", {
      bucket: this.bucketName,
      totalFiles: files.length,
      filesWithOwner: withOwner,
      filesWithoutOwner: withoutOwner,
      totalBytesAttributed: totalBytesWithOwner,
      ownerCount: byOwner.size,
    });
    return byOwner;
  }
}
