"use strict";

import { v4 as uuidv4 } from "uuid";
import QuicklookTrackedEvent from "../models/quicklookTrackedEventModel.js";
import QuicklookSession from "../models/quicklookSessionModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import logger from "../configs/loggingConfig.js";

const MAX_NAME_LENGTH = 128;
const MAX_PROPERTIES_BYTES = 8192;
const MAX_PROPERTIES_KEYS = 64;
const MAX_DATE_RANGE_MS = 90 * 86400000;
const DEFAULT_SUMMARY_LIMIT = 100;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateProperties(properties) {
  if (properties === undefined || properties === null) return { ok: true, value: undefined };
  if (typeof properties !== "object" || Array.isArray(properties)) {
    return { ok: false, error: "properties must be a plain object" };
  }
  if (Object.keys(properties).length > MAX_PROPERTIES_KEYS) {
    return { ok: false, error: `properties may have at most ${MAX_PROPERTIES_KEYS} keys` };
  }
  let json;
  try {
    json = JSON.stringify(properties);
  } catch {
    return { ok: false, error: "properties must be JSON-serializable" };
  }
  if (json.length > MAX_PROPERTIES_BYTES) {
    return { ok: false, error: `properties JSON must be at most ${MAX_PROPERTIES_BYTES} bytes` };
  }
  return { ok: true, value: properties };
}

/** Ensure user owns the project; if not, send 404/403 and return null. */
async function getProjectForUser(projectKey, userId, res) {
  const project = await QuicklookProject.findOne({ projectKey }).lean();
  if (!project) {
    res.status(404).json({ success: false, error: "Project not found" });
    return null;
  }
  const ownerStr = project.owner != null ? String(project.owner) : "";
  const userIdStr = userId != null ? String(userId) : "";
  if (ownerStr !== userIdStr) {
    res.status(403).json({ success: false, error: "You don't have access to this project." });
    return null;
  }
  return project;
}

function parseRange(fromStr, toStr) {
  if (!fromStr || !toStr) {
    return { error: "from and to (ISO date) are required" };
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { error: "from and to must be valid ISO dates" };
  }
  if (from > to) {
    return { error: "from must be before or equal to to" };
  }
  if (to.getTime() - from.getTime() > MAX_DATE_RANGE_MS) {
    return { error: "Date range may not exceed 90 days" };
  }
  return { from, to };
}

/**
 * POST /sessions/:sessionId/track — public SDK; validateOrigin applies.
 */
export const postTrack = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, properties, timestamp } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "sessionId required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name is required (non-empty string)" });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ success: false, error: `name must be at most ${MAX_NAME_LENGTH} characters` });
    }
    const propCheck = validateProperties(properties);
    if (!propCheck.ok) {
      return res.status(400).json({ success: false, error: propCheck.error });
    }

    const session = await QuicklookSession.findOne({ sessionId }).select("projectKey").lean();
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }

    let clientTimestamp;
    if (timestamp != null) {
      const t = typeof timestamp === "number" ? timestamp : Date.parse(String(timestamp));
      if (!Number.isNaN(t)) {
        clientTimestamp = new Date(t);
      }
    }

    const doc = {
      eventId: uuidv4(),
      projectKey: session.projectKey,
      sessionId,
      name: trimmedName,
      properties: propCheck.value,
      clientTimestamp,
      createdAt: new Date(),
    };

    await QuicklookTrackedEvent.create(doc);
    return res.status(200).json({ success: true, eventId: doc.eventId });
  } catch (err) {
    logger.error("trackedEvents.postTrack", { error: err.message });
    return res.status(500).json({ success: false, error: "Failed to record event" });
  }
};

/**
 * GET /projects/:projectKey/events/summary
 */
