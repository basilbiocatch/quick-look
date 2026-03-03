"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const reportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true },
    projectKey: { type: String, required: true, index: true },
    type: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    period: {
      start: Date,
      end: Date,
    },
    title: { type: String },
    summary: { type: String },
    sections: [{ title: String, content: String, insights: [String], charts: mongoose.Schema.Types.Mixed }],
    metrics: mongoose.Schema.Types.Mixed,
    generatedAt: { type: Date, default: Date.now },
    viewedAt: { type: Date },
  },
  { collection: "quicklook_reports", versionKey: false }
);

reportSchema.index({ projectKey: 1, generatedAt: -1 });

const QuicklookReport = quicklookConn.model("QuicklookReport", reportSchema);
export default QuicklookReport;
