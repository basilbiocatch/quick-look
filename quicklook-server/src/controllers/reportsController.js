"use strict";

import QuicklookReport from "../models/quicklookReportModel.js";
import { hasReachedSessionCap } from "../services/quicklookService.js";
import logger from "../configs/loggingConfig.js";
import { getProjectForUser, canEditSessions } from "../utils/projectAccess.js";

/** GET /reports?projectKey=...&limit=20&type=weekly */
export const getReports = async (req, res) => {
  try {
    const { projectKey, limit = "20", type } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
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
    const access = await getProjectForUser(report.projectKey, req.user.userId, res);
    if (!access) return;
    return res.json({ success: true, data: report });
  } catch (err) {
    logger.error("quicklook getReportById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** POST /reports/generate - proxy to analytics. Body or query: projectKey, type=weekly|daily|monthly */
export const postReportsGenerate = async (req, res) => {
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
        error: "projectKey is required",
      });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!canEditSessions(access.role)) {
      return res.status(403).json({ success: false, error: "Viewers cannot generate reports.", code: "FORBIDDEN_VIEWER" });
    }
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
