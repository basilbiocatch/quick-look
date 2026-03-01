#!/usr/bin/env node
"use strict";

/**
 * Migration script: MongoDB chunks -> GCS.
 * No-op: there is no existing data to migrate. New sessions use GCS when CHUNK_STORAGE=gcs.
 *
 * Usage: node scripts/migrateChunksToGcs.js
 */

import "dotenv/config";

async function main() {
  console.log("No migration required. Use CHUNK_STORAGE=gcs for new sessions; no existing chunk data to migrate.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
