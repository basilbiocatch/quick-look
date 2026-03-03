"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    fingerprint: { type: String, index: true },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date },
    sessionCount: { type: Number, default: 0 },
    fingerprintHistory: [String],
    ipAddresses: [String],
    userAgents: [String],
  },
  { collection: "quicklook_devices", versionKey: false }
);

const QuicklookDevice = quicklookConn.model("QuicklookDevice", deviceSchema);
export default QuicklookDevice;
