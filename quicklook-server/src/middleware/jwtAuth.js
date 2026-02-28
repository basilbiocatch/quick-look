"use strict";

import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "quicklook-dev-secret-change-in-production";

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

export { JWT_SECRET };
