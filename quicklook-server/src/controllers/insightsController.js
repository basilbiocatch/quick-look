"use strict";

import QuicklookInsight from "../models/quicklookInsightModel.js";
import { hasReachedSessionCap } from "../services/quicklookService.js";
import logger from "../configs/loggingConfig.js";
import { getProjectForUser, canEditSessions } from "../utils/projectAccess.js";

/** GET /insights?projectKey=...&status=...&limit=50 */
export const getInsights = async (req, res) => {
  try {
    const { projectKey, status, limit = "50" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    const filter = { projectKey };
    if (status && ["active", "resolved", "ignored"].includes(status)) {
      filter.status = status;
    }
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const insights = await QuicklookInsight.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();
    return res.json({ success: true, data: insights });
  } catch (err) {
    logger.error("quicklook getInsights", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** GET /insights/:insightId */
export const getInsightById = async (req, res) => {
  try {
    const { insightId } = req.params;
    const insight = await QuicklookInsight.findOne({ insightId }).lean();
    if (!insight) {
      return res.status(404).json({ success: false, error: "Insight not found" });
    }
    const access = await getProjectForUser(insight.projectKey, req.user.userId, res);
    if (!access) return;
    return res.json({ success: true, data: insight });
  } catch (err) {
    logger.error("quicklook getInsightById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** PATCH /insights/:insightId - body: { status?, notes?, accuracyRating?, actualLift? } */
export const patchInsight = async (req, res) => {
  try {
    const { insightId } = req.params;
    const { status, notes, accuracyRating, actualLift } = req.body || {};
    const insight = await QuicklookInsight.findOne({ insightId });
    if (!insight) {
      return res.status(404).json({ success: false, error: "Insight not found" });
    }
    const access = await getProjectForUser(insight.projectKey, req.user.userId, res);
    if (!access) return;
    if (!canEditSessions(access.role)) {
      return res.status(403).json({ success: false, error: "Viewers cannot edit insights.", code: "FORBIDDEN_VIEWER" });
    }
    const update = { updatedAt: new Date() };
    if (status && ["active", "resolved", "ignored"].includes(status)) {
      update.status = status;
      if (status === "resolved") {
        update.resolvedAt = new Date();
      }
    }
    if (notes !== undefined) {
      update.notes = notes;
    }
    if (accuracyRating !== undefined && accuracyRating !== null) {
      const r = Number(accuracyRating);
      if (r >= 1 && r <= 5) update.accuracyRating = r;
    }
    if (actualLift !== undefined && actualLift !== null && !Number.isNaN(Number(actualLift))) {
      update.actualLift = Number(actualLift);
    }
    const updated = await QuicklookInsight.findOneAndUpdate(
      { insightId },
      { $set: update },
      { new: true }
    ).lean();
    // Phase 7: notify analytics to update pattern library when resolved with actualLift
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (base && updated.status === "resolved" && updated.actualLift != null) {
      fetch(
        `${base.replace(/\/$/, "")}/patterns/update-from-insight?insightId=${encodeURIComponent(insightId)}`,
        { method: "POST" }
      ).catch((e) => logger.warn("analytics update-from-insight failed", { error: e.message }));
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("quicklook patchInsight", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** POST /insights/generate - proxy to analytics. Body or query: projectKey. */
export const postInsightsGenerate = async (req, res) => {
  try {
    if (await hasReachedSessionCap(req.user.userId)) {
      return res.status(402).json({
        success: false,
        error: "Session limit reached for this billing period. Upgrade to Pro for 5,000 sessions/month.",
        code: "SESSION_CAP_REACHED",
      });
    }
    const projectKey = (req.body?.projectKey ?? req.query?.projectKey ?? "").toString().trim();
    if (!projectKey) {
      return res.status(400).json({
        success: false,
        error: "projectKey is required. Provide it in the request body or as a query parameter.",
      });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!canEditSessions(access.role)) {
      return res.status(403).json({ success: false, error: "Viewers cannot generate insights.", code: "FORBIDDEN_VIEWER" });
    }
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (!base) {
      return res.status(501).json({
        success: false,
        error: "Analytics service not configured (QUICKLOOK_ANALYTICS_URL). Cannot generate insights.",
      });
    }
    const url = `${base.replace(/\/$/, "")}/insights/generate?projectKey=${encodeURIComponent(projectKey)}`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data || { success: false, error: "Analytics request failed" });
    }
    return res.json(data);
  } catch (err) {
    logger.error("quicklook postInsightsGenerate", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
