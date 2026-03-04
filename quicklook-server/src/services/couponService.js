"use strict";

import CouponConfiguration from "../models/couponConfigurationModel.js";
import User from "../models/userModel.js";
import { billingService } from "../billing/billingService.js";

/**
 * Normalize code for case-insensitive lookup.
 * @param {string} code
 * @returns {string}
 */
function normalizeCode(code) {
  return (code || "").trim().toLowerCase();
}

/**
 * Get active coupon by code (case-insensitive).
 * @param {string} code
 * @returns {Promise<import('mongoose').Document|null>}
 */
export async function getCouponByCode(code) {
  const codeLower = normalizeCode(code);
  if (!codeLower) return null;
  return CouponConfiguration.findOne({ codeLower, active: true }).lean();
}

/**
 * Check if user can use coupon (first-time, redemption limits, etc.).
 * @param {string} userId - User _id string
 * @param {string} couponId - Internal couponId (e.g. launch50)
 * @returns {Promise<{ allowed: boolean, error?: string }>}
 */
export async function canUserUseCoupon(userId, couponId) {
  if (!userId || !couponId) return { allowed: false, error: "Missing user or coupon" };
  const coupon = await CouponConfiguration.findOne({ couponId, active: true }).lean();
  if (!coupon) return { allowed: false, error: "Coupon not found or inactive" };

  const restr = coupon.restrictions || {};
  if (restr.firstTimeOnly) {
    const user = await User.findById(userId).select("billing couponsUsed").lean();
    if (!user) return { allowed: false, error: "User not found" };
    const hasPriorSubscription = !!(
      user.billing?.subscriptionId ||
      (user.couponsUsed && user.couponsUsed.some((u) => u.couponId === couponId))
    );
    if (hasPriorSubscription) return { allowed: false, error: "Coupon is for first-time subscribers only" };
  }

  if (restr.expiresAt && new Date(restr.expiresAt) < new Date()) {
    return { allowed: false, error: "Coupon has expired" };
  }
  const max = restr.maxRedemptions != null ? restr.maxRedemptions : null;
  const current = restr.currentRedemptions != null ? restr.currentRedemptions : 0;
  if (max != null && current >= max) return { allowed: false, error: "Coupon redemption limit reached" };

  return { allowed: true };
}

/**
 * Validate coupon: DB config first, then fall back to Stripe-only validation.
 * Respects firstTimeOnly, expiresAt, maxRedemptions. tier is reserved for future use.
 * @param {string} code
 * @param {string|null} userId - Optional; required for firstTimeOnly checks
 * @param {string} [tier] - Reserved for future tier restrictions
 * @returns {Promise<{ valid: boolean, error?: string, promoCodeId?: string, couponId?: string, discount?: object, displayName?: string, description?: string }>}
 */
export async function validateCoupon(code, userId = null, tier = "pro") {
  const raw = (code || "").trim();
  if (!raw) return { valid: false, error: "Code is required" };

  const coupon = await getCouponByCode(raw);
  if (coupon) {
    if (!coupon.active) return { valid: false, error: "Coupon is not active" };
    const restr = coupon.restrictions || {};
    if (restr.expiresAt && new Date(restr.expiresAt) < new Date()) {
      return { valid: false, error: "Coupon has expired" };
    }
    const max = restr.maxRedemptions != null ? restr.maxRedemptions : null;
    const current = restr.currentRedemptions != null ? restr.currentRedemptions : 0;
    if (max != null && current >= max) return { valid: false, error: "Coupon redemption limit reached" };
    if (restr.firstTimeOnly && userId) {
      const can = await canUserUseCoupon(userId, coupon.couponId);
      if (!can.allowed) return { valid: false, error: can.error };
    }

    const stripePromoId = coupon.stripe?.promoCodeId;
    if (stripePromoId) {
      return {
        valid: true,
        promoCodeId: stripePromoId,
        couponId: coupon.couponId,
        discount: coupon.discount,
        displayName: coupon.displayName,
        description: coupon.description,
      };
    }
    // Not synced to Stripe; fall back to provider validation
  }

  const stripeResult = await billingService.validatePromoCode(raw);
  if (stripeResult.valid) return stripeResult;
  return stripeResult;
}

/**
 * Track redemption: increment coupon currentRedemptions and append to user.couponsUsed.
 * @param {string} couponId - Internal couponId (e.g. launch50)
 * @param {string} userId - User _id string
 * @param {string} subscriptionId - Stripe subscription id
 */
export async function trackRedemption(couponId, userId, subscriptionId) {
  if (!couponId || !userId || !subscriptionId) return;
  const coupon = await CouponConfiguration.findOne({ couponId }).lean();
  if (!coupon) return;
  const code = coupon.code;

  await CouponConfiguration.updateOne(
    { couponId },
    { $inc: { "restrictions.currentRedemptions": 1 }, $set: { updatedAt: new Date() } }
  );

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        couponsUsed: {
          couponId,
          code,
          usedAt: new Date(),
          subscriptionId,
        },
      },
    }
  );
}

/**
 * Create Stripe coupon (and optional promo code) from DB config. Used by seed/import.
 * Uses billingService.createCoupon.
 * @param {object} couponConfig - Document with type, discount, code, etc.
 * @returns {Promise<{ couponId: string, promoCodeId?: string }>}
 */
export async function createStripeCoupon(couponConfig) {
  const spec = { code: couponConfig.code || undefined };
  if (couponConfig.type === "percentage" && couponConfig.discount?.percentOff != null) {
    spec.percentOff = couponConfig.discount.percentOff;
    spec.duration = "once";
  } else if (couponConfig.type === "free_months" && couponConfig.discount?.freeMonths != null) {
    spec.duration = "repeating";
    spec.durationInMonths = couponConfig.discount.freeMonths;
  } else {
    throw new Error("Coupon config must have type percentage (percentOff) or free_months (freeMonths)");
  }
  return billingService.createCoupon(spec);
}

/**
 * Create Stripe promotion code for an existing Stripe coupon. Used by seed/import.
 * @param {string} stripeCouponId - Stripe coupon ID
 * @param {string} code - User-facing code (e.g. LAUNCH50)
 * @param {object} [restrictions] - Reserved for future Stripe restriction params
 * @returns {Promise<{ promoCodeId: string }>}
 */
export async function createStripePromoCode(stripeCouponId, code, restrictions = {}) {
  return billingService.createPromoCode(stripeCouponId, code);
}
