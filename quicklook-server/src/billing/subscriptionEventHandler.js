"use strict";

import User from "../models/userModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import * as couponService from "../services/couponService.js";
import logger from "../configs/loggingConfig.js";

const FREE_SESSION_CAP = 1000;
const PRO_SESSION_CAP = 5000;
const FREE_RETENTION_DAYS = 30;
const PRO_RETENTION_DAYS = 90;
const GRACE_PERIOD_DAYS = 3;

function getSessionCapForPlan(plan) {
  return plan === "pro" ? PRO_SESSION_CAP : FREE_SESSION_CAP;
}

function getRetentionDaysForPlan(plan) {
  return plan === "pro" ? PRO_RETENTION_DAYS : FREE_RETENTION_DAYS;
}

/**
 * Apply normalized webhook events to User and projects. No provider-specific logic.
 * @param {Array<{ type: string, subscriptionId?: string, customerId?: string, status?: string, priceId?: string, interval?: string, currentPeriodEnd?: Date, cancelAtPeriodEnd?: boolean }>} events
 */
export async function handleSubscriptionEvents(events) {
  const provider = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
  for (const ev of events) {
    try {
      if (ev.type === "subscription.created" || ev.type === "subscription.updated") {
        const user = await User.findOne({
          $or: [{ "billing.customerId": ev.customerId }, { "billing.subscriptionId": ev.subscriptionId }],
        });
        if (!user) {
          logger.warn("subscriptionEventHandler: no user for subscription event", {
            type: ev.type,
            customerId: ev.customerId,
            subscriptionId: ev.subscriptionId,
          });
          continue;
        }
        const isActive = ev.status === "active" || ev.status === "trialing";
        const newPlan = isActive ? "pro" : user.plan === "pro" ? user.plan : "free";
        const sessionCap = getSessionCapForPlan(newPlan);
        const retentionDays = getRetentionDaysForPlan(newPlan);

        user.billing = user.billing || {};
        user.billing.provider = provider;
        user.billing.customerId = ev.customerId || user.billing.customerId;
        user.billing.subscriptionId = ev.subscriptionId || user.billing.subscriptionId;
        user.billing.status = ev.status;
        user.billing.priceId = ev.priceId;
        user.billing.interval = ev.interval;
        user.billing.currentPeriodEnd = ev.currentPeriodEnd;
        user.billing.cancelAtPeriodEnd = ev.cancelAtPeriodEnd || false;
        user.plan = newPlan;
        user.sessionCap = sessionCap;
        user.gracePeriodEnd = undefined;
        await user.save();

        await QuicklookProject.updateMany(
          { owner: user._id.toString() },
          { $set: { retentionDays } }
        );
      } else if (ev.type === "subscription.canceled") {
        const user = await User.findOne({
          $or: [{ "billing.customerId": ev.customerId }, { "billing.subscriptionId": ev.subscriptionId }],
        });
        if (!user) continue;
        user.gracePeriodEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
        if (user.billing) {
          user.billing.status = "canceled";
          user.billing.subscriptionId = undefined;
          user.billing.cancelAtPeriodEnd = true;
        }
        await user.save();
        // Actual downgrade to free happens in grace period job when gracePeriodEnd < now
      } else if (ev.type === "checkout.completed") {
        // Optional: ensure user has customerId set if they didn't before
        const user = await User.findOne({ "billing.customerId": ev.customerId });
        if (user && !user.billing?.customerId) {
          user.billing = user.billing || {};
          user.billing.customerId = ev.customerId;
          user.billing.provider = provider;
          await user.save();
        }
        // When subscription was created with a DB coupon, track redemption (source of truth: webhook)
        const meta = ev.metadata || {};
        if (meta.couponId && meta.userId && ev.subscriptionId) {
          try {
            await couponService.trackRedemption(meta.couponId, meta.userId, ev.subscriptionId);
          } catch (err) {
            logger.error("subscriptionEventHandler: trackRedemption failed", {
              couponId: meta.couponId,
              error: err.message,
            });
          }
        }
      }
    } catch (err) {
      logger.error("subscriptionEventHandler: failed to process event", {
        type: ev.type,
        error: err.message,
      });
    }
  }
}
