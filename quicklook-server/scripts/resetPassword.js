#!/usr/bin/env node
"use strict";

/**
 * Reset password for a user by email.
 * Usage: node scripts/resetPassword.js
 * (run from quicklook-server; requires .env with QUICKLOOK_DB)
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { quicklookConn } from "../src/db.js";
import User from "../src/models/userModel.js";

const SALT_ROUNDS = 10;
const EMAIL = "basil@nobexinc.com";
const NEW_PASSWORD = "Basil123!";

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  await quicklookConn.asPromise();
  const user = await User.findOne({ email: EMAIL });
  if (!user) {
    console.error("User not found:", EMAIL);
    await quicklookConn.close();
    process.exit(1);
  }

  user.passwordHash = await bcrypt.hash(NEW_PASSWORD, SALT_ROUNDS);
  user.updatedAt = new Date();
  await user.save();
  console.log("Password reset for", EMAIL);
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
