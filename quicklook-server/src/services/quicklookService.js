"use strict";

import { v4 as uuidv4 } from "uuid";
import zlib from "zlib";
import QuicklookSession from "../models/quicklookSessionModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import User from "../models/userModel.js";
import logger from "../configs/loggingConfig.js";
import { ChunkStorage } from "../storage/chunkStorage.js";
import { GcsAdapter } from "../storage/gcsAdapter.js";

let CHUNK_STORAGE_BACKEND = process.env.CHUNK_STORAGE || "mongodb";
const rawBucket = (process.env.GCS_BUCKET || "").trim();
const isPlaceholderBucket = !rawBucket || /^(GCP|gcp)$/i.test(rawBucket) || rawBucket.length < 5;
if (CHUNK_STORAGE_BACKEND === "gcs" && (!rawBucket || isPlaceholderBucket)) {
  logger.warn(
    "CHUNK_STORAGE=gcs but GCS_BUCKET is missing or looks like a placeholder. Create a bucket in Google Cloud Console (e.g. quicklook-chunks) and set GCS_BUCKET to its name. Falling back to MongoDB."
  );
  CHUNK_STORAGE_BACKEND = "mongodb";
}
const gcsBucket = rawBucket && !isPlaceholderBucket ? rawBucket.toLowerCase() : undefined;
const chunkStorage = new ChunkStorage(CHUNK_STORAGE_BACKEND, {
  bucket: gcsBucket,
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILE,
});
/** Used when fetching events for sessions that have chunks in MongoDB (storageType 'mongodb'). */
const mongoChunkStorage = new ChunkStorage("mongodb", {});

if (CHUNK_STORAGE_BACKEND === "gcs") {
  logger.info("Chunk storage: using GCP Cloud Storage (GCS)", {
    bucket: gcsBucket,
    projectId: process.env.GCP_PROJECT_ID || "(default)",
  });
} else {
  logger.info("Chunk storage: using MongoDB (set CHUNK_STORAGE=gcs and GCS_BUCKET to use GCP)");
}

/** Run once at startup when using GCS: ensure bucket exists, try to create if missing. */
export async function checkGcsBucketAtStartup() {
  if (CHUNK_STORAGE_BACKEND !== "gcs" || !gcsBucket) return;
  try {
    const adapter = new GcsAdapter({
      bucket: gcsBucket,
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE,
    });
    const location = process.env.GCS_BUCKET_LOCATION || "us-central1";
    const ok = await adapter.createBucketIfNotExists(location);
    if (!ok) {
      const project = process.env.GCP_PROJECT_ID || "YOUR_PROJECT_ID";
      logger.error(
        `GCS bucket "${gcsBucket}" does not exist and auto-create failed. Create it manually: gcloud storage buckets create gs://${gcsBucket} --project=${project} --location=${location}`
      );
    }
  } catch (err) {
    logger.warn("Could not check GCS bucket (will fail on first chunk save)", { error: err.message });
  }
}

const SESSION_CAP_WINDOW_DAYS = 30;

/** In-memory cache for getSessions stats (total, uniqueUsers, avgDurationMs). TTL 5 min, max 100 entries. */
const SESSIONS_STATS_CACHE_TTL_MS = 300000;
const SESSIONS_STATS_CACHE_MAX_SIZE = 100;
const sessionsStatsCache = new Map();

function getSessionsStatsCacheKey(projectKey, status, from, to) {
  return `sessions:stats:${String(projectKey ?? "")}:${String(status ?? "")}:${String(from ?? "")}:${String(to ?? "")}`;
}

function getSessionsStatsFromCache(key) {
  const entry = sessionsStatsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SESSIONS_STATS_CACHE_TTL_MS) {
    sessionsStatsCache.delete(key);
    return null;
  }
  return entry;
}

function setSessionsStatsCache(key, total, uniqueUsers, avgDurationMs) {
  while (sessionsStatsCache.size >= SESSIONS_STATS_CACHE_MAX_SIZE) {
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [k, v] of sessionsStatsCache) {
      if (v.timestamp < oldestTs) {
        oldestTs = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey != null) sessionsStatsCache.delete(oldestKey);
  }
  sessionsStatsCache.set(key, { total, uniqueUsers, avgDurationMs, timestamp: Date.now() });
}

