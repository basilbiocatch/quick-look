"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";
import crypto from "crypto";

const projectSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, unique: true, index: true },
    projectKey: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    owner: { type: String, required: true, index: true },
    apiKey: { type: String, index: true },
    retentionDays: { type: Number, default: 30 },
    allowedDomains: { type: [String], default: [] },
    /** URL path or substring patterns: pages matching any of these are not monitored by the SDK. */
    excludedUrls: { type: [String], default: [] },
    /** When true, SDK collects QL Device ID for session correlation (same device across sessions). Default false. */
    deviceIdEnabled: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // AI UX Analytics (Phase 1) — all optional
    goals: [
      {
        name: String,
        type: { type: String, enum: ["url", "event"] },
        value: String,
        aov: Number,
      },
    ],
    aiSettings: {
      enableAutoReports: { type: Boolean, default: false },
      reportFrequency: { type: String, default: "weekly" },
      minSampleSize: { type: Number, default: 50 },
      sensitivityThreshold: { type: Number, default: 0.5 },
    },
    /** Data URL of project cover image (captured from a random session replay). Shown on project card with blur. */
    thumbnailUrl: { type: String, default: null },
  },
  { collection: "quicklook_projects", versionKey: false }
);

function generateId() {
  return crypto.randomBytes(12).toString("hex");
}

function generateApiKey() {
  return "ql_" + crypto.randomBytes(24).toString("hex");
}

const QuicklookProject = quicklookConn.model("QuicklookProject", projectSchema);
export default QuicklookProject;
export { generateId, generateApiKey };
