"use strict";

import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "quicklook-dev-secret-change-in-production";
const FREE_PLAN_VERIFICATION_GRACE_DAYS = 2;

function needsEmailVerification(user) {
  if (!user || user.emailVerified) return false;
  if (user.plan && user.plan !== "free") return false;
  const createdAt = user.createdAt instanceof Date ? user.createdAt : (user.createdAt ? new Date(user.createdAt) : null);
  if (!createdAt) return false;
  const cutoff = new Date(Date.now() - FREE_PLAN_VERIFICATION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return createdAt < cutoff;
}

/**
 * Verify JWT from Authorization: Bearer <token> and attach req.user.
 * req.user = { userId, email, sessionCap } (no password).
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("email sessionCap").lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    req.user = { userId: decoded.userId, email: user.email, sessionCap: user.sessionCap };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

/**
 * Must be used after requireAuth. Blocks free-plan users who are past the 2-day
 * grace period and have not verified their email. Returns 403 with code NEED_EMAIL_VERIFICATION.
 */
export async function requireEmailVerified(req, res, next) {
  try {
    const user = await User.findById(req.user.userId)
      .select("plan emailVerified createdAt")
      .lean();
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (needsEmailVerification(user)) {
      return res.status(403).json({
        success: false,
        error: "Please verify your email to continue.",
        code: "NEED_EMAIL_VERIFICATION",
      });
    }
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: "Unauthorized" });
  }
}

export { JWT_SECRET };
