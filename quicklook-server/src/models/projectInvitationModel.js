"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const projectInvitationSchema = new mongoose.Schema(
  {
    projectKey: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ["viewer", "editor"], required: true },
    invitedBy: { type: String, required: true },
    token: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", index: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_project_invitations", versionKey: false }
);

projectInvitationSchema.index({ projectKey: 1, email: 1, status: 1 });

const ProjectInvitation = quicklookConn.model("ProjectInvitation", projectInvitationSchema);
export default ProjectInvitation;
