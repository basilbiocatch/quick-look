"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    imageUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportConversationSchema = new mongoose.Schema(
  {
    threadId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    visitorIp: { type: String, index: true },
    agentName: { type: String, required: true },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ["open", "closed", "satisfied"],
      default: "open",
      index: true,
    },
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionFeedback: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

supportConversationSchema.index({ userId: 1, createdAt: -1 });
supportConversationSchema.index({ visitorIp: 1, createdAt: -1 });

const SupportConversation = quicklookConn.model("SupportConversation", supportConversationSchema);
export default SupportConversation;
