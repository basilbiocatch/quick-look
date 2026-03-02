"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const reportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true },
    projectKey: { type: String, required: true, index: true },
    type: { type: String, enum: ["daily", "weekly", "monthly"] },
    period: {
      start: { type: Date },
      end: { type: Date },
    },
    title: { type: String },
    summary: { type: String },
    sections: [{ type: mongoose.Schema.Types.Mixed }],
    metrics: mongoose.Schema.Types.Mixed,
    generatedAt: { type: Date, default: Date.now },
    viewedAt: { type: Date },
  },
  { collection: "quicklook_reports", versionKey: false }
);

const QuicklookReport = quicklookConn.model("QuicklookReport", reportSchema);
export default QuicklookReport;
