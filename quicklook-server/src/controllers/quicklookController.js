"use strict";

import { QuicklookService, hasReachedSessionCap } from "../services/quicklookService.js";
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
  const ownerStr = project.owner != null ? String(project.owner) : "";
  const userIdStr = userId != null ? String(userId) : "";
  if (ownerStr !== userIdStr) {
    res.status(403).json({
      success: false,
      error: "You don't have access to this project.",
      code: "FORBIDDEN_PROJECT",
    });
    return null;
  }
  return project;
}

export const startSession = async (req, res) => {
  try {
    const ipAddress = getRealClientIP(req);
    const { projectKey, meta, user, attributes, parentSessionId, sessionChainId, sequenceNumber, splitReason, deviceId, deviceFingerprint } = req.body || {};
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
      deviceId: deviceId || undefined,
      deviceFingerprint: deviceFingerprint || undefined,
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
    
    const chunkSize = JSON.stringify(data).length;
    if (chunkSize > 200000) {
      logger.warn("Large chunk detected", {
        sessionId: sessionId?.slice(0, 8),
        index,
        sizeChars: chunkSize,
        sizeKB: (chunkSize / 1024).toFixed(1),
        eventCount: Array.isArray(data) ? data.length : 0,
      });
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

export const updateSessionIdentify = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { user } = req.body || {};
    if (!sessionId) {
      return res.status(200).json({ success: false, error: "sessionId required" });
    }
    if (!user || typeof user !== "object") {
      return res.status(200).json({ success: false, error: "user object required" });
    }
    const result = await QuicklookService.updateSessionUser(sessionId, user);
    return res.status(200).json(result);
  } catch (err) {
    logger.error("quicklook updateSessionIdentify", { error: err.message });
    return res.status(200).json({ success: false, error: err.message });
  }
};

export const getSessions = async (req, res) => {
  try {
    const { projectKey, status, from, to, limit, skip, ipAddress, deviceId, userEmail, sessionIds: sessionIdsParam } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const sessionIds = sessionIdsParam
      ? (Array.isArray(sessionIdsParam) ? sessionIdsParam : String(sessionIdsParam).split(","))
          .map((id) => String(id).trim())
          .filter(Boolean)
      : undefined;
    const result = await QuicklookService.getSessions({
      projectKey,
      status,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
      ipAddress: ipAddress || undefined,
      deviceId: deviceId || undefined,
      userEmail: userEmail || undefined,
      sessionIds,
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
    
    // Log response size for compression monitoring
    const jsonString = JSON.stringify(result);
    const uncompressedSize = Buffer.byteLength(jsonString, 'utf8');
    logger.info("quicklook getEvents", {
      sessionId: sessionId?.slice(0, 8),
      eventCount: result.events?.length || 0,
      uncompressedSize: `${(uncompressedSize / 1024).toFixed(2)} KB`,
      uncompressedChars: jsonString.length,
    });
    
    return res.json(result);
  } catch (err) {
    logger.error("quicklook getEvents", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Fetch a batch of chunks for progressive loading. Query: start=0, limit=5 */
export const getSessionChunks = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const start = Math.max(0, parseInt(req.query.start, 10) || 0);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));

    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;

    const result = await QuicklookService.getSessionChunksBatch(sessionId, start, limit);
    return res.json(result);
  } catch (err) {
    logger.error("quicklook getSessionChunks", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await QuicklookProject.find({ owner: req.user.userId })
      .sort({ createdAt: -1 })
      .select("projectId projectKey name allowedDomains excludedUrls retentionDays createdAt updatedAt thumbnailUrl")
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
    const project = await QuicklookProject.findOne({ projectKey }).select("excludedUrls deviceIdEnabled").lean();
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }
    return res.json({
      success: true,
      excludedUrls: Array.isArray(project.excludedUrls) ? project.excludedUrls : [],
      deviceIdEnabled: Boolean(project.deviceIdEnabled),
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
        deviceIdEnabled: Boolean(project.deviceIdEnabled),
        thumbnailUrl: project.thumbnailUrl || null,
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
    const { name, allowedDomains, excludedUrls, deviceIdEnabled, thumbnailUrl } = req.body || {};
    const update = { updatedAt: new Date() };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (Array.isArray(allowedDomains)) {
      update.allowedDomains = allowedDomains.map((d) => String(d).trim()).filter(Boolean);
    }
    if (Array.isArray(excludedUrls)) {
      update.excludedUrls = excludedUrls.map((u) => String(u).trim()).filter(Boolean);
    }
    if (typeof deviceIdEnabled === "boolean") update.deviceIdEnabled = deviceIdEnabled;
    if (thumbnailUrl !== undefined) update.thumbnailUrl = thumbnailUrl === null || thumbnailUrl === "" ? null : String(thumbnailUrl);
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
        deviceIdEnabled: Boolean(updated.deviceIdEnabled),
        thumbnailUrl: updated.thumbnailUrl || null,
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
    const user = await User.findById(req.user.userId).select("plan").lean();
    const userPlan = user?.plan || "free";
    const retentionDays = getRetentionDaysByPlan(userPlan);

    const projectLimit = userPlan === "pro" ? null : 1;
    if (projectLimit !== null) {
      const count = await QuicklookProject.countDocuments({ owner: req.user.userId });
      if (count >= projectLimit) {
        return res.status(403).json({
          success: false,
          error: "Project limit reached. Upgrade to Pro for unlimited projects.",
          code: "PROJECT_LIMIT_REACHED",
        });
      }
    }

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
    if (await hasReachedSessionCap(req.user.userId)) {
      return res.status(402).json({
        success: false,
        error: "Session limit reached for this billing period. Upgrade to Pro for 5,000 sessions/month.",
        code: "SESSION_CAP_REACHED",
      });
    }
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
    logger.info("ensureSummary proxy", { url });
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      logger.error("ensureSummary: analytics returned non-JSON", { status: response.status, url, body: text.slice(0, 500) });
      return res.status(response.status >= 400 ? response.status : 502).json({
        success: false,
        error: `Analytics returned ${response.status} (non-JSON). Is QUICKLOOK_ANALYTICS_URL (${base}) correct and running?`,
      });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error || data?.detail || `Analytics returned ${response.status}`,
        ...data,
      });
    }
    return res.json(data);
  } catch (err) {
    const cause = err.cause?.message || err.cause?.code || err.message;
    logger.error("quicklook ensureSummary", { error: err.message, cause });
    const message = err.message === "fetch failed" && cause ? `fetch failed: ${cause}` : err.message;
    return res.status(500).json({ success: false, error: message });
  }
};

/** Proxy to analytics: ensure session friction points have root cause (on-demand). */
export const ensureRootCause = async (req, res) => {
  try {
    if (await hasReachedSessionCap(req.user.userId)) {
      return res.status(402).json({
        success: false,
        error: "Session limit reached for this billing period. Upgrade to Pro for 5,000 sessions/month.",
        code: "SESSION_CAP_REACHED",
      });
    }
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
    let url = `${base.replace(/\/$/, "")}/session/${encodeURIComponent(sessionId)}/ensure-root-cause`;
    if (req.query?.force === "1" || req.query?.force === "true") {
      url += "?force=1";
    }
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text().catch(() => "");
      logger.error("ensureRootCause: analytics returned non-JSON", { status: response.status, url, body: text.slice(0, 500) });
      return res.status(response.status >= 400 ? response.status : 502).json({
        success: false,
        error: `Analytics returned ${response.status} (non-JSON). Is QUICKLOOK_ANALYTICS_URL (${base}) correct and running?`,
      });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.error || data?.detail || `Analytics returned ${response.status}`,
        ...data,
      });
    }
    return res.json(data);
  } catch (err) {
    const cause = err.cause?.message || err.cause?.code || err.message;
    logger.error("quicklook ensureRootCause", { error: err.message, cause });
    const message = err.message === "fetch failed" && cause ? `fetch failed: ${cause}` : err.message;
    return res.status(500).json({ success: false, error: message });
  }
};

