"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const occurrenceSchema = new mongoose.Schema(
  {
    issueId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    projectKey: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    segment: { type: String, default: null },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { collection: "quicklook_issue_occurrences", versionKey: false }
);

occurrenceSchema.index({ issueId: 1, timestamp: -1 });
occurrenceSchema.index({ sessionId: 1, issueId: 1 });

const IssueOccurrence = quicklookConn.model("IssueOccurrence", occurrenceSchema);
export default IssueOccurrence;
