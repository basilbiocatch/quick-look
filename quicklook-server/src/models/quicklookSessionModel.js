"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    projectKey: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },
    retentionDays: { type: Number, default: 30 },
    expiresAt: { type: Date, index: true },
    ipAddress: { type: String },
    deviceId: { type: String, index: true },
    deviceFingerprint: { type: String },
    // Session chain fields for linking split sessions
    sessionChainId: { type: String, index: true },
    parentSessionId: { type: String, index: true },
    sequenceNumber: { type: Number, default: 1 },
    splitReason: { type: String, enum: ["duration_limit", "manual", "page_navigation"], default: null },
    meta: {
      userAgent: String,
      platform: String,
      language: String,
      languages: [String],
      screen: { width: Number, height: Number, colorDepth: Number },
      viewport: { width: Number, height: Number },
      devicePixelRatio: Number,
      timezone: String,
      cookieEnabled: Boolean,
      doNotTrack: Boolean,
      connection: {
        type: { type: String },
        effectiveType: String,
        downlink: Number,
        rtt: Number,
      },
      // IP-based geolocation (set by server from client IP)
      countryCode: String,
      city: String,
      location: { type: mongoose.Schema.Types.Mixed },
    },
    user: {
      firstName: String,
      lastName: String,
      email: String,
      custom: { type: mongoose.Schema.Types.Mixed },
    },
    /** Custom attributes from init (e.g. { region: 'eu' }) */
    attributes: { type: mongoose.Schema.Types.Mixed },
    pageCount: { type: Number, default: 0 },
    /** Unique page URLs (type 4 meta hrefs) for pageCount */
    pages: [{ type: String }],
    duration: { type: Number },
    chunkCount: { type: Number, default: 0 },
    /** Where chunks are stored: 'mongodb' or 'gcs' */
    storageType: { type: String, enum: ["mongodb", "gcs"], default: "mongodb" },
    // AI UX Analytics (Phase 1) — all optional for backward compatibility
    aiSummary: {
      narrative: String,
      emotionalScore: Number,
      intent: String,
      dropOffReason: String,
      keyMoment: String,
      generatedAt: Date,
    },
    frictionScore: { type: Number },
    frictionPoints: [
      {
        type: { type: String },
        timestamp: Number,
        element: mongoose.Schema.Types.Mixed,
        severity: String,
        duration: Number,
      },
    ],
    behaviorCluster: { type: String },
    converted: { type: Boolean },
    conversionValue: { type: Number },
    goalEvents: [{ type: String }],
    aiProcessed: { type: Boolean, index: true },
    aiProcessedAt: { type: Date },
  },
  { collection: "quicklook_sessions", versionKey: false }
);

sessionSchema.index({ projectKey: 1, createdAt: -1 });
sessionSchema.index({ aiProcessed: 1, status: 1, closedAt: -1 });

sessionSchema.pre("save", function () {
  if (this.isNew && this.retentionDays) {
    this.expiresAt = new Date(this.createdAt.getTime() + this.retentionDays * 86400000);
  }
});

const QuicklookSession = quicklookConn.model("QuicklookSession", sessionSchema);
export default QuicklookSession;
