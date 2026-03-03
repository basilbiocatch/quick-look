#!/usr/bin/env node
"use strict";

/**
 * Mark all existing users as email-verified (one-time migration).
 * Run after deploying email verification so current users are not blocked.
 *
 * Usage (from quicklook-server):
 *   node scripts/seedExistingUsersVerified.js
 *
 * Requires .env with QUICKLOOK_DB.
 */

import "dotenv/config";
import { quicklookConn } from "../src/db.js";

const COLLECTION = "quicklook_users";

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  await quicklookConn.asPromise();
  const col = quicklookConn.collection(COLLECTION);

  const result = await col.updateMany(
    {},
    {
      $set: { emailVerified: true, updatedAt: new Date() },
      $unset: { emailVerificationToken: "", emailVerificationTokenExpires: "" },
    }
  );

  console.log("Existing users marked as verified:", result.modifiedCount, "modified,", result.matchedCount, "matched.");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
