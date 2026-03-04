#!/usr/bin/env node
"use strict";

/**
 * Mark all existing users as email-verified and ensure they have a plan (one-time migration).
 * Run after deploying email verification so current users are not blocked.
 * Sets plan to "free" only for users who do not already have a plan.
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

  const verifiedResult = await col.updateMany(
    {},
    {
      $set: { emailVerified: true, updatedAt: new Date() },
      $unset: { emailVerificationToken: "", emailVerificationTokenExpires: "" },
    }
  );
  console.log("Verified:", verifiedResult.modifiedCount, "modified,", verifiedResult.matchedCount, "matched.");

  const planResult = await col.updateMany(
    { $or: [{ plan: { $exists: false } }, { plan: "" }, { plan: null }] },
    { $set: { plan: "free", updatedAt: new Date() } }
  );
  console.log("Plans: set plan=free for", planResult.modifiedCount, "users (no plan set).");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
