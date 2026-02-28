#!/usr/bin/env node
"use strict";

/**
 * Creates (or updates) a Quicklook project for the localinteractive user and generates
 * everything needed to show their sessions in the dashboard.
 *
 * Usage: node scripts/seedLocalInteractiveProject.js
 * (run from quick-look/quicklook-server; requires .env with QUICKLOOK_DB)
 */

import "dotenv/config";
import { quicklookConn } from "../src/db.js";
import QuicklookProject from "../src/models/quicklookProjectModel.js";
import { generateId, generateApiKey } from "../src/models/quicklookProjectModel.js";

const OWNER = "localinteractive";
const PROJECT_KEY = "localinteractive";
const PROJECT_NAME = "Local Interactive";

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  await quicklookConn.asPromise();
  console.log("Connected to Quicklook DB\n");

  let project = await QuicklookProject.findOne({ owner: OWNER });

  if (project) {
    if (!project.apiKey) {
      project.apiKey = generateApiKey();
      project.updatedAt = new Date();
      await project.save();
      console.log("Existing project found; generated new API key.");
    } else {
      console.log("Existing project found; using existing API key.");
    }
  } else {
    project = new QuicklookProject({
      projectId: generateId(),
      projectKey: PROJECT_KEY,
      name: PROJECT_NAME,
      owner: OWNER,
      apiKey: generateApiKey(),
      retentionDays: 30,
    });
    await project.save();
    console.log("Created new project for localinteractive.");
  }

  console.log("\n--- Quicklook project for localinteractive ---\n");
  console.log("Project ID:    ", project.projectId);
  console.log("Project Key:   ", project.projectKey);
  console.log("Name:          ", project.name);
  console.log("Owner:         ", project.owner);
  console.log("API Key:       ", project.apiKey);
  console.log("\n--- How to use ---\n");
  console.log("1. SDK (on your site / localinteractive):");
  console.log(`   window.quicklook('init', '${project.projectKey}', { apiUrl: 'http://localhost:3080' });`);
  console.log("\n2. Dashboard (quicklook-app):");
  console.log("   - Enter project key:", project.projectKey);
  console.log("   - Optional: set in .env for read auth:");
  console.log("     QUICKLOOK_API_KEY=" + project.apiKey);
  console.log("     (and in quicklook-app/.env: VITE_QUICKLOOK_API_KEY=" + project.apiKey + ")");
  console.log("\n3. Server .env (optional, to require API key for GET /sessions):");
  console.log("   QUICKLOOK_API_KEY=" + project.apiKey);
  console.log("\nSessions recorded with project key '" + project.projectKey + "' will appear in the dashboard when you filter by this key.\n");

  await quicklookConn.close();
  process.exit(0);
}

function isAuthError(err) {
  return err.code === 18 || err.codeName === "AuthenticationFailed" || (err.name === "MongoServerError" && /authentication failed/i.test(String(err.message)));
}

main().catch((err) => {
  if (isAuthError(err)) {
    console.error("\nMongoDB authentication failed. Check QUICKLOOK_DB in .env:\n");
    console.error("  • Username and password must be correct for the MongoDB user.");
    console.error("  • If the user was created in the admin db, add: authSource=admin");
    console.error("    Example: mongodb://user:pass@host:27017/quicklook?authSource=admin&retryWrites=true&w=majority");
    console.error("  • For local dev without auth, use: QUICKLOOK_DB=mongodb://localhost:27017/quicklook\n");
  } else {
    console.error(err);
  }
  process.exit(1);
});
