"use strict";

import { QuicklookService } from "../services/quicklookService.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import { generateId, generateApiKey } from "../models/quicklookProjectModel.js";
import { getRealClientIP } from "../utils/getRealClientIP.js";
import { getGeoFromIP } from "../utils/geoFromIP.js";
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
    const { projectKey, meta, user, retentionDays } = req.body || {};
    if (!projectKey || typeof projectKey !== "string") {
      return res.status(200).json({ success: false, error: "projectKey required" });
    }
    const geo = ipAddress ? await getGeoFromIP(ipAddress) : null;
    const { sessionId } = await QuicklookService.startSession({
      projectKey,
      meta,
      user,
      ipAddress,
      retentionDays,
      geo,
    });
    return res.status(200).json({ success: true, sessionId });
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
      .select("projectId projectKey name allowedDomains retentionDays createdAt updatedAt")
      .lean();
    return res.json({ success: true, data: projects });
  } catch (err) {
    logger.error("quicklook getProjects", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const createProject = async (req, res) => {
  try {
    const { name, allowedDomains, retentionDays } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "name is required" });
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
      retentionDays: typeof retentionDays === "number" && retentionDays > 0 ? retentionDays : 30,
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
