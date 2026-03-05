"use strict";

import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import logger from "../configs/loggingConfig.js";

const rawBucket = (process.env.GCS_BUCKET || "").trim();
const bucketName = rawBucket && rawBucket.length >= 5 && !/^(GCP|gcp)$/i.test(rawBucket) ? rawBucket.toLowerCase() : null;

let storage = null;
if (bucketName) {
  try {
    storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE,
    });
  } catch (err) {
    logger.warn("Support chat image upload: GCS Storage init failed", { error: err.message });
  }
}

const PREFIX = "support-chat/";
const SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Upload image buffer to GCS and return a signed URL for reading.
 * @param {Buffer} buffer
 * @param {string} mimeType - e.g. image/png
 * @returns {Promise<{ imageUrl: string }>}
 */
export async function uploadImage(buffer, mimeType = "image/png") {
  if (!storage || !bucketName) {
    throw new Error("Image upload is not configured (GCS_BUCKET required)");
  }
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error("Image size must be under 5MB");
  }
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error("Invalid image type. Use JPEG, PNG, GIF, or WebP.");
  }

  const ext = mimeType.split("/")[1] || "png";
  const filename = `${PREFIX}${uuidv4()}.${ext}`;
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: { uploadedAt: new Date().toISOString(), purpose: "support-chat" },
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_EXPIRY_MS,
  });

  logger.info("Support chat image uploaded", { filename, size: buffer.length });
  return { imageUrl: signedUrl };
}

export function isUploadConfigured() {
  return Boolean(storage && bucketName);
}
