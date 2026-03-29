"use strict";

import ProjectInvitation from "../models/projectInvitationModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";

export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Accept a pending project invitation for the given user.
 * @returns {Promise<{ ok: true, projectKey: string, role?: string } | { ok: false, error: string, code?: string }>}
 */
export async function acceptProjectInvitation(token, userId, userEmail) {
  const t = typeof token === "string" ? token.trim() : "";
  if (!t) {
    return { ok: false, error: "Invitation token is required" };
  }
  const emailLower = (userEmail || "").trim().toLowerCase();
  const inv = await ProjectInvitation.findOne({
    token: t,
    status: "pending",
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!inv) {
    return { ok: false, error: "Invitation not found or expired", code: "INVITE_INVALID" };
  }
  if (inv.email !== emailLower) {
    return {
      ok: false,
      error: "Sign in with the email address that received this invitation.",
      code: "INVITE_EMAIL_MISMATCH",
    };
  }

  const project = await QuicklookProject.findOne({ projectKey: inv.projectKey }).lean();
  if (!project) {
    return { ok: false, error: "Project no longer exists" };
  }

  if (String(project.owner) === String(userId)) {
    await ProjectInvitation.updateOne({ _id: inv._id }, { $set: { status: "accepted" } });
    return { ok: true, projectKey: inv.projectKey, role: "owner" };
  }

  const uid = String(userId);
  const others = (project.members || []).filter((m) => String(m.userId) !== uid);
  const updatedMembers = [...others, { userId: uid, role: inv.role, addedAt: new Date() }];

  await QuicklookProject.updateOne(
    { projectKey: inv.projectKey },
    { $set: { members: updatedMembers, updatedAt: new Date() } }
  );
  await ProjectInvitation.updateOne({ _id: inv._id }, { $set: { status: "accepted" } });
  return { ok: true, projectKey: inv.projectKey, role: inv.role };
}
