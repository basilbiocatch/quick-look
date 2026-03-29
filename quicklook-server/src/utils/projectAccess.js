"use strict";

import QuicklookProject from "../models/quicklookProjectModel.js";

/** @typedef {"owner" | "editor" | "viewer"} ProjectRole */

/**
 * Load project and resolve the user's role (owner, editor, viewer).
 * @returns {Promise<{ project: object, role: ProjectRole } | null>}
 */
export async function getProjectForUser(projectKey, userId, res) {
  const project = await QuicklookProject.findOne({ projectKey }).lean();
  if (!project) {
    res.status(404).json({ success: false, error: "Project not found" });
    return null;
  }
  const ownerStr = project.owner != null ? String(project.owner) : "";
  const userIdStr = userId != null ? String(userId) : "";
  if (ownerStr === userIdStr) {
    return { project, role: "owner" };
  }
  const member = (project.members || []).find((m) => String(m.userId) === userIdStr);
  if (member) {
    return { project, role: member.role };
  }
  res.status(403).json({
    success: false,
    error: "You don't have access to this project.",
    code: "FORBIDDEN_PROJECT",
  });
  return null;
}

/** Owner or editor can mutate sessions (share, delete session data if any). */
export function canEditSessions(role) {
  return role === "owner" || role === "editor";
}

/** Only owner can change project settings, members, delete project. */
export function canManageProject(role) {
  return role === "owner";
}
