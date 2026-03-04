"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const planConfigurationSchema = new mongoose.Schema(
  {
    planId: { type: String, required: true, unique: true, index: true },
    version: { type: Number, default: 1 },
    active: { type: Boolean, default: true, index: true },
    tier: { type: String, required: true, enum: ["free", "pro", "standard", "premium", "enterprise"], index: true },
    displayName: { type: String, required: true },
    tagline: { type: String, default: "" },
    displayOrder: { type: Number, default: 0 },
    /** Provider-specific IDs (e.g. Stripe). Price IDs used at checkout. */
    stripe: {
      productId: { type: String },
      monthlyPriceId: { type: String },
      annualPriceId: { type: String },
    },
    pricing: {
      monthly: {
        amount: { type: Number },
        currency: { type: String, default: "usd" },
        displayPrice: { type: String },
      },
      annual: {
        amount: { type: Number },
        currency: { type: String, default: "usd" },
        displayPrice: { type: String },
        effectiveMonthly: { type: String },
        savingsText: { type: String },
      },
      defaultInterval: { type: String, enum: ["monthly", "annual"], default: "annual" },
    },
    limits: {
      retentionDays: { type: Number },
      sessionCap: { type: Number },
      projectLimit: { type: Number },
    },
    features: {
      recordings: { type: Boolean, default: true },
      aiTools: { type: Boolean, default: false },
      devTools: { type: Boolean, default: false },
    },
    ui: {
      badgeText: { type: String },
      badgeColor: { type: String },
      description: { type: String },
      featureList: [{ type: String }],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "plan_configurations", versionKey: false }
);

planConfigurationSchema.index({ tier: 1, active: 1 });

const PlanConfiguration = quicklookConn.model("PlanConfiguration", planConfigurationSchema);
export default PlanConfiguration;
