"use strict";

import User from "../models/userModel.js";
import { billingService } from "../billing/billingService.js";
import { handleSubscriptionEvents } from "../billing/subscriptionEventHandler.js";
import {
  getPlanByTier,
  getPlanByPlanId,
  getPriceIdForInterval,
  getActivePlansForUser,
} from "../services/planConfigService.js";
import * as couponService from "../services/couponService.js";
import logger from "../configs/loggingConfig.js";
import { sendAdminNotification } from "../services/emailService.js";

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
    try {
      await sendAdminNotification({
        type: "checkout_started",
        email: user.email,
        name: user.name,
      });
    } catch (e) {
      logger.warn("Admin checkout-started notification failed (non-fatal)", { error: e.message });
    }
    return res.status(200).json({ redirectUrl: session.redirectUrl });
  } catch (err) {
    logger.error("createCheckout", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to create checkout" });
  }
}

/**
 * Confirm checkout after redirect: sync user plan from Stripe session.
 * Handles webhook delay or missing webhook (e.g. local dev). Call with session_id from URL.
 */
export async function confirmCheckout(req, res) {
  try {
    const sessionId = req.body?.sessionId || req.query?.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "session_id is required" });
    }
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const session = await billingService.getCheckoutSession(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Invalid or expired checkout session" });
    }
    if (session.paymentStatus !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }
    if (session.metadata?.userId !== userId) {
      return res.status(403).json({ error: "Checkout session does not belong to this user" });
    }
    if (!session.subscriptionId) {
      return res.status(400).json({ error: "No subscription in session" });
    }

    const sub = await billingService.getSubscription(session.subscriptionId);
    if (!sub) {
      return res.status(400).json({ error: "Subscription not found" });
    }
    const ev = {
      type: "subscription.created",
      subscriptionId: session.subscriptionId,
      customerId: session.customerId,
      status: sub.status,
      priceId: sub.priceId,
      interval: sub.interval,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
    };
    await handleSubscriptionEvents([ev]);
    const paymentDetails = {
      planType: "pro",
      subscriptionType: sub.interval || "annual",
      amount: sub.amount,
      currency: sub.currency || "USD",
    };
    return res.status(200).json({ plan: "pro", synced: true, paymentDetails });
  } catch (err) {
    logger.error("confirmCheckout", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to confirm checkout" });
  }
}

/**
 * Sync current user's plan from Stripe using their billing.customerId.
 * Use when user paid but plan wasn't updated (e.g. webhook missed, or before confirm-checkout existed).
 */
export async function syncSubscription(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const customerId = user.billing?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No billing customer. Subscribe first." });
    }

    const subscriptionId = await billingService.getActiveSubscriptionIdForCustomer(customerId);
    if (!subscriptionId) {
      return res.status(404).json({ error: "No active subscription found for this account." });
    }

    const sub = await billingService.getSubscription(subscriptionId);
    if (!sub) {
      return res.status(400).json({ error: "Subscription not found" });
    }
    const ev = {
      type: "subscription.created",
      subscriptionId,
      customerId,
      status: sub.status,
      priceId: sub.priceId,
      interval: sub.interval,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
    };
    await handleSubscriptionEvents([ev]);
    return res.status(200).json({ plan: "pro", synced: true });
  } catch (err) {
    logger.error("syncSubscription", { error: err.message });
    return res.status(500).json({ error: err.message || "Failed to sync subscription" });
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
