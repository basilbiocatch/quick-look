"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const chunkSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    index: { type: Number, required: true },
    events: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_chunks", versionKey: false }
);

chunkSchema.index({ sessionId: 1, index: 1 }, { unique: true });

const QuicklookChunk = quicklookConn.model("QuicklookChunk", chunkSchema);
export default QuicklookChunk;
