"use strict";

import { QuicklookService } from "../services/quicklookService.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import { generateId, generateApiKey } from "../models/quicklookProjectModel.js";
import { getRealClientIP } from "../utils/getRealClientIP.js";
import { getGeoFromIP } from "../utils/geoFromIP.js";
import { getRetentionDaysByPlan } from "../utils/retentionConfig.js";
import User from "../models/userModel.js";
import logger from "../configs/loggingConfig.js";

/** If project not found or not owned by userId, returns response and null; else returns project. */
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

export const startSession = async (req, res) => {
  try {
    const ipAddress = getRealClientIP(req);
    const { projectKey, meta, user, attributes, parentSessionId, sessionChainId, sequenceNumber, splitReason } = req.body || {};
    if (!projectKey || typeof projectKey !== "string") {
      return res.status(200).json({ success: false, error: "projectKey required" });
    }
    // retentionDays is now set automatically from project's plan-based retention
    const geo = ipAddress ? await getGeoFromIP(ipAddress) : null;
    const result = await QuicklookService.startSession({
      projectKey,
      meta,
      user,
      ipAddress,
      geo,
      attributes,
      parentSessionId,
      sessionChainId,
      sequenceNumber,
      splitReason,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    logger.error("quicklook startSession", { error: err.message });
    if (err.message === "Session limit reached") {
      return res.status(402).json({ success: false, error: err.message });
    }
    return res.status(200).json({ success: false, error: err.message });
  }
};

export const saveChunk = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { index, data, compressed } = req.body || {};
    if (!sessionId) {
      return res.status(200).json({ success: false, error: "sessionId required" });
    }
    await QuicklookService.saveChunk({ sessionId, index, data, compressed });
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("quicklook saveChunk", { error: err.message });
    return res.status(200).json({ success: false, error: err.message });
  }
};

export const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const body = req.body || {};
    if (!sessionId) {
      return res.status(200).json({ success: false, error: "sessionId required" });
    }
    await QuicklookService.endSession(sessionId, body);
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error("quicklook endSession", { error: err.message });
    return res.status(200).json({ success: false, error: err.message });
  }
};

export const getSessions = async (req, res) => {
  try {
    const { projectKey, status, from, to, limit, skip } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const result = await QuicklookService.getSessions({
      projectKey,
      status,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });
    return res.json(result);
  } catch (err) {
    logger.error("quicklook getSessions", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    return res.json({ success: true, data: session });
  } catch (err) {
    logger.error("quicklook getSession", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    const result = await QuicklookService.getSessionEvents(sessionId);
    return res.json(result);
  } catch (err) {
    logger.error("quicklook getEvents", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await QuicklookProject.find({ owner: req.user.userId })
      .sort({ createdAt: -1 })
      .select("projectId projectKey name allowedDomains excludedUrls retentionDays createdAt updatedAt")
      .lean();
    return res.json({ success: true, data: projects });
  } catch (err) {
    logger.error("quicklook getProjects", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Public: returns project config for SDK (excludedUrls). No auth. */
export const getProjectConfig = async (req, res) => {
  try {
    const { projectKey } = req.params;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey required" });
    }
    const project = await QuicklookProject.findOne({ projectKey }).select("excludedUrls").lean();
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    return res.json({
      success: true,
      excludedUrls: Array.isArray(project.excludedUrls) ? project.excludedUrls : [],
    });
  } catch (err) {
    logger.error("quicklook getProjectConfig", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Auth: get single project for settings. */
export const getProject = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    return res.json({
      success: true,
      data: {
        projectId: project.projectId,
        projectKey: project.projectKey,
        name: project.name,
        allowedDomains: project.allowedDomains || [],
        excludedUrls: project.excludedUrls || [],
        retentionDays: project.retentionDays,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (err) {
    logger.error("quicklook getProject", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Auth: update project (excludedUrls, name, allowedDomains). Retention is set automatically based on plan. */
export const updateProject = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const { name, allowedDomains, excludedUrls } = req.body || {};
    const update = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (Array.isArray(allowedDomains)) {
      update.allowedDomains = allowedDomains.map((d) => String(d).trim()).filter(Boolean);
    }
    if (Array.isArray(excludedUrls)) {
      update.excludedUrls = excludedUrls.map((u) => String(u).trim()).filter(Boolean);
    }
    // Note: retentionDays is not updatable - it's set automatically based on user's plan
    await QuicklookProject.updateOne({ projectKey }, { $set: update });
    const updated = await QuicklookProject.findOne({ projectKey }).lean();
    return res.json({
      success: true,
      data: {
        projectId: updated.projectId,
        projectKey: updated.projectKey,
        name: updated.name,
        allowedDomains: updated.allowedDomains || [],
        excludedUrls: updated.excludedUrls || [],
        retentionDays: updated.retentionDays,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    logger.error("quicklook updateProject", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, allowedDomains } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name is required" });
    }
    // Get user's plan to determine retention days
    const user = await User.findById(req.user.userId).select("plan").lean();
    const userPlan = user?.plan || "free";
    const retentionDays = getRetentionDaysByPlan(userPlan);
    
    const projectId = generateId();
    const projectKey = generateId();
    const apiKey = generateApiKey();
    const domains = Array.isArray(allowedDomains)
      ? allowedDomains.map((d) => String(d).trim()).filter(Boolean)
      : [];
    const project = new QuicklookProject({
      projectId,
      projectKey,
      name: name.trim(),
      owner: req.user.userId,
      apiKey,
      retentionDays,
      allowedDomains: domains,
    });
    await project.save();
    return res.status(201).json({
      success: true,
      data: {
        projectId: project.projectId,
        projectKey: project.projectKey,
        name: project.name,
        owner: project.owner,
        apiKey: project.apiKey,
        retentionDays: project.retentionDays,
        allowedDomains: project.allowedDomains,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (err) {
    logger.error("quicklook createProject", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { projectKey } = req.params;
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const result = await QuicklookService.deleteProject(projectKey);
    return res.json({
      success: true,
      message: "Project and all associated data deleted successfully",
      deletedCounts: result,
    });
  } catch (err) {
    logger.error("quicklook deleteProject", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Proxy to analytics: ensure session has AI summary (on-demand). Requires auth; session must belong to user's project. */
export const ensureSummary = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (!base) {
      return res.status(503).json({
        success: false,
        error: "Analytics service not configured (QUICKLOOK_ANALYTICS_URL)",
      });
    }
    const url = `${base.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/ensure-summary`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data || { success: false, error: "Analytics request failed" });
    }
    return res.json(data);
  } catch (err) {
    logger.error("quicklook ensureSummary", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Proxy to analytics: ensure session friction points have root cause (on-demand). */
export const ensureRootCause = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (!base) {
      return res.status(503).json({
        success: false,
        error: "Analytics service not configured (QUICKLOOK_ANALYTICS_URL)",
      });
    }
    const url = `${base.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/ensure-root-cause`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data || { success: false, error: "Analytics request failed" });
    }
    return res.json(data);
  } catch (err) {
    logger.error("quicklook ensureRootCause", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
