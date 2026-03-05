"use strict";

/** In-memory rate limit: max 10 messages per hour per IP for unauthenticated users. */
const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const store = new Map(); // ip -> { count, resetAt }

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

export function supportChatRateLimit(req, res, next) {
  if (req.user?.userId) return next(); // authenticated users not rate limited by IP

  const ip = getClientIp(req);
  const now = Date.now();
  let entry = store.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(ip, entry);
  }
  entry.count++;
  if (entry.count > LIMIT) {
    return res.status(429).json({
      success: false,
      error: "You've reached the message limit. Please sign up to continue chatting.",
      code: "RATE_LIMIT",
    });
  }
  next();
}
