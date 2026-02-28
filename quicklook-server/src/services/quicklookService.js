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
  async startSession({ projectKey, meta, user, ipAddress, retentionDays = 30, geo = null }) {
    const project = await QuicklookProject.findOne({ projectKey }).select("owner").lean();
    if (project && project.owner) {
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
      retentionDays,
    });
    await doc.save();
    return { sessionId };
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
    session.status = "closed";
    session.closedAt = new Date();
    if (session.createdAt) {
      session.duration = session.closedAt - session.createdAt;
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
    return { success: true, data, total, limit, skip };
  },

  async getSessionById(sessionId) {
    const session = await QuicklookSession.findOne({ sessionId }).lean();
    return session;
  },

  async getSessionEvents(sessionId) {
    const chunks = await QuicklookChunk.find({ sessionId }).sort({ index: 1 }).lean();
    const events = chunks.flatMap((c) => (Array.isArray(c.events) ? c.events : []));
    const session = await QuicklookSession.findOne({ sessionId }).lean();
    const pages = [];
    const networkEvents = [];
    const consoleEvents = [];
    for (const e of events) {
      if (e.type === 4 && e.data?.href) pages.push(e.data.href);
      if (e.type === 5) {
        if (e.data?.tag === "ql_network") networkEvents.push(e);
        if (e.data?.tag === "ql_console") consoleEvents.push(e);
      }
    }
    return {
      success: true,
      sessionId,
      events,
      meta: {
        chunkCount: chunks.length,
        eventCount: events.length,
        pages: [...new Set(pages)],
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
};
