"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "", trim: true },
    plan: { type: String, enum: ["free", "pro", "standard", "premium", "enterprise"], default: "free", index: true },
    sessionCap: { type: Number, default: null },
    /** Provider-agnostic billing (stripe | recurly) */
    billing: {
      provider: { type: String },
      customerId: { type: String },
      subscriptionId: { type: String },
      status: { type: String },
      priceId: { type: String },
      interval: { type: String },
      currentPeriodEnd: { type: Date },
      cancelAtPeriodEnd: { type: Boolean },
    },
    billingProviderPayload: { type: mongoose.Schema.Types.Mixed },
    couponsUsed: [{
      couponId: String,
      code: String,
      usedAt: Date,
      subscriptionId: String,
    }],
    gracePeriodEnd: { type: Date },
    previousPlan: { type: String },
    assignedPlanVariants: {
      free: String,
      pro: String,
      premium: String,
      enterprise: String,
    },
    abTestCohorts: [{
      experimentId: String,
      variant: String,
      assignedAt: Date,
      planId: String,
    }],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    /** Total bytes in GCS (set by cost job when CHUNK_STORAGE=gcs) */
    storageBytes: { type: Number, default: 0 },
    /** Calculated storage cost USD per month */
    storageCostUsd: { type: Number, default: 0 },
    /** Last time cost was updated by the cost job */
    lastCostUpdate: { type: Date },
    /** Email verification (required after 2 days on free plan) */
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationTokenExpires: { type: Date },
    /** Forgot password flow */
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "quicklook_users", versionKey: false }
);

const User = quicklookConn.model("User", userSchema);
export default User;
