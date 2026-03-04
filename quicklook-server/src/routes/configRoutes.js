"use strict";

import express from "express";
import { billingService } from "../billing/billingService.js";
import { getActivePlans, getActivePlansForUser, getActivePlansForVisitorId } from "../services/planConfigService.js";
import * as couponService from "../services/couponService.js";
import { optionalAuth } from "../middleware/jwtAuth.js";
import User from "../models/userModel.js";

const router = express.Router();

/** Public: plans for pricing page. With optional auth, returns user-specific plans and experimentTracking. */
router.get("/plans", optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (userId) {
      const plans = await getActivePlansForUser(userId);
      const user = await User.findById(userId).select("plan abTestCohorts").lean();
      const userPlan = user?.plan || "free";
      const experimentTracking = {};
      if (user?.abTestCohorts?.length) {
        for (const c of user.abTestCohorts) {
          if (c.experimentId && c.variant != null) experimentTracking[c.experimentId] = c.variant;
        }
      }
      return res.status(200).json({ plans, userPlan, experimentTracking });
    }
    // Anonymous: if they sent a visitor ID, show their experiment variant so landing page = same price after signup
    const visitorId = (req.headers["x-visitor-id"] || req.query.visitorId || "").trim();
    if (visitorId) {
      const plansForVisitor = await getActivePlansForVisitorId(visitorId);
      if (plansForVisitor?.length) return res.status(200).json({ plans: plansForVisitor });
    }
    // No visitor ID or no running experiment: one plan per tier (default)
    const allPlans = await getActivePlans();
    const seenTiers = new Set();
    const plans = allPlans.filter((p) => {
      const tier = p.tier || "";
      if (seenTiers.has(tier)) return false;
      seenTiers.add(tier);
      return true;
    });
    return res.status(200).json({ plans });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load plans" });
  }
});

/** Public: billing client config (publishable key, provider) */
router.get("/billing", async (req, res) => {
  try {
    const config = await billingService.getClientConfig();
    return res.status(200).json({ ...config, checkoutMethod: config.checkoutMethod || "redirect" });
  } catch (err) {
    return res.status(200).json({ provider: process.env.PAYMENT_PROVIDER || "stripe", checkoutMethod: "redirect" });
  }
});

/** Public: validate coupon code. Uses DB config first, falls back to Stripe-only. optionalAuth so firstTimeOnly can be checked when user is logged in. */
router.get("/coupons/validate", optionalAuth, async (req, res) => {
  try {
    const code = (req.query?.code || "").trim();
    if (!code) return res.status(400).json({ valid: false, error: "Code is required" });
    const userId = req.user?.userId ?? null;
    const result = await couponService.validateCoupon(code, userId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ valid: false, error: "Validation failed" });
  }
});

export default router;
