"use strict";

import mongoose from "mongoose";
import { quicklookConn } from "../db.js";

const couponConfigurationSchema = new mongoose.Schema(
  {
    couponId: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true, index: true },
    code: { type: String, required: true, trim: true },
    codeLower: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ["percentage", "free_months"], index: true },
    discount: {
      percentOff: { type: Number },
      freeMonths: { type: Number },
    },
    stripe: {
      couponId: { type: String },
      promoCodeId: { type: String },
    },
    restrictions: {
      firstTimeOnly: { type: Boolean, default: false },
      minAmount: { type: Number },
      expiresAt: { type: Date },
      maxRedemptions: { type: Number },
      currentRedemptions: { type: Number, default: 0 },
    },
    displayName: { type: String, default: "" },
    description: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: String },
  },
  { collection: "coupon_configurations", versionKey: false }
);

couponConfigurationSchema.pre("validate", function (next) {
  if (this.code != null) this.codeLower = String(this.code).trim().toLowerCase();
  next();
});

const CouponConfiguration = quicklookConn.model("CouponConfiguration", couponConfigurationSchema);
export default CouponConfiguration;
