"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const issueSchema = new mongoose.Schema(
  {
    issueId: { type: String, required: true, unique: true, index: true },
    projectKey: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["javascript_error", "javascript_warning", "network_error"],
      index: true,
    },
    severity: { type: String, required: true, enum: ["error", "warning"], index: true },
    signature: { type: String, required: true },
    message: { type: String, default: "" },
    firstSeen: { type: Date, required: true, index: true },
    lastSeen: { type: Date, required: true, index: true },
    occurrenceCount: { type: Number, default: 0 },
    affectedSessionCount: { type: Number, default: 0 },
  },
  { collection: "quicklook_issues", versionKey: false }
);

issueSchema.index({ projectKey: 1, type: 1, signature: 1 }, { unique: true });
issueSchema.index({ projectKey: 1, lastSeen: -1 });

const Issue = quicklookConn.model("Issue", issueSchema);
export default Issue;
