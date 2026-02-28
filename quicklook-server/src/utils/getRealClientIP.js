"use strict";

/**
 * Extract the real client IP from request, handling proxy headers.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
export function getRealClientIP(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIP = req.headers["x-real-ip"];
  const cfConnectingIP = req.headers["cf-connecting-ip"];
  const remoteAddr = req.connection?.remoteAddress || req.socket?.remoteAddress;

  let clientIP;
  if (forwardedFor) {
    clientIP = forwardedFor.split(",")[0].trim();
  } else if (realIP) {
    clientIP = realIP.trim();
  } else if (cfConnectingIP) {
    clientIP = cfConnectingIP.trim();
  } else if (req.ip) {
    clientIP = req.ip;
  } else {
    clientIP = remoteAddr;
  }

  if (clientIP && clientIP.startsWith("::ffff:")) {
    clientIP = clientIP.substring(7);
  }
  return clientIP || null;
}