export const getEventsSummary = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const { from: fromStr, to: toStr, name: nameFilter, sort = "count_desc", limit = String(DEFAULT_SUMMARY_LIMIT) } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;

    const range = parseRange(fromStr, toStr);
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }
    const { from, to } = range;

    const match = {
      projectKey,
      createdAt: { $gte: from, $lte: to },
    };
    if (nameFilter && String(nameFilter).trim()) {
      const prefix = escapeRegex(String(nameFilter).trim());
      match.name = { $regex: new RegExp(`^${prefix}`, "i") };
    }

    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || DEFAULT_SUMMARY_LIMIT));

    let sortStage;
    switch (sort) {
      case "count_asc":
        sortStage = { count: 1, name: 1 };
        break;
      case "name_asc":
        sortStage = { name: 1 };
        break;
      case "name_desc":
        sortStage = { name: -1 };
        break;
      case "count_desc":
      default:
        sortStage = { count: -1, name: 1 };
    }

    const rows = await QuicklookTrackedEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$name",
          count: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
          uniqueSessions: { $size: "$sessions" },
        },
      },
      { $sort: sortStage },
      { $limit: limitNum },
    ]);

    return res.json({ success: true, data: rows, meta: { from: from.toISOString(), to: to.toISOString(), sort, limit: limitNum } });
  } catch (err) {
    logger.error("trackedEvents.getEventsSummary", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /projects/:projectKey/event-names
 */
export const getEventNames = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const { from: fromStr, to: toStr } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;

    const range = parseRange(fromStr, toStr);
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }
    const { from, to } = range;

    const names = await QuicklookTrackedEvent.distinct("name", {
      projectKey,
      createdAt: { $gte: from, $lte: to },
    });
    names.sort((a, b) => String(a).localeCompare(String(b)));
    return res.json({ success: true, data: names, meta: { from: from.toISOString(), to: to.toISOString() } });
  } catch (err) {
    logger.error("trackedEvents.getEventNames", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

const TOP_SERIES_NAMES = 6;

/**
 * GET /projects/:projectKey/events/analytics — totals, daily volume, stacked top event names
 */
export const getEventsAnalytics = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const { from: fromStr, to: toStr, name: nameFilter } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;

    const range = parseRange(fromStr, toStr);
    if (range.error) {
      return res.status(400).json({ success: false, error: range.error });
    }
    const { from, to } = range;

    const match = {
      projectKey,
      createdAt: { $gte: from, $lte: to },
    };
    if (nameFilter && String(nameFilter).trim()) {
      const prefix = escapeRegex(String(nameFilter).trim());
      match.name = { $regex: new RegExp(`^${prefix}`, "i") };
    }

    const [totalsRow] = await QuicklookTrackedEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
          names: { $addToSet: "$name" },
        },
      },
      {
        $project: {
          _id: 0,
          totalEvents: 1,
          uniqueSessions: { $size: "$sessions" },
          uniqueEventNames: { $size: "$names" },
        },
      },
    ]);

    const totals = totalsRow || { totalEvents: 0, uniqueSessions: 0, uniqueEventNames: 0 };
    const te = totals.totalEvents || 0;
    const us = totals.uniqueSessions || 0;
    totals.avgEventsPerSession = us > 0 ? Math.round((te / us) * 100) / 100 : 0;

    const daily = await QuicklookTrackedEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          count: { $sum: 1 },
          sessions: { $addToSet: "$sessionId" },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
          uniqueSessions: { $size: "$sessions" },
        },
      },
      { $sort: { date: 1 } },
    ]);

    const topNamesAgg = await QuicklookTrackedEvent.aggregate([
      { $match: match },
      { $group: { _id: "$name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: TOP_SERIES_NAMES },
    ]);
    const topNames = topNamesAgg.map((r) => r._id).filter(Boolean);

    let stackedByDay = [];
    if (topNames.length > 0) {
      const seriesMatch = { ...match, name: { $in: topNames } };
      const byDayName = await QuicklookTrackedEvent.aggregate([
        { $match: seriesMatch },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
              name: "$name",
            },
            count: { $sum: 1 },
          },
        },
      ]);

      const daySet = new Set(daily.map((d) => d.date));
      byDayName.forEach((row) => {
        if (row._id?.day) daySet.add(row._id.day);
      });
      const sortedDays = [...daySet].sort();

      const map = new Map();
      byDayName.forEach((row) => {
        const d = row._id?.day;
        const n = row._id?.name;
        if (!d || !n) return;
        const key = `${d}\0${n}`;
        map.set(key, row.count);
      });

      // Use indexed keys (s0, s1, …) so event names like "date" / "label" never overwrite reserved fields.
      stackedByDay = sortedDays.map((dateStr) => {
        const point = { date: dateStr };
        topNames.forEach((n, idx) => {
          point[`s${idx}`] = map.get(`${dateStr}\0${n}`) || 0;
        });
        return point;
      });
    }

    return res.json({
      success: true,
      data: {
        totals,
        daily,
        topNames,
        stackedByDay,
      },
      meta: { from: from.toISOString(), to: to.toISOString() },
    });
  } catch (err) {
    logger.error("trackedEvents.getEventsAnalytics", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /sessions/:sessionId/tracked-events
 */
export const getSessionTrackedEvents = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "sessionId is required" });
    }
    const session = await QuicklookSession.findOne({ sessionId }).lean();
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;

    const events = await QuicklookTrackedEvent.find({ sessionId })
      .sort({ createdAt: 1 })
      .select({ eventId: 1, name: 1, properties: 1, clientTimestamp: 1, createdAt: 1 })
      .lean();

    return res.json({ success: true, data: events });
  } catch (err) {
    logger.error("trackedEvents.getSessionTrackedEvents", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