/** Create public share link for a session. Returns { shareToken, shareUrl, shareExpiresAt }. */
export const createShare = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    const result = await QuicklookService.createShareToken(sessionId, req.user.userId, 7);
    if (!result) {
      return res.status(500).json({ success: false, error: "Failed to create share link" });
    }
    const baseUrl = (req.protocol + "://" + req.get("host") + (req.baseUrl || "")).replace(/\/api\/quicklook$/, "");
    const shareUrl = `${baseUrl}/share/${result.shareToken}`;
    return res.json({
      success: true,
      data: { shareToken: result.shareToken, shareUrl, shareExpiresAt: result.shareExpiresAt },
    });
  } catch (err) {
    logger.error("quicklook createShare", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Revoke public share for a session. */
export const revokeShare = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await QuicklookService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    const project = await getProjectForUser(session.projectKey, req.user.userId, res);
    if (!project) return;
    const ok = await QuicklookService.revokeShareToken(sessionId, req.user.userId);
    if (!ok) {
      return res.status(500).json({ success: false, error: "Failed to revoke share link" });
    }
    return res.json({ success: true, data: { revoked: true } });
  } catch (err) {
    logger.error("quicklook revokeShare", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** Public: get session + events by share token (no auth). */
export const getPublicShare = async (req, res) => {
  try {
    const { shareToken } = req.params;
    const session = await QuicklookService.getSessionByShareToken(shareToken);
    if (!session) {
      return res.status(404).json({ success: false, error: "Share link not found or expired" });
    }
    const eventsResult = await QuicklookService.getSessionEvents(session.sessionId);
    return res.json({
      success: true,
      data: {
        session: { ...session, shareToken: undefined },
        events: eventsResult.events,
        meta: eventsResult.meta,
      },
    });
  } catch (err) {
    logger.error("quicklook getPublicShare", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
