"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "", trim: true },
    sessionCap: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_users", versionKey: false }
);

const User = quicklookConn.model("User", userSchema);
export default User;
