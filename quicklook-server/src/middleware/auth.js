"use strict";

/**
 * Optional API key auth for read endpoints.
 * If QUICKLOOK_API_KEY is not set (e.g. localhost dev), allow all.
 */
export function requireApiKey(req, res, next) {
  const key = process.env.QUICKLOOK_API_KEY;
  if (!key) return next();
  const provided = req.headers["x-quicklook-api-key"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (provided === key) return next();
  return res.status(401).json({ success: false, error: "Unauthorized" });
}
