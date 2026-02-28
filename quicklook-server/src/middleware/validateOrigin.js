"use strict";

import QuicklookProject from "../models/quicklookProjectModel.js";
import QuicklookSession from "../models/quicklookSessionModel.js";

/**
 * Resolve projectKey for the request. For start it's in body; for chunk/end we look up session.
 */
async function getProjectKey(req) {
  if (req.body?.projectKey && typeof req.body.projectKey === "string") {
    return req.body.projectKey.trim();
  }
  const sessionId = req.params?.sessionId;
  if (sessionId) {
    const session = await QuicklookSession.findOne({ sessionId }).select("projectKey").lean();
    return session?.projectKey ?? null;
  }
  return null;
}

/**
 * Normalize origin to a comparable form (protocol + host, no trailing slash).
 * Returns null if origin is missing or invalid.
 */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== "string") return null;
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if origin is allowed. allowedDomains can be full origins (https://example.com)
 * or bare hosts (example.com). We compare normalized origin and also origin's host.
 */
function isOriginAllowed(origin, allowedDomains) {
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const originHost = new URL(normalized).host.toLowerCase();
  for (const allowed of allowedDomains) {
    const s = String(allowed).trim().toLowerCase();
    if (!s) continue;
    if (s === normalized || s === originHost) return true;
    if (s.startsWith("http") && normalizeOrigin(s) === normalized) return true;
  }
  return false;
}

/**
 * Middleware: validate request Origin header against the project's allowedDomains.
 * Use on public POST routes (sessions/start, sessions/:sessionId/chunk, sessions/:sessionId/end).
 * Returns 403 if project exists and has allowedDomains but origin is not in the list.
 */
export function validateOrigin(req, res, next) {
  (async () => {
    const projectKey = await getProjectKey(req);
    if (!projectKey) {
      return next();
    }
    const project = await QuicklookProject.findOne({ projectKey }).select("allowedDomains").lean();
    if (!project) {
      return next();
    }
    const allowedDomains = project.allowedDomains;
    if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) {
      return next();
    }
    const origin = req.headers.origin;
    if (isOriginAllowed(origin, allowedDomains)) {
      return next();
    }
    return res.status(403).json({ success: false, error: "Origin not allowed for this project" });
  })().catch((err) => {
    next(err);
  });
}
