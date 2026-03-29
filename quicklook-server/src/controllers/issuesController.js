"use strict";

import Issue from "../models/issueModel.js";
import IssueOccurrence from "../models/issueOccurrenceModel.js";
import QuicklookSession from "../models/quicklookSessionModel.js";
import logger from "../configs/loggingConfig.js";
import { getProjectForUser } from "../utils/projectAccess.js";

/**
 * GET /issues?projectKey=...&type=...&severity=...&segment=...&from=...&to=...&limit=...
 * Returns list of issues for the project, sorted by occurrenceCount desc.
 */
export const getIssues = async (req, res) => {
  try {
    const { projectKey, type, severity, segment, from, to, limit = "100" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;

    const filter = { projectKey };
    if (type && ["javascript_error", "javascript_warning", "network_error"].includes(type)) {
      filter.type = type;
    }
    if (severity && ["error", "warning"].includes(severity)) {
      filter.severity = severity;
    }
    if (from) {
      filter.lastSeen = filter.lastSeen || {};
      filter.lastSeen.$gte = new Date(from);
    }
    if (to) {
      filter.lastSeen = filter.lastSeen || {};
      filter.lastSeen.$lte = new Date(to);
    }

    let issues = await Issue.find(filter).sort({ occurrenceCount: -1, lastSeen: -1 }).limit(Math.min(200, parseInt(limit, 10) || 100)).lean();

    if (segment && segment !== "all") {
      const occurrenceIssueIds = await IssueOccurrence.distinct("issueId", {
        projectKey,
        segment,
      });
      const idSet = new Set(occurrenceIssueIds);
      issues = issues.filter((i) => idSet.has(i.issueId));
    }

    return res.json({ success: true, data: issues });
  } catch (err) {
    logger.error("issues getIssues", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /issues/:issueId?projectKey=...
 * Returns issue detail + occurrences by day (for graph) + affected sessions list.
 */
export const getIssueById = async (req, res) => {
  try {
    const { issueId } = req.params;
    const { projectKey, segment, days = "30" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;

    const issue = await Issue.findOne({ issueId, projectKey }).lean();
    if (!issue) {
      return res.status(404).json({ success: false, error: "Issue not found" });
    }

    const daysNum = Math.min(90, Math.max(1, parseInt(days, 10) || 30));
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysNum);
    fromDate.setUTCHours(0, 0, 0, 0);

    const occurrenceMatch = { issueId, timestamp: { $gte: fromDate } };
    if (segment && segment !== "all") {
      occurrenceMatch.segment = segment;
    }

    const occurrences = await IssueOccurrence.find(occurrenceMatch)
      .select("timestamp sessionId")
      .sort({ timestamp: 1 })
      .lean();

    const bucketsByDay = {};
    for (const o of occurrences) {
      const d = new Date(o.timestamp);
      const key = d.toISOString().slice(0, 10);
      bucketsByDay[key] = (bucketsByDay[key] || 0) + 1;
    }
    const occurrencesOverTime = Object.entries(bucketsByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const uniqueSessionIds = [...new Set(occurrences.map((o) => o.sessionId))];
    const sessionsLimit = 100;
    const sessionIdsToFetch = uniqueSessionIds.slice(0, sessionsLimit);
    const sessions = await QuicklookSession.find({
      sessionId: { $in: sessionIdsToFetch },
      projectKey,
    })
      .select("sessionId createdAt closedAt meta pages")
      .sort({ closedAt: -1 })
      .lean();

    const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]));
    const affectedSessions = occurrences
      .reduce((acc, o) => {
        if (acc.some((a) => a.sessionId === o.sessionId)) return acc;
        const sess = sessionMap.get(o.sessionId);
        acc.push({
          sessionId: o.sessionId,
          timestamp: o.timestamp,
          createdAt: sess?.createdAt,
          closedAt: sess?.closedAt,
          pages: sess?.pages,
        });
        return acc;
      }, [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, sessionsLimit);

    return res.json({
      success: true,
      data: {
        issue,
        occurrencesOverTime,
        affectedSessions,
      },
    });
  } catch (err) {
    logger.error("issues getIssueById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /issues/daily?projectKey=...&segment=...&days=30
 * Returns errors and warnings count per day for the last N days.
 */
export const getIssuesDaily = async (req, res) => {
  try {
    const { projectKey, segment, days = "30" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;

    const daysNum = Math.min(90, Math.max(1, parseInt(days, 10) || 30));
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysNum);
    fromDate.setUTCHours(0, 0, 0, 0);
    toDate.setUTCHours(23, 59, 59, 999);

    const match = {
      projectKey,
      timestamp: { $gte: fromDate, $lte: toDate },
    };
    if (segment && segment !== "all") {
      match.segment = segment;
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "quicklook_issues",
          localField: "issueId",
          foreignField: "issueId",
          as: "issue",
        },
      },
      { $unwind: "$issue" },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            severity: "$issue.severity",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ];

    const rows = await IssueOccurrence.aggregate(pipeline);

    const byDate = {};
    for (let d = 0; d < daysNum; d++) {
      const dt = new Date(fromDate);
      dt.setDate(dt.getDate() + d);
      const key = dt.toISOString().slice(0, 10);
      byDate[key] = { date: key, errors: 0, warnings: 0 };
    }
    for (const r of rows) {
      const key = r._id.date;
      if (!byDate[key]) byDate[key] = { date: key, errors: 0, warnings: 0 };
      if (r._id.severity === "error") byDate[key].errors += r.count;
      else byDate[key].warnings += r.count;
    }

    const data = Object.keys(byDate)
      .sort()
      .map((k) => byDate[k]);

    return res.json({ success: true, data });
  } catch (err) {
    logger.error("issues getIssuesDaily", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
