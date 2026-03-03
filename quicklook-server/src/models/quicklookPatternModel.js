"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const patternSchema = new mongoose.Schema(
  {
    patternId: { type: String, required: true, unique: true },
    projectKey: { type: String, index: true },
    name: { type: String },
    signature: mongoose.Schema.Types.Mixed,
    occurrences: { type: Number },
    affectedConversionRate: { type: Number },
    normalConversionRate: { type: Number },
    suggestedFixes: [mongoose.Schema.Types.Mixed], // [{ description, expectedLift: { min, max }, confidence, priority, source }]
    abTestResults: [{ type: mongoose.Schema.Types.Mixed }],
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_patterns", versionKey: false }
);

const QuicklookPattern = quicklookConn.model("QuicklookPattern", patternSchema);
export default QuicklookPattern;
