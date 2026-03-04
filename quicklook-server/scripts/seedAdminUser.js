#!/usr/bin/env node
"use strict";

/**
 * Set a user as admin by email.
 * Usage (from quicklook-server):
 *   node scripts/seedAdminUser.js
 *   node scripts/seedAdminUser.js someone@example.com
 *
 * Requires .env with QUICKLOOK_DB.
 */

import "dotenv/config";
import { quicklookConn } from "../src/db.js";

const COLLECTION = "quicklook_users";
const DEFAULT_EMAIL = "basil@nobexinc.com";

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  const email = (process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/seedAdminUser.js [email]");
    process.exit(1);
  }

  await quicklookConn.asPromise();
  const col = quicklookConn.collection(COLLECTION);

  const result = await col.updateOne(
    { email },
    { $set: { role: "admin", updatedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    console.error("No user found with email:", email);
    await quicklookConn.close();
    process.exit(1);
  }

  console.log("Set role=admin for:", email);
  if (result.modifiedCount === 0) console.log("(user was already admin)");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
