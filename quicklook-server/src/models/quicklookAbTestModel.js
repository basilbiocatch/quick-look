"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const abTestSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, unique: true },
    projectKey: { type: String, required: true, index: true },
    insightId: { type: String, index: true },
    hypothesis: { type: String },
    changeDescription: { type: String },
    expectedLift: {
      min: { type: Number },
      max: { type: Number },
    },
    status: {
      type: String,
      enum: ["planned", "running", "completed"],
      default: "planned",
      index: true,
    },
    results: {
      controlConversion: { type: Number },
      variantConversion: { type: Number },
      actualLift: { type: Number },
      pValue: { type: Number },
      sampleSize: { type: Number },
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_ab_tests", versionKey: false }
);

abTestSchema.index({ projectKey: 1, status: 1, createdAt: -1 });

const QuicklookAbTest = quicklookConn.model("QuicklookAbTest", abTestSchema);
export default QuicklookAbTest;
