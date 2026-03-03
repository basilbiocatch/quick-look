"use strict";

import { v4 as uuidv4 } from "uuid";
import QuicklookDevice from "../models/quicklookDeviceModel.js";

/** Normalize IPv4 to /24 prefix (first 3 octets). */
function ipv4Prefix24(ip) {
  if (!ip || typeof ip !== "string") return null;
  const trimmed = ip.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 4) return null;
  return parts.slice(0, 3).join(".");
}

/** Recent lastSeen (e.g. within 7 days) adds 10. */
function recentLastSeenScore(lastSeen) {
  if (!lastSeen) return 0;
  const t = lastSeen instanceof Date ? lastSeen.getTime() : new Date(lastSeen).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return t >= Date.now() - sevenDaysMs ? 10 : 0;
}

export async function updateDeviceMetadata(deviceId, fingerprint, ipAddress, userAgent) {
  const now = new Date();
  const device = await QuicklookDevice.findOne({ deviceId }).lean();
  if (!device) return;

  const update = {
    $set: { lastSeen: now },
    $inc: { sessionCount: 1 },
  };
  if (ipAddress && String(ipAddress).trim()) {
    update.$addToSet = update.$addToSet || {};
    update.$addToSet.ipAddresses = String(ipAddress).trim();
  }
  if (userAgent && String(userAgent).trim()) {
    update.$addToSet = update.$addToSet || {};
    update.$addToSet.userAgents = String(userAgent).trim();
  }
  const newFp = fingerprint && String(fingerprint).trim() ? String(fingerprint).trim() : null;
  const currentFp = device.fingerprint && String(device.fingerprint).trim() ? String(device.fingerprint).trim() : null;
  if (newFp && currentFp && newFp !== currentFp) {
    update.$addToSet = update.$addToSet || {};
    update.$addToSet.fingerprintHistory = currentFp;
    update.$set.fingerprint = newFp;
  } else if (newFp && !currentFp) {
    update.$set.fingerprint = newFp;
  }

  await QuicklookDevice.updateOne({ deviceId }, update);
}

export async function getOrCreateDeviceId(fingerprint, ipAddress, userAgent) {
  const fp = fingerprint && String(fingerprint).trim() ? String(fingerprint).trim() : null;
  const ip = ipAddress && String(ipAddress).trim() ? String(ipAddress).trim() : null;
  const ua = userAgent && String(userAgent).trim() ? String(userAgent).trim() : null;

  // (a) Exact match by fingerprint
  if (fp) {
    const existing = await QuicklookDevice.findOne({ fingerprint: fp }).lean();
    if (existing) {
      await updateDeviceMetadata(existing.deviceId, fp, ip, ua);
      return { deviceId: existing.deviceId, isNew: false, confidence: 1 };
    }
  }

  // (b) Find similar devices (fingerprint not empty), score, take best if >= 70
  const withFingerprint = await QuicklookDevice.find({ fingerprint: { $exists: true, $ne: null, $ne: "" } }).lean();
  let bestScore = 0;
  let bestDevice = null;
  const ipPrefix = ip ? ipv4Prefix24(ip) : null;

  for (const d of withFingerprint) {
    let score = 0;
    if (fp && d.fingerprint === fp) score += 40;
    if (ip && d.ipAddresses && Array.isArray(d.ipAddresses)) {
      const sameIp = d.ipAddresses.includes(ip);
      const sameSubnet = ipPrefix && d.ipAddresses.some((a) => ipv4Prefix24(a) === ipPrefix);
      if (sameIp || sameSubnet) score += 30;
    }
    const uaMatch = d.userAgents && Array.isArray(d.userAgents) && ua
      ? Math.min(20, d.userAgents.reduce((acc, a) => acc + (a === ua ? 20 : 0), 0))
      : 0;
    score += uaMatch;
    score += recentLastSeenScore(d.lastSeen);
    if (score > bestScore) {
      bestScore = score;
      bestDevice = d;
    }
  }

  if (bestDevice && bestScore >= 70) {
    await updateDeviceMetadata(bestDevice.deviceId, fp, ip, ua);
    return { deviceId: bestDevice.deviceId, isNew: false, confidence: bestScore / 100 };
  }

  // (c) Create new device
  const deviceId = uuidv4();
  const now = new Date();
  await QuicklookDevice.create({
    deviceId,
    fingerprint: fp || undefined,
    firstSeen: now,
    lastSeen: now,
    sessionCount: 1,
    fingerprintHistory: [],
    ipAddresses: ip ? [ip] : [],
    userAgents: ua ? [ua] : [],
  });
  return { deviceId, isNew: true, confidence: 1 };
}
