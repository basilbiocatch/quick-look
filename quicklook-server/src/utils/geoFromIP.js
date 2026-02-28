"use strict";

import logger from "../configs/loggingConfig.js";

const FIELDS = "status,message,country,countryCode,regionName,city";
const GEO_URL = (ip) => `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${FIELDS}`;
const TIMEOUT_MS = 3000;

function isPrivateOrLocal(ip) {
  if (!ip || typeof ip !== "string") return true;
  const s = ip.replace(/^::ffff:/, "").trim();
  if (s === "127.0.0.1" || s === "::1" || s === "localhost") return true;
  if (s.startsWith("10.")) return true;
  if (s.startsWith("172.")) {
    const b = parseInt(s.split(".")[1], 10);
    if (b >= 16 && b <= 31) return true;
  }
  if (s.startsWith("192.168.")) return true;
  return false;
}

/**
 * Resolve country/city from client IP using ip-api.com (free, 45 req/min).
 * Skips localhost and private IPs. Returns null on failure or private IP.
 * @param {string} ip - Client IP (e.g. from getRealClientIP)
 * @returns {Promise<{ countryCode: string, country: string, city: string, regionName: string } | null>}
 */
export async function getGeoFromIP(ip) {
  if (!ip || isPrivateOrLocal(ip)) return null;
  const url = GEO_URL(ip);
  let res;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
  } catch (err) {
    if (err.name === "AbortError") {
      logger.warn("quicklook geo lookup timeout", { ip: ip.slice(0, 12) });
    } else {
      logger.warn("quicklook geo lookup failed", { error: err.message, ip: ip.slice(0, 12) });
    }
    return null;
  }
  if (!res.ok) return null;
  let data;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  if (!data || data.status !== "success") return null;
  return {
    countryCode: data.countryCode || "",
    country: data.country || "",
    city: data.city || "",
    regionName: data.regionName || "",
  };
}
