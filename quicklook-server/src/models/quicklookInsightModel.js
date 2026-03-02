"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const insightSchema = new mongoose.Schema(
  {
    insightId: { type: String, required: true, unique: true },
    projectKey: { type: String, required: true, index: true },
    type: { type: String },
    frictionType: { type: String },
    severity: { type: String },
    affectedSessions: [{ type: String }],
    affectedPercentage: { type: Number },
    page: { type: String },
    element: mongoose.Schema.Types.Mixed,
    impact: mongoose.Schema.Types.Mixed,
    rootCause: { type: String },
    evidence: mongoose.Schema.Types.Mixed,
    suggestedFixes: [{ type: String }],
    status: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  },
  { collection: "quicklook_insights", versionKey: false }
);

const QuicklookInsight = quicklookConn.model("QuicklookInsight", insightSchema);
export default QuicklookInsight;
