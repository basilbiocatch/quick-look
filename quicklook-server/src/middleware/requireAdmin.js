"use strict";

/**
 * Must be used after auth middleware that sets req.user.
 * Returns 403 if user is missing or not an admin.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
