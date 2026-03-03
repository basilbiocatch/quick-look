"use strict";

import QuicklookReport from "../models/quicklookReportModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import logger from "../configs/loggingConfig.js";

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

/** GET /reports?projectKey=...&limit=20&type=weekly */
export const getReports = async (req, res) => {
  try {
    const { projectKey, limit = "20", type } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const filter = { projectKey };
    if (type && ["daily", "weekly", "monthly"].includes(type)) {
      filter.type = type;
    }
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const reports = await QuicklookReport.find(filter)
      .sort({ generatedAt: -1 })
      .limit(limitNum)
      .lean();
    return res.json({ success: true, data: reports });
  } catch (err) {
    logger.error("quicklook getReports", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** GET /reports/:reportId */
export const getReportById = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await QuicklookReport.findOne({ reportId }).lean();
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    const project = await getProjectForUser(report.projectKey, req.user.userId, res);
    if (!project) return;
    return res.json({ success: true, data: report });
  } catch (err) {
    logger.error("quicklook getReportById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** POST /reports/generate - proxy to analytics. Body or query: projectKey, type=weekly|daily|monthly */
export const postReportsGenerate = async (req, res) => {
  try {
    const projectKey = (req.body?.projectKey ?? req.query?.projectKey ?? "").toString().trim();
    if (!projectKey) {
      return res.status(400).json({
        success: false,
        error: "projectKey is required",
      });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (!base) {
      return res.status(501).json({
        success: false,
        error: "Analytics service not configured (QUICKLOOK_ANALYTICS_URL). Cannot generate reports.",
      });
    }
    const type = (req.body?.type ?? req.query?.type ?? "weekly").toString().toLowerCase();
    const useLlm = (req.body?.use_llm ?? req.query?.use_llm ?? "1").toString();
    const url = `${base.replace(/\/$/, "")}/reports/generate?projectKey=${encodeURIComponent(projectKey)}&type=${encodeURIComponent(type)}&use_llm=${encodeURIComponent(useLlm)}`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data || { success: false, error: "Analytics request failed" });
    }
    return res.json(data);
  } catch (err) {
    logger.error("quicklook postReportsGenerate", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
