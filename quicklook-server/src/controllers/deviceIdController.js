"use strict";

import * as deviceIdService from "../services/deviceIdService.js";
import { getRealClientIP } from "../utils/getRealClientIP.js";
import logger from "../configs/loggingConfig.js";

/**
 * POST /device-id — get or create a device ID by fingerprint/IP/userAgent.
 * Body: { fingerprint?, userAgent? }. IP from request. Returns { success, deviceId, isNew, confidence }.
 */
export const postDeviceId = async (req, res) => {
  try {
    const fingerprint = req.body?.fingerprint;
    const userAgent = req.body?.userAgent;
    const ipAddress = getRealClientIP(req);
    const result = await deviceIdService.getOrCreateDeviceId(fingerprint, ipAddress, userAgent);
    return res.json({
      success: true,
      deviceId: result.deviceId,
      isNew: result.isNew,
      confidence: result.confidence,
    });
  } catch (err) {
    logger.error("deviceId postDeviceId", { error: err.message });
    const isClientError =
      err.name === "ValidationError" ||
      (err.message && (err.message.includes("required") || err.message.includes("validation")));
    if (isClientError) {
      return res.status(200).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
};
