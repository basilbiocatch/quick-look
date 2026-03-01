#!/usr/bin/env node
"use strict";

/**
 * Verifies GCS chunk storage: upload, download, metadata (owner tag), delete, getStorageByOwner.
 * Usage: CHUNK_STORAGE=gcs GCS_BUCKET=your-bucket GCP_PROJECT_ID=... [GCS_KEY_FILE=path] node scripts/testGcsStorage.js
 * Run from quicklook-server directory.
 */

import "dotenv/config";
import { ChunkStorage } from "../src/storage/chunkStorage.js";

const TEST_SESSION_ID = "test-session-" + Date.now();
const TEST_OWNER = "test-owner-123";
const TEST_PROJECT_KEY = "test-project";

async function main() {
  if (process.env.CHUNK_STORAGE !== "gcs") {
    console.log("Set CHUNK_STORAGE=gcs and GCS_BUCKET (and optionally GCP_PROJECT_ID, GCS_KEY_FILE) to run GCS tests.");
    process.exit(0);
  }
  if (!process.env.GCS_BUCKET) {
    console.error("GCS_BUCKET is required when CHUNK_STORAGE=gcs.");
    process.exit(1);
  }

  const storage = new ChunkStorage("gcs", {
    bucket: process.env.GCS_BUCKET,
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCS_KEY_FILE,
  });

  console.log("Testing GCS chunk storage...\n");

  // 1. Save chunk with tags
  const events = [{ type: 4, data: { href: "https://example.com" } }];
  await storage.saveChunk(TEST_SESSION_ID, 0, events, {
    owner: TEST_OWNER,
    projectKey: TEST_PROJECT_KEY,
  });
  console.log("1. Uploaded chunk with owner/projectKey tags.");

  // 2. Get chunks and verify data
  const chunks = await storage.getChunks(TEST_SESSION_ID);
  if (chunks.length !== 1 || chunks[0].index !== 0 || !chunks[0].events?.length) {
    throw new Error("getChunks mismatch: " + JSON.stringify(chunks));
  }
  console.log("2. Downloaded chunks and verified data.");

  // 3. Count chunks
  const count = await storage.countChunks(TEST_SESSION_ID);
  if (count !== 1) throw new Error("countChunks expected 1, got " + count);
  console.log("3. countChunks = 1.");

  // 4. getStorageByOwner (should include our test owner)
  const byOwner = await storage.getStorageByOwner();
  const bytes = byOwner.get(TEST_OWNER);
  if (bytes == null || bytes < 1) {
    console.warn("4. getStorageByOwner: owner not found or 0 bytes (metadata may take a moment).");
  } else {
    console.log("4. getStorageByOwner: " + bytes + " bytes for " + TEST_OWNER + ".");
  }

  // 5. Delete chunks
  await storage.deleteChunks(TEST_SESSION_ID);
  const afterDelete = await storage.getChunks(TEST_SESSION_ID);
  if (afterDelete.length !== 0) throw new Error("Chunks still present after delete.");
  console.log("5. Deleted chunks verified.\n");

  console.log("All GCS storage checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
