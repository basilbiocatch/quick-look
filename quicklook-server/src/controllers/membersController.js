"use strict";

import crypto from "crypto";
import mongoose from "mongoose";
import QuicklookProject from "../models/quicklookProjectModel.js";
import ProjectInvitation from "../models/projectInvitationModel.js";
import User from "../models/userModel.js";
import logger from "../configs/loggingConfig.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { sendProjectInviteEmail, sendProjectInviteSignupEmail } from "../services/emailService.js";
import { acceptProjectInvitation, INVITE_EXPIRY_MS } from "../services/projectInvitationAcceptService.js";

const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "https://quicklook.io").replace(/\/$/, "");

function requireOwner(access, res) {
  if (!access || access.role !== "owner") {
    res.status(403).json({
      success: false,
      error: "Only the project owner can manage team members.",
      code: "FORBIDDEN_NOT_OWNER",
    });
    return false;
  }
  return true;
}

/** POST /projects/:projectKey/members/invite */
export async function inviteMember(req, res) {
  try {
    const { projectKey } = req.params;
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!requireOwner(access, res)) return;

    const { email: rawEmail, role } = req.body || {};
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Valid email is required" });
    }
    if (role !== "viewer" && role !== "editor") {
      return res.status(400).json({ success: false, error: "role must be viewer or editor" });
    }

    const { project } = access;
    const ownerUser = await User.findById(project.owner).select("email name").lean();
    if (!ownerUser) {
      return res.status(500).json({ success: false, error: "Project owner not found" });
    }
    if (email === (ownerUser.email || "").toLowerCase()) {
      return res.status(400).json({ success: false, error: "The project owner is already on this project." });
    }

    const invitee = await User.findOne({ email }).select("_id").lean();
    if (invitee && String(invitee._id) === String(project.owner)) {
      return res.status(400).json({ success: false, error: "Invalid invitee" });
    }
    if (invitee && (project.members || []).some((m) => String(m.userId) === String(invitee._id))) {
      return res.status(400).json({ success: false, error: "This user is already a member." });
    }

    await ProjectInvitation.updateMany(
      { projectKey, email, status: "pending" },
      { $set: { status: "revoked" } }
    );

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
    const inviter = await User.findById(req.user.userId).select("name email").lean();
    const inviterName = inviter?.name || inviter?.email || "A teammate";

    await ProjectInvitation.create({
      projectKey,
      email,
      role,
      invitedBy: String(req.user.userId),
      token,
      status: "pending",
      expiresAt,
    });

    try {
      if (invitee) {
        const acceptUrl = `${FRONTEND_URL}/invitations/${encodeURIComponent(token)}`;
        await sendProjectInviteEmail(email, inviterName, project.name, role, acceptUrl);
      } else {
        const signupUrl = `${FRONTEND_URL}/signup?invite=${encodeURIComponent(token)}`;
        await sendProjectInviteSignupEmail(email, inviterName, project.name, role, signupUrl);
      }
    } catch (e) {
      logger.warn("Project invite email failed (invitation still created)", { error: e.message, email });
    }

    return res.status(201).json({ success: true, data: { email, role, expiresAt: expiresAt.toISOString() } });
  } catch (err) {
    logger.error("members inviteMember", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** GET /projects/:projectKey/members */
export async function listMembers(req, res) {
  try {
    const { projectKey } = req.params;
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!requireOwner(access, res)) return;

    const { project } = access;
    const ownerUser = await User.findById(project.owner).select("email name").lean();
    const memberIds = (project.members || []).map((m) => m.userId);
    const memberUsers = memberIds.length
      ? await User.find({ _id: { $in: memberIds } })
          .select("email name")
          .lean()
      : [];
    const userById = new Map(memberUsers.map((u) => [String(u._id), u]));

    const membersList = (project.members || []).map((m) => {
      const u = userById.get(String(m.userId));
      return {
        userId: String(m.userId),
        email: u?.email || "",
        name: u?.name || "",
        role: m.role,
        addedAt: m.addedAt,
      };
    });

    const pending = await ProjectInvitation.find({
      projectKey,
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .select("email role createdAt expiresAt")
      .lean();

    const pendingOut = pending.map((invDoc) => ({
      invitationId: String(invDoc._id),
      email: invDoc.email,
      role: invDoc.role,
      createdAt: invDoc.createdAt,
      expiresAt: invDoc.expiresAt,
    }));

    return res.json({
      success: true,
      data: {
        owner: {
          userId: String(project.owner),
          email: ownerUser?.email || "",
          name: ownerUser?.name || "",
        },
        members: membersList,
        pendingInvitations: pendingOut,
      },
    });
  } catch (err) {
    logger.error("members listMembers", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** PATCH /projects/:projectKey/members/:memberUserId */
export async function updateMemberRole(req, res) {
  try {
    const { projectKey, memberUserId } = req.params;
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!requireOwner(access, res)) return;

    const { role } = req.body || {};
    if (role !== "viewer" && role !== "editor") {
      return res.status(400).json({ success: false, error: "role must be viewer or editor" });
    }
    if (String(memberUserId) === String(access.project.owner)) {
      return res.status(400).json({ success: false, error: "Cannot change the owner's role" });
    }

    const members = [...(access.project.members || [])];
    const idx = members.findIndex((m) => String(m.userId) === String(memberUserId));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }
    members[idx] = { ...members[idx], role };

    await QuicklookProject.updateOne({ projectKey }, { $set: { members, updatedAt: new Date() } });
    return res.json({ success: true, data: { userId: String(memberUserId), role } });
  } catch (err) {
    logger.error("members updateMemberRole", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** DELETE /projects/:projectKey/members/:memberUserId */
export async function removeMember(req, res) {
  try {
    const { projectKey, memberUserId } = req.params;
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!requireOwner(access, res)) return;

    if (String(memberUserId) === String(access.project.owner)) {
      return res.status(400).json({ success: false, error: "Cannot remove the project owner" });
    }

    const members = (access.project.members || []).filter((m) => String(m.userId) !== String(memberUserId));
    if (members.length === (access.project.members || []).length) {
      return res.status(404).json({ success: false, error: "Member not found" });
    }

    await QuicklookProject.updateOne({ projectKey }, { $set: { members, updatedAt: new Date() } });
    return res.json({ success: true, data: { removed: true } });
  } catch (err) {
    logger.error("members removeMember", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** DELETE /projects/:projectKey/invitations/:invitationId */
export async function revokeInvitation(req, res) {
  try {
    const { projectKey, invitationId } = req.params;
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;
    if (!requireOwner(access, res)) return;

    if (!mongoose.Types.ObjectId.isValid(invitationId)) {
      return res.status(400).json({ success: false, error: "Invalid invitation id" });
    }

    const inv = await ProjectInvitation.findOne({ _id: invitationId, projectKey }).lean();
    if (!inv) {
      return res.status(404).json({ success: false, error: "Invitation not found" });
    }
    await ProjectInvitation.updateOne({ _id: invitationId }, { $set: { status: "revoked" } });
    return res.json({ success: true, data: { revoked: true } });
  } catch (err) {
    logger.error("members revokeInvitation", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /invitations/:token/accept */
export async function acceptInvitation(req, res) {
  try {
    const { token } = req.params;
    const result = await acceptProjectInvitation(token, req.user.userId, req.user.email);
    if (!result.ok) {
      const status = result.code === "INVITE_EMAIL_MISMATCH" ? 403 : 400;
      return res.status(status).json({ success: false, error: result.error, code: result.code });
    }
    return res.json({
      success: true,
      data: { projectKey: result.projectKey, role: result.role },
    });
  } catch (err) {
    logger.error("members acceptInvitation", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}

/** POST /invitations/:token/decline */
export async function declineInvitation(req, res) {
  try {
    const { token } = req.params;
    const t = typeof token === "string" ? token.trim() : "";
    if (!t) {
      return res.status(400).json({ success: false, error: "Token required" });
    }
    const emailLower = (req.user.email || "").trim().toLowerCase();
    const inv = await ProjectInvitation.findOne({ token: t, status: "pending" }).lean();
    if (!inv) {
      return res.status(404).json({ success: false, error: "Invitation not found" });
    }
    if (inv.email !== emailLower) {
      return res.status(403).json({
        success: false,
        error: "This invitation was sent to a different email address.",
        code: "INVITE_EMAIL_MISMATCH",
      });
    }
    await ProjectInvitation.updateOne({ _id: inv._id }, { $set: { status: "revoked" } });
    return res.json({ success: true, data: { declined: true } });
  } catch (err) {
    logger.error("members declineInvitation", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
}
