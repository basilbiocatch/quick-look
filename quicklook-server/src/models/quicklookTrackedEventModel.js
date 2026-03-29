"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const trackedEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    projectKey: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    properties: { type: mongoose.Schema.Types.Mixed, default: undefined },
    clientTimestamp: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: "quicklook_tracked_events", versionKey: false }
);

trackedEventSchema.index({ projectKey: 1, createdAt: -1 });
trackedEventSchema.index({ sessionId: 1, createdAt: 1 });
trackedEventSchema.index({ projectKey: 1, name: 1, createdAt: -1 });

const QuicklookTrackedEvent = quicklookConn.model("QuicklookTrackedEvent", trackedEventSchema);
export default QuicklookTrackedEvent;
