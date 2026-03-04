"use strict";

import User from "../models/userModel.js";
import { billingService } from "../billing/billingService.js";
import {
  getPlanByTier,
  getPlanByPlanId,
  getPriceIdForInterval,
  getActivePlansForUser,
} from "../services/planConfigService.js";
import * as couponService from "../services/couponService.js";
import logger from "../configs/loggingConfig.js";

const APP_URL = process.env.APP_URL || "http://localhost:5173";

export async function createCheckout(req, res) {
  try {
    const { tier = "pro", interval = "annual", couponCode } = req.body || {};
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (tier === "pro") await getActivePlansForUser(userId);
    const assigned = (await User.findById(userId).select("assignedPlanVariants").lean())?.assignedPlanVariants;
    let planConfig = null;
    if (tier === "pro" && assigned?.pro) {
      planConfig = await getPlanByPlanId(assigned.pro);
    }
    if (!planConfig) planConfig = await getPlanByTier(tier);
    const priceId = planConfig ? getPriceIdForInterval(planConfig, interval) : null;
    if (!priceId) {
      return res.status(503).json({
        error: "Billing not configured. Add plan configuration with Stripe price IDs (run seed:plan-config).",
      });
    }
    let customerId = user.billing?.customerId;
    if (!customerId) {
      const created = await billingService.createCustomer(user.email, user.name);
      customerId = created.customerId;
      user.billing = user.billing || {};
      user.billing.provider = process.env.PAYMENT_PROVIDER || "stripe";
      user.billing.customerId = customerId;
      await user.save();
    }
    let promoCodeId = null;
    let couponIdForTracking = null;
    if (couponCode && typeof couponCode === "string") {
      const validated = await couponService.validateCoupon(couponCode.trim(), user._id.toString(), tier);
      if (validated.valid && validated.promoCodeId) {
        promoCodeId = validated.promoCodeId;
        if (validated.couponId) couponIdForTracking = validated.couponId;
      }
    }
    const metadata = { userId: user._id.toString() };
    if (couponIdForTracking) metadata.couponId = couponIdForTracking;
    const session = await billingService.createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${APP_URL}/account/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${APP_URL}/account/payment-cancel`,
      promoCodeId: promoCodeId || undefined,
      metadata,
    });
    return res.status(200).json({ redirectUrl: session.redirectUrl });
  } catch (err) {
    logger.error("createCheckout", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to create checkout" });
  }
}

export async function validateCoupon(req, res) {
  try {
    const code = (req.body?.code || req.query?.code || "").trim();
    if (!code) return res.status(400).json({ valid: false, error: "Code is required" });
    const result = await billingService.validatePromoCode(code);
    return res.status(200).json(result);
  } catch (err) {
    logger.error("validateCoupon", { error: err.message });
    return res.status(500).json({ valid: false, error: "Validation failed" });
  }
}

export async function getStatus(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId).select("plan billing sessionCap").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    let subscription = null;
    if (user.billing?.subscriptionId) {
      subscription = await billingService.getSubscription(user.billing.subscriptionId);
    }
    return res.status(200).json({
      plan: user.plan || "free",
      sessionCap: user.sessionCap ?? null,
      subscription: subscription
        ? {
            status: subscription.status,
            interval: subscription.interval,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    });
  } catch (err) {
    logger.error("getStatus", { error: err.message });
    return res.status(500).json({ error: "Failed to get status" });
  }
}

export async function createPortal(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId).select("billing").lean();
    if (!user?.billing?.customerId) {
      return res.status(400).json({ error: "No billing customer. Subscribe first." });
    }
    const returnUrl = req.body?.returnUrl || `${APP_URL}/account/subscription`;
    const { redirectUrl } = await billingService.createBillingPortalSession(
      user.billing.customerId,
      returnUrl
    );
    return res.status(200).json({ redirectUrl });
  } catch (err) {
    logger.error("createPortal", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to open billing portal" });
  }
}

export async function getInvoices(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId).select("billing").lean();
    if (!user?.billing?.customerId) {
      return res.status(200).json({ invoices: [] });
    }
    const limit = Math.min(parseInt(req.query?.limit, 10) || 10, 50);
    const invoices = await billingService.getInvoices(user.billing.customerId, limit);
    return res.status(200).json({ invoices });
  } catch (err) {
    logger.error("getInvoices", { error: err.message });
    return res.status(500).json({ error: "Failed to list invoices" });
  }
}

export async function cancel(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId);
    if (!user?.billing?.subscriptionId) {
      return res.status(400).json({ error: "No active subscription to cancel" });
    }
    const result = await billingService.cancelSubscription(user.billing.subscriptionId);
    return res.status(200).json(result);
  } catch (err) {
    logger.error("cancel", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to cancel" });
  }
}
