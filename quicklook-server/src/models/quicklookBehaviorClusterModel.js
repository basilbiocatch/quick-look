"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const behaviorClusterSchema = new mongoose.Schema(
  {
    clusterId: { type: String, required: true },
    projectKey: { type: String, required: true, index: true },
    period: {
      start: { type: Date },
      end: { type: Date },
    },
    clusterLabel: { type: String },
    description: { type: String },
    sessionIds: [{ type: String }],
    sessionCount: { type: Number },
    percentage: { type: Number },
    features: mongoose.Schema.Types.Mixed,
    conversionRate: { type: Number },
    avgRevenue: { type: Number },
    representativeSessions: [{ type: String }],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "quicklook_behavior_clusters", versionKey: false }
);

const QuicklookBehaviorCluster = quicklookConn.model("QuicklookBehaviorCluster", behaviorClusterSchema);
export default QuicklookBehaviorCluster;
