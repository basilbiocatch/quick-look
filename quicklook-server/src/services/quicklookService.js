"use strict";

import { v4 as uuidv4 } from "uuid";
import zlib from "zlib";
import QuicklookSession from "../models/quicklookSessionModel.js";
import QuicklookChunk from "../models/quicklookChunkModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import User from "../models/userModel.js";
import logger from "../configs/loggingConfig.js";

const SESSION_CAP_WINDOW_DAYS = 30;

function decompressChunkData(data, compressed) {
  if (!compressed || !data) return data;
  try {
    const buf = Buffer.from(data, "base64");
    const decompressed = zlib.gunzipSync(buf);
    return JSON.parse(decompressed.toString("utf8"));
  } catch (err) {
    logger.error("quicklookService: decompress failed", { error: err.message });
    throw err;
  }
}

export const QuicklookService = {
  async startSession({ projectKey, meta, user, ipAddress, retentionDays, geo = null, attributes = null, parentSessionId = null, sessionChainId = null, sequenceNumber = 1, splitReason = null }) {
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
    const doc = new QuicklookSession({
      sessionId,
      projectKey: String(projectKey).slice(0, 256),
      status: "active",
      meta: metaWithLocation,
      user: user || {},
      ipAddress: ipAddress || null,
      retentionDays: sessionRetentionDays,
      ...(attributes != null && typeof attributes === "object" && !Array.isArray(attributes)
        ? { attributes }
        : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(sessionChainId ? { sessionChainId } : {}),
      sequenceNumber: sequenceNumber || 1,
      ...(splitReason ? { splitReason } : {}),
    });
    await doc.save();
    return { sessionId, sessionChainId: doc.sessionChainId };
  },

  async saveChunk({ sessionId, index, data, compressed }) {
    const events = Array.isArray(data) ? data : decompressChunkData(data, compressed);
    if (!Array.isArray(events)) {
      throw new Error("Chunk data must be an array of events");
    }
    await QuicklookChunk.findOneAndUpdate(
      { sessionId, index },
      { sessionId, index, events },
      { upsert: true }
    );
    const session = await QuicklookSession.findOne({ sessionId });
    if (session) {
      session.chunkCount = await QuicklookChunk.countDocuments({ sessionId });
      const existing = new Set(Array.isArray(session.pages) ? session.pages : []);
      const hrefsFromChunk = events.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean);
      for (const href of hrefsFromChunk) existing.add(href);
      if (existing.size > 0) {
        session.pages = [...existing];
        session.pageCount = session.pages.length;
      }
      if (session.pageCount === 0 && session.chunkCount > 0) {
        const allChunks = await QuicklookChunk.find({ sessionId }).sort({ index: 1 }).lean();
        const allEvents = allChunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
        const allHrefs = new Set(
          allEvents.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean)
        );
        if (allHrefs.size > 0) {
          session.pages = [...allHrefs];
          session.pageCount = session.pages.length;
        }
      }
      await session.save();
    }
    logger.info("quicklook chunk saved", { sessionId: sessionId?.slice(0, 8), index, eventCount: events.length });
    return { success: true };
  },

  async endSession(sessionId, { data, index }) {
    if (data != null && Array.isArray(data)) {
      await this.saveChunk({ sessionId, index: index ?? 0, data, compressed: false });
    } else if (data != null && index != null) {
      const events = decompressChunkData(data, true);
      await this.saveChunk({ sessionId, index, data: events, compressed: false });
    }
    const session = await QuicklookSession.findOne({ sessionId });
    if (!session) return { success: true };
    
    // Recalculate pages from all chunks before closing
    const allChunks = await QuicklookChunk.find({ sessionId }).sort({ index: 1 }).lean();
    const allEvents = allChunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
    const allHrefs = new Set(
      allEvents.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean)
    );
    if (allHrefs.size > 0) {
      session.pages = [...allHrefs];
      session.pageCount = session.pages.length;
    }
    
    // Update chunk count
    session.chunkCount = allChunks.length;
    
    session.status = "closed";
    const closedAt = new Date();
    session.closedAt = closedAt;
    // Calculate duration properly: convert both dates to timestamps
    if (session.createdAt) {
      const createdAt = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt);
      session.duration = closedAt.getTime() - createdAt.getTime();
    }
    await session.save();
    return { success: true };
  },

  async getSessions({ projectKey, status, from, to, limit = 50, skip = 0 }) {
    const query = {};
    if (projectKey) query.projectKey = projectKey;
    if (status) query.status = status;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    const total = await QuicklookSession.countDocuments(query);
    const data = await QuicklookSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Math.min(limit, 200))
      .lean();

    const now = Date.now();
    for (const session of data) {
      if (session.status === "active" && session.createdAt) {
        const createdAt = session.createdAt instanceof Date
          ? session.createdAt.getTime()
          : new Date(session.createdAt).getTime();
        session.duration = now - createdAt;
      }
    }

    return { success: true, data, total, limit, skip };
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
    const chunks = await QuicklookChunk.find({ sessionId })
      .select("index events")
      .sort({ index: 1 })
      .lean();
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

  async purgeExpiredSessions() {
    const now = new Date();
    const expired = await QuicklookSession.find({ expiresAt: { $lt: now } }).select("sessionId").lean();
    let deleted = 0;
    for (const s of expired) {
      await QuicklookChunk.deleteMany({ sessionId: s.sessionId });
      await QuicklookSession.deleteOne({ sessionId: s.sessionId });
      deleted++;
    }
    return { deleted };
  },

  async deleteProject(projectKey) {
    const sessions = await QuicklookSession.find({ projectKey }).select("sessionId").lean();
    const sessionIds = sessions.map((s) => s.sessionId);
    const chunksDeleted = await QuicklookChunk.deleteMany({ sessionId: { $in: sessionIds } });
    const sessionsDeleted = await QuicklookSession.deleteMany({ projectKey });
    const projectDeleted = await QuicklookProject.deleteOne({ projectKey });
    logger.info("quicklook project deleted", {
      projectKey,
      sessionsDeleted: sessionsDeleted.deletedCount,
      chunksDeleted: chunksDeleted.deletedCount,
      projectDeleted: projectDeleted.deletedCount,
    });
    return {
      sessions: sessionsDeleted.deletedCount,
      chunks: chunksDeleted.deletedCount,
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
      const latestChunk = await QuicklookChunk.findOne({ sessionId: session.sessionId })
        .sort({ createdAt: -1 })
        .lean();
      
      // Determine last activity time:
      // 1. Use latest chunk's createdAt if chunks exist
      // 2. Fall back to session's createdAt if no chunks exist
      const lastActivityTime = latestChunk?.createdAt || session.createdAt;
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
          
          // Recalculate pages from all chunks
          const allChunks = await QuicklookChunk.find({ sessionId: session.sessionId }).sort({ index: 1 }).lean();
          const allEvents = allChunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
          const allHrefs = new Set(
            allEvents.filter((e) => e.type === 4 && e.data?.href).map((e) => String(e.data.href).trim()).filter(Boolean)
          );
          if (allHrefs.size > 0) {
            sessionDoc.pages = [...allHrefs];
            sessionDoc.pageCount = sessionDoc.pages.length;
          }
          
          // Update chunk count
          sessionDoc.chunkCount = allChunks.length;
          
          await sessionDoc.save();
          closedCount++;
        }
      }
    }
    
    logger.info("quicklook auto-close inactive sessions", { closedCount, inactivityTimeoutMs });
    return { closed: closedCount };
  },
};
