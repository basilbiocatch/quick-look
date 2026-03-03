"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const insightSchema = new mongoose.Schema(
  {
    insightId: { type: String, required: true, unique: true },
    projectKey: { type: String, required: true, index: true },
    type: { type: String, default: "friction" },
    frictionType: { type: String },
    severity: { type: String },
    affectedSessions: [{ type: String }],
    affectedPercentage: { type: Number },
    page: { type: String },
    element: mongoose.Schema.Types.Mixed,
    impact: mongoose.Schema.Types.Mixed, // { conversionDrop, revenueImpact, affectedUserCount, confidence }
    rootCause: { type: String },
    evidence: mongoose.Schema.Types.Mixed,
    suggestedFixes: [mongoose.Schema.Types.Mixed], // [{ description, predictedLift: { min, max }, confidence, priority }]
    status: { type: String, enum: ["active", "resolved", "ignored"], default: "active" },
    notes: { type: String },
    // Phase 7: feedback loop
    accuracyRating: { type: Number }, // 1-5 when user rates insight accuracy
    resolvedAt: { type: Date },
    actualLift: { type: Number }, // observed lift (%) when resolved / from A/B
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
  },
  { collection: "quicklook_insights", versionKey: false }
);

insightSchema.index({ projectKey: 1, status: 1, createdAt: -1 });

const QuicklookInsight = quicklookConn.model("QuicklookInsight", insightSchema);
export default QuicklookInsight;