function decompressChunkData(data, compressed) {
  if (!compressed || !data) return data;
  try {
    const buf = Buffer.from(data, "base64");
    const decompressed = zlib.gunzipSync(buf);
    return JSON.parse(decompressed.toString("utf8"));
  } catch (err) {
    if (err.message && (err.message.includes("incorrect header check") || err.message.includes("unknown format"))) {
      try {
        const buf = Buffer.from(data, "base64");
        const str = buf.toString("utf8");
        return JSON.parse(str);
      } catch (e2) {
        if (typeof data === "string") {
          try {
            return JSON.parse(data);
          } catch (_) {}
        }
      }
    }
    logger.error("quicklookService: decompress failed", { error: err.message });
    throw err;
  }
}

/** Check if user has reached their monthly session cap (for AI processing gating). */
export async function hasReachedSessionCap(userId) {
  const user = await User.findById(userId).select("sessionCap").lean();
  if (!user || user.sessionCap == null) return false;
  const thirtyDaysAgo = new Date(Date.now() - SESSION_CAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const projects = await QuicklookProject.find({ owner: userId }).select("projectKey").lean();
  const projectKeys = projects.map((p) => p.projectKey);
  if (projectKeys.length === 0) return false;
  const count = await QuicklookSession.countDocuments({
    projectKey: { $in: projectKeys },
    status: "closed",
    createdAt: { $gte: thirtyDaysAgo },
  });
  return count >= user.sessionCap;
}

export const QuicklookService = {
  async startSession({ projectKey, meta, user, ipAddress, retentionDays, geo = null, attributes = null, parentSessionId = null, sessionChainId = null, sequenceNumber = 1, splitReason = null, deviceId = null, deviceFingerprint = null }) {
    // Get project to use its retentionDays (set based on plan)
    const project = await QuicklookProject.findOne({ projectKey }).select("owner retentionDays").lean();
    if (!project) {
      throw new Error("Project not found");
    }
    // Use project's retentionDays (set from plan), fallback to 30 if not set
    const sessionRetentionDays = project.retentionDays || 30;
    
    if (project.owner) {
      const ownerUser = await User.findById(project.owner).select("sessionCap").lean();
      if (ownerUser && ownerUser.sessionCap != null) {
        const projectKeys = await QuicklookProject.find({ owner: project.owner }).select("projectKey").lean();
        const keys = projectKeys.map((p) => p.projectKey);
        const windowStart = new Date(Date.now() - SESSION_CAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        const count = await QuicklookSession.countDocuments({
          projectKey: { $in: keys },
          status: "closed",
          createdAt: { $gte: windowStart },
        });
        if (count >= ownerUser.sessionCap) {
          throw new Error("Session limit reached");
        }
      }
    }
    const sessionId = uuidv4();
    const clientMeta = meta && typeof meta === "object" ? meta : {};
    const metaWithLocation = { ...clientMeta };
    if (geo && (geo.countryCode || geo.city)) {
      metaWithLocation.countryCode = geo.countryCode || clientMeta.countryCode;
      metaWithLocation.city = geo.city || clientMeta.city;
      metaWithLocation.location = {
        countryCode: geo.countryCode,
        country: geo.country,
        city: geo.city,
        regionName: geo.regionName,
      };
    }
    const storageType = CHUNK_STORAGE_BACKEND === "gcs" ? "gcs" : "mongodb";
    const doc = new QuicklookSession({
      sessionId,
      projectKey: String(projectKey).slice(0, 256),
      status: "active",
      meta: metaWithLocation,
      user: user || {},
      ipAddress: ipAddress || null,
      retentionDays: sessionRetentionDays,
      storageType,
      ...(attributes != null && typeof attributes === "object" && !Array.isArray(attributes)
        ? { attributes }
        : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(sessionChainId ? { sessionChainId } : {}),
      sequenceNumber: sequenceNumber || 1,
      ...(splitReason ? { splitReason } : {}),
      ...(deviceId ? { deviceId } : {}),
      ...(deviceFingerprint ? { deviceFingerprint } : {}),
    });
    await doc.save();
    return { sessionId, sessionChainId: doc.sessionChainId };
  },

  async saveChunk({ sessionId, index, data, compressed }) {
    let events = Array.isArray(data) ? data : decompressChunkData(data, compressed);
    if (!Array.isArray(events)) {
      if (events && typeof events === "object" && Array.isArray(events.events)) {
        events = events.events;
      } else if (events && typeof events === "object" && Array.isArray(events.data)) {
        events = events.data;
      }
    }
    if (!Array.isArray(events)) {
      logger.warn("quicklook saveChunk: skipping non-array payload", {
        sessionId: sessionId?.slice(0, 8),
        index,
        type: Array.isArray(data) ? "array" : typeof data,
      });
      return { success: true };
    }
    const session = await QuicklookSession.findOne({ sessionId }).select("projectKey");
    if (!session) throw new Error("Session not found");
    const project = await QuicklookProject.findOne({ projectKey: session.projectKey }).select("owner");
    const owner = project?.owner != null ? String(project.owner) : undefined;
    if (CHUNK_STORAGE_BACKEND === "gcs" && !owner) {
      logger.warn("quicklook saveChunk: no project or owner — GCS object will have no owner metadata (storage cost will not be attributed)", {
        sessionId: sessionId?.slice(0, 8),
        projectKey: session.projectKey,
      });
    }
    await chunkStorage.saveChunk(sessionId, index, events, {
      owner,
      projectKey: session.projectKey,
    });
    const sessionDoc = await QuicklookSession.findOne({ sessionId });
    if (sessionDoc) {
      // Reopen if closed (user navigated back within same tab)
      if (sessionDoc.status === "closed") {
        sessionDoc.status = "active";
        sessionDoc.closedAt = null;
      }
      
      const indexBasedCount = (index ?? 0) + 1;
      if (indexBasedCount > (sessionDoc.chunkCount || 0)) {
        sessionDoc.chunkCount = indexBasedCount;
      }
      
      // Update event count
      sessionDoc.eventCount = (sessionDoc.eventCount || 0) + events.length;
      
      const existing = new Set(Array.isArray(sessionDoc.pages) ? sessionDoc.pages : []);
      const hrefsFromChunk = events.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean);
      for (const href of hrefsFromChunk) existing.add(href);
      if (existing.size > 0) {
        sessionDoc.pages = [...existing];
        sessionDoc.pageCount = sessionDoc.pages.length;
      }
      if (sessionDoc.pageCount === 0 && sessionDoc.chunkCount > 0) {
        const allChunks = await chunkStorage.getChunks(sessionId);
        const allEvents = allChunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
        const allHrefs = new Set(
          allEvents.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean)
        );
        if (allHrefs.size > 0) {
          sessionDoc.pages = [...allHrefs];
          sessionDoc.pageCount = sessionDoc.pages.length;
        }
      }
      await sessionDoc.save();
    }
    const destination = CHUNK_STORAGE_BACKEND === "gcs" ? "GCP Cloud Storage" : "MongoDB";
    // logger.info(`quicklook chunk saved → ${destination}`, {
    //   sessionId: sessionId?.slice(0, 8),
    //   index,
    //   eventCount: events.length,
    //   storage: CHUNK_STORAGE_BACKEND,
    // });
    return { success: true };
  },

  async endSession(sessionId, body = {}) {
    const { data, index } = body;
    if (data != null && Array.isArray(data)) {
      await this.saveChunk({ sessionId, index: index ?? 0, data, compressed: false });
    } else if (data != null && index != null) {
      const events = decompressChunkData(data, true);
      await this.saveChunk({ sessionId, index, data: events, compressed: false });
    }
    const session = await QuicklookSession.findOne({ sessionId });
    if (!session) return { success: true };
    // Already closed (duplicate beacon) — skip
    if (session.status === "closed") return { success: true };

    session.status = "closed";
    const closedAt = new Date();
    session.closedAt = closedAt;
    if (session.createdAt) {
      const createdAt = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt);
      session.duration = closedAt.getTime() - createdAt.getTime();
    }
    await session.save();
    return { success: true };
  },

  async updateSessionUser(sessionId, user) {
    if (!sessionId || !user || typeof user !== "object") return { success: false };
    const session = await QuicklookSession.findOne({ sessionId }).select("user").lean();
    if (!session) return { success: false };
    const merged = { ...(session.user || {}), ...user };
    await QuicklookSession.updateOne({ sessionId }, { $set: { user: merged } });
    return { success: true };
  },

  async getSessions({ projectKey, status, from, to, limit = 50, skip = 0, ipAddress, deviceId, userEmail, sessionIds: sessionIdsFilter }) {
    const query = {};
    if (projectKey) query.projectKey = projectKey;
    if (status) query.status = status;
    if (ipAddress && String(ipAddress).trim()) query.ipAddress = String(ipAddress).trim();
    if (deviceId && String(deviceId).trim()) query.deviceId = String(deviceId).trim();
    if (userEmail && String(userEmail).trim()) query["user.email"] = String(userEmail).trim();
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    if (Array.isArray(sessionIdsFilter) && sessionIdsFilter.length > 0) {
      const ids = sessionIdsFilter.slice(0, 500);
      query.sessionId = { $in: ids };
    }

    const useStatsCache =
      !(ipAddress && String(ipAddress).trim()) &&
      !(deviceId && String(deviceId).trim()) &&
      !(userEmail && String(userEmail).trim()) &&
      !(Array.isArray(sessionIdsFilter) && sessionIdsFilter.length > 0);
    const cacheKey = useStatsCache ? getSessionsStatsCacheKey(projectKey, status, from, to) : null;
    const cached = cacheKey ? getSessionsStatsFromCache(cacheKey) : null;

    let total;
    let stats;
    let data;

    if (cached) {
      total = cached.total;
      stats = { uniqueUsers: cached.uniqueUsers, avgDurationMs: cached.avgDurationMs };
      data = await QuicklookSession.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(limit, 200))
        .lean();
    } else {
      const now = new Date();
      const [countResult, statsResult, dataResult] = await Promise.all([
        QuicklookSession.countDocuments(query),
        QuicklookSession.aggregate([
          { $match: query },
          {
            $project: {
              userKey: { $ifNull: ["$user.email", "$sessionId"] },
              computedDuration: {
                $cond: [
                  { $eq: ["$status", "closed"] },
                  { $ifNull: ["$duration", 0] },
                  { $subtract: [now, "$createdAt"] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              uniqueUsers: { $addToSet: "$userKey" },
              totalDuration: { $sum: "$computedDuration" },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              uniqueUsers: { $size: "$uniqueUsers" },
              avgDurationMs: { $round: [{ $divide: ["$totalDuration", "$count"] }, 0] },
            },
          },
        ]),
        QuicklookSession.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Math.min(limit, 200))
          .lean(),
      ]);
      total = countResult;
      stats = statsResult[0] || { uniqueUsers: 0, avgDurationMs: 0 };
      data = dataResult;
      if (cacheKey != null) {
        setSessionsStatsCache(cacheKey, total, stats.uniqueUsers, stats.avgDurationMs);
      }
    }
    const sessionNow = Date.now();
    for (const session of data) {
      if (session.status === "active" && session.createdAt) {
        const createdAt = session.createdAt instanceof Date
          ? session.createdAt.getTime()
          : new Date(session.createdAt).getTime();
        session.duration = sessionNow - createdAt;
      }
    }

    return {
      success: true,
      data,
      total,
      limit,
      skip,
      uniqueUsers: stats.uniqueUsers,
      avgDurationMs: stats.avgDurationMs,
    };
  },

  async getSessionById(sessionId) {
    const session = await QuicklookSession.findOne({ sessionId }).lean();
    return session;
  },

  async getSessionChain(sessionId) {
    const session = await QuicklookSession.findOne({ sessionId }).lean();
    if (!session) return null;
    
    // If this session has a chain ID, get all sessions in the chain
    const chainId = session.sessionChainId;
    if (!chainId) {
      return [session]; // Single session, no chain
    }
    
    // Get all sessions in the chain, sorted by sequence number
    const chainSessions = await QuicklookSession.find({ sessionChainId: chainId })
      .sort({ sequenceNumber: 1 })
      .lean();
    
    return chainSessions;
  },

  async getSessionEvents(sessionId) {
    const session = await QuicklookSession.findOne({ sessionId }).select("storageType chunkCount").lean();
    let chunks;
    let fromGcs = false;
    const knownChunkCount = session?.chunkCount || 0;
    if (session?.storageType === "gcs" && CHUNK_STORAGE_BACKEND === "gcs") {
      chunks = await chunkStorage.getChunks(sessionId, knownChunkCount);
      fromGcs = chunks.length > 0;
      if (chunks.length === 0) {
        const mongoChunks = await mongoChunkStorage.getChunks(sessionId);
        if (mongoChunks.length > 0) {
          chunks = mongoChunks;
          fromGcs = false;
        }
      }
    } else {
      chunks = await mongoChunkStorage.getChunks(sessionId);
      if (chunks.length === 0 && CHUNK_STORAGE_BACKEND === "gcs" && knownChunkCount > 0) {
        chunks = await chunkStorage.getChunks(sessionId, knownChunkCount);
        fromGcs = chunks.length > 0;
      }
    }
    if (chunks.length > 0 && fromGcs) {
      logger.info("Session events loaded from GCP Cloud Storage", {
        sessionId: sessionId?.slice(0, 8),
        chunkCount: chunks.length,
      });
    }
    const events = [];
    const pagesSet = new Set();
    const networkEvents = [];
    const consoleEvents = [];
    for (const c of chunks) {
      const chunkEvents = Array.isArray(c.events) ? c.events : [];
      for (const e of chunkEvents) {
        events.push(e);
        if (e.type === 4 && e.data?.href) pagesSet.add(e.data.href);
        if (e.type === 5) {
          if (e.data?.tag === "ql_network") networkEvents.push(e);
          if (e.data?.tag === "ql_console") consoleEvents.push(e);
        }
      }
    }
    return {
      success: true,
      sessionId,
      events,
      meta: {
        chunkCount: chunks.length,
        eventCount: events.length,
        pages: [...pagesSet],
        networkEvents: networkEvents.length,
        consoleEvents: consoleEvents.length,
      },
    };
  },

  /**
   * Get a batch of chunks for progressive loading.
   * @param {string} sessionId
   * @param {number} start - 0-based start index
   * @param {number} limit - max chunks to return
   * @returns {Promise<{ success, sessionId, events, meta: { totalChunks, returnedChunks, start, hasMore, pages, networkEvents, consoleEvents } }>}
   */
  async getSessionChunksBatch(sessionId, start = 0, limit = 5) {
    const session = await QuicklookSession.findOne({ sessionId }).select("storageType chunkCount").lean();
    let chunks;
    let totalChunks;

    if (session?.storageType === "gcs" && CHUNK_STORAGE_BACKEND === "gcs") {
      totalChunks = await chunkStorage.countChunks(sessionId);
      chunks = totalChunks > 0 ? await chunkStorage.getChunksRange(sessionId, start, limit) : [];
      if (chunks.length === 0 && totalChunks === 0) {
        const mongoChunks = await mongoChunkStorage.getChunks(sessionId);
        totalChunks = mongoChunks.length;
        chunks = mongoChunks.slice(start, start + limit);
      }
    } else {
      totalChunks = await mongoChunkStorage.countChunks(sessionId);
      chunks = totalChunks > 0 ? await mongoChunkStorage.getChunksRange(sessionId, start, limit) : [];
      if (chunks.length === 0 && CHUNK_STORAGE_BACKEND === "gcs" && (session?.chunkCount ?? 0) > 0) {
        totalChunks = await chunkStorage.countChunks(sessionId);
        chunks = totalChunks > 0 ? await chunkStorage.getChunksRange(sessionId, start, limit) : [];
      }
    }

    const events = [];
    const pagesSet = new Set();
    const networkEvents = [];
    const consoleEvents = [];
    for (const c of chunks) {
      const chunkEvents = Array.isArray(c.events) ? c.events : [];
      for (const e of chunkEvents) {
        events.push(e);
        if (e.type === 4 && e.data?.href) pagesSet.add(e.data.href);
        if (e.type === 5) {
          if (e.data?.tag === "ql_network") networkEvents.push(e);
          if (e.data?.tag === "ql_console") consoleEvents.push(e);
        }
      }
    }

    return {
      success: true,
      sessionId,
      events,
      meta: {
        totalChunks,
        returnedChunks: chunks.length,
        start,
        hasMore: start + chunks.length < totalChunks,
        pages: [...pagesSet],
        networkEvents: networkEvents.length,
        consoleEvents: consoleEvents.length,
      },
    };
  },

  async purgeExpiredSessions() {
    const now = new Date();
    const expired = await QuicklookSession.find({ expiresAt: { $lt: now } }).select("sessionId").lean();
    let deleted = 0;
    for (const s of expired) {
      await chunkStorage.deleteChunks(s.sessionId);
      await QuicklookSession.deleteOne({ sessionId: s.sessionId });
      deleted++;
    }
    return { deleted };
  },

  async deleteProject(projectKey) {
    const sessions = await QuicklookSession.find({ projectKey }).select("sessionId").lean();
    const sessionIds = sessions.map((s) => s.sessionId);
    let chunksDeleted = 0;
    for (const sessionId of sessionIds) {
      await chunkStorage.deleteChunks(sessionId);
      chunksDeleted++;
    }
    const sessionsDeleted = await QuicklookSession.deleteMany({ projectKey });
    const projectDeleted = await QuicklookProject.deleteOne({ projectKey });
    logger.info("quicklook project deleted", {
      projectKey,
      sessionsDeleted: sessionsDeleted.deletedCount,
      chunksDeleted,
      projectDeleted: projectDeleted.deletedCount,
    });
    return {
      sessions: sessionsDeleted.deletedCount,
      chunks: chunksDeleted,
      project: projectDeleted.deletedCount,
    };
  },

  /**
   * Auto-close inactive sessions that haven't received chunks in the specified timeout period.
   * Also recalculates pages and duration for closed sessions.
   * @param {number} inactivityTimeoutMs - Timeout in milliseconds (default: 5 minutes)
   */
  async autoCloseInactiveSessions(inactivityTimeoutMs = 5 * 60 * 1000) {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - inactivityTimeoutMs);
    
    // Find active sessions that haven't received chunks recently
    // We check the most recent chunk's createdAt time, or session updatedAt as fallback
    const activeSessions = await QuicklookSession.find({ status: "active" }).lean();
    let closedCount = 0;
    
    for (const session of activeSessions) {
      // Get the most recent chunk for this session
      const latestChunk = await chunkStorage.getLatestChunk(session.sessionId);
      
      // Determine last activity time:
      // 1. Use latest chunk's createdAt if chunks exist
      // 2. Fall back to session's createdAt if no chunks exist
      const lastActivityTime = latestChunk?.createdAt ?? session.createdAt;
      const lastActivity = lastActivityTime instanceof Date ? lastActivityTime : new Date(lastActivityTime);
      
      if (lastActivity < cutoffTime) {
        // Close this session
        const sessionDoc = await QuicklookSession.findOne({ sessionId: session.sessionId });
        if (sessionDoc && sessionDoc.status === "active") {
          const closedAt = new Date();
          sessionDoc.status = "closed";
          sessionDoc.closedAt = closedAt;
          
          // Calculate duration
          const createdAt = sessionDoc.createdAt instanceof Date ? sessionDoc.createdAt : new Date(sessionDoc.createdAt);
          sessionDoc.duration = closedAt.getTime() - createdAt.getTime();
          
          // Recalculate pages and event count from all chunks
          const allChunks = await chunkStorage.getChunks(session.sessionId);
          const allEvents = allChunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
          const allHrefs = new Set(
            allEvents.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean)
          );
          if (allHrefs.size > 0) {
            sessionDoc.pages = [...allHrefs];
            sessionDoc.pageCount = sessionDoc.pages.length;
          }
          
          // Update chunk count and event count
          sessionDoc.chunkCount = allChunks.length;
          sessionDoc.eventCount = allEvents.length;
          
          await sessionDoc.save();
          closedCount++;
        }
      }
    }
    
    logger.info("quicklook auto-close inactive sessions", { closedCount, inactivityTimeoutMs });
    return { closed: closedCount };
  },

  /** Create or refresh a public share token for a session. Caller must own the project. */
  async createShareToken(sessionId, userId, expiresInDays = 7) {
    const session = await QuicklookSession.findOne({ sessionId }).select("projectKey").lean();
    if (!session) return null;
    const project = await QuicklookProject.findOne({ projectKey: session.projectKey }).select("owner").lean();
    if (!project || String(project.owner) !== String(userId)) return null;
    const crypto = await import("crypto");
    const shareToken = crypto.randomBytes(24).toString("base64url");
    const shareExpiresAt = new Date(Date.now() + expiresInDays * 86400000);
    await QuicklookSession.updateOne(
      { sessionId },
      { $set: { shareToken, shareExpiresAt } }
    );
    return { shareToken, shareExpiresAt };
  },

  /** Revoke public share for a session. Caller must own the project. */
  async revokeShareToken(sessionId, userId) {
    const session = await QuicklookSession.findOne({ sessionId }).select("projectKey").lean();
    if (!session) return false;
    const project = await QuicklookProject.findOne({ projectKey: session.projectKey }).select("owner").lean();
    if (!project || String(project.owner) !== String(userId)) return false;
    await QuicklookSession.updateOne(
      { sessionId },
      { $unset: { shareToken: "", shareExpiresAt: "" } }
    );
    return true;
  },

  /** Get session by share token for public viewing. Returns null if token invalid or expired. */
  async getSessionByShareToken(shareToken) {
    if (!shareToken || typeof shareToken !== "string") return null;
    const session = await QuicklookSession.findOne({
      shareToken: shareToken.trim(),
      $or: [{ shareExpiresAt: { $exists: false } }, { shareExpiresAt: { $gt: new Date() } }],
    }).lean();
    return session;
  },
};
