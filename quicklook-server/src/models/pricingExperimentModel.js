"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const pricingExperimentSchema = new mongoose.Schema(
  {
    experimentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "running", "paused", "concluded"],
      default: "draft",
      index: true,
    },
    startDate: { type: Date },
    endDate: { type: Date },
    targetTier: { type: String, default: "pro" },
    variants: [
      {
        planId: { type: String, required: true },
        name: { type: String, required: true },
        trafficAllocation: { type: Number, default: 0 },
      },
    ],
    metrics: [
      {
        variant: { type: String, required: true },
        impressions: { type: Number, default: 0 },
        checkoutStarts: { type: Number, default: 0 },
        conversions: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        conversionRate: { type: Number },
        avgRevenuePerUser: { type: Number },
      },
    ],
    statistics: {
      sampleSize: { type: Number },
      confidenceLevel: { type: Number },
      pValue: { type: Number },
      significant: { type: Boolean },
      winner: { type: String },
    },
    createdBy: { type: String },
    concludedAt: { type: Date },
    winningVariant: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "pricing_experiments", versionKey: false }
);

const PricingExperiment = quicklookConn.model("PricingExperiment", pricingExperimentSchema);
export default PricingExperiment;
