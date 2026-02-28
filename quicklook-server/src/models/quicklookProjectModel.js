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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
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
