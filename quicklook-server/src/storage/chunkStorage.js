"use strict";

import QuicklookChunk from "../models/quicklookChunkModel.js";
import { GcsAdapter } from "./gcsAdapter.js";

/**
 * Abstraction over chunk storage. Supports MongoDB (default) or GCS.
 * - saveChunk(sessionId, index, events, tags?) — tags used only for GCS (owner, projectKey).
 * - getChunks(sessionId) — returns [{ index, events }, ...] sorted by index.
 * - deleteChunks(sessionId)
 * - getLatestChunk(sessionId) — returns { index, events?, createdAt? } or null.
 * - getStorageByOwner() — only for GCS; returns Map<ownerId, bytes>. For MongoDB returns empty Map.
 */
export class ChunkStorage {
  constructor(type = "mongodb", config = {}) {
    this.type = type;
    this.gcs = type === "gcs" ? new GcsAdapter(config) : null;
  }

  async saveChunk(sessionId, index, events, tags = {}) {
    if (this.type === "gcs") {
      await this.gcs.uploadChunk(sessionId, index, events, tags);
      return;
    }
    await QuicklookChunk.findOneAndUpdate(
      { sessionId, index },
      { sessionId, index, events },
      { upsert: true }
    );
  }

  async getChunks(sessionId) {
    if (this.type === "gcs") {
      return this.gcs.downloadChunks(sessionId);
    }
    const docs = await QuicklookChunk.find({ sessionId })
      .select("index events")
      .sort({ index: 1 })
      .lean();
    return docs.map((d) => ({ index: d.index, events: d.events || [] }));
  }

  async deleteChunks(sessionId) {
    if (this.type === "gcs") {
      await this.gcs.deleteChunks(sessionId);
      return;
    }
    await QuicklookChunk.deleteMany({ sessionId });
  }

  async getLatestChunk(sessionId) {
    if (this.type === "gcs") {
      return this.gcs.getLatestChunk(sessionId);
    }
    const doc = await QuicklookChunk.findOne({ sessionId })
      .sort({ createdAt: -1 })
      .select("index events createdAt")
      .lean();
    if (!doc) return null;
    return {
      index: doc.index,
      events: doc.events || [],
      createdAt: doc.createdAt,
    };
  }

  /**
   * Total storage bytes per owner. Only implemented for GCS; for MongoDB returns empty Map.
   * @returns {Promise<Map<string, number>>}
   */
  async getStorageByOwner() {
    if (this.type !== "gcs") return new Map();
    return this.gcs.getStorageByOwner();
  }

  /**
   * Chunk count for a session. For MongoDB uses DB count; for GCS lists objects only.
   */
  async countChunks(sessionId) {
    if (this.type === "gcs") {
      return this.gcs.countChunks(sessionId);
    }
    return QuicklookChunk.countDocuments({ sessionId });
  }
}
