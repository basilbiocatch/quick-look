"use strict";

import QuicklookInsight from "../models/quicklookInsightModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import logger from "../configs/loggingConfig.js";

/** Ensure user owns the project; if not, send 404/403 and return null. */
async function getProjectForUser(projectKey, userId, res) {
  const project = await QuicklookProject.findOne({ projectKey }).lean();
  if (!project) {
    res.status(404).json({ success: false, error: "Project not found" });
    return null;
  }
  if (project.owner !== userId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return null;
  }
  return project;
}

/** GET /insights?projectKey=...&status=...&limit=50 */
export const getInsights = async (req, res) => {
  try {
    const { projectKey, status, limit = "50" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
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
    const project = await getProjectForUser(insight.projectKey, req.user.userId, res);
    if (!project) return;
    return res.json({ success: true, data: insight });
  } catch (err) {
    logger.error("quicklook getInsightById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** PATCH /insights/:insightId - body: { status?, notes? } */
export const patchInsight = async (req, res) => {
  try {
    const { insightId } = req.params;
    const { status, notes } = req.body || {};
    const insight = await QuicklookInsight.findOne({ insightId });
    if (!insight) {
      return res.status(404).json({ success: false, error: "Insight not found" });
    }
    const project = await getProjectForUser(insight.projectKey, req.user.userId, res);
    if (!project) return;
    const update = { updatedAt: new Date() };
    if (status && ["active", "resolved", "ignored"].includes(status)) {
      update.status = status;
    }
    if (notes !== undefined) {
      update.notes = notes;
    }
    const updated = await QuicklookInsight.findOneAndUpdate(
      { insightId },
      { $set: update },
      { new: true }
    ).lean();
    return res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("quicklook patchInsight", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** POST /insights/generate - proxy to analytics. Body or query: projectKey. */
export const postInsightsGenerate = async (req, res) => {
  try {
    const projectKey = (req.body?.projectKey ?? req.query?.projectKey ?? "").toString().trim();
    if (!projectKey) {
      return res.status(400).json({
        success: false,
        error: "projectKey is required. Provide it in the request body or as a query parameter.",
      });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
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
