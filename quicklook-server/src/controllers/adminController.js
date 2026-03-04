"use strict";

import PlanConfiguration from "../models/planConfigurationModel.js";
import PricingExperiment from "../models/pricingExperimentModel.js";
import CouponConfiguration from "../models/couponConfigurationModel.js";
import { invalidatePlanCache } from "../services/planConfigService.js";
import * as couponService from "../services/couponService.js";
import logger from "../configs/loggingConfig.js";

// -----------------------------------------------------------------------------
// Plans
// -----------------------------------------------------------------------------

export async function listPlans(req, res) {
  try {
    const plans = await PlanConfiguration.find().sort({ displayOrder: 1, tier: 1 }).lean();
    return res.status(200).json({ plans });
  } catch (err) {
    logger.error("admin.listPlans", { error: err.message });
    return res.status(500).json({ error: "Failed to list plans" });
  }
}

export async function getPlan(req, res) {
  try {
    const plan = await PlanConfiguration.findOne({ planId: req.params.planId }).lean();
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    return res.status(200).json(plan);
  } catch (err) {
    logger.error("admin.getPlan", { error: err.message });
    return res.status(500).json({ error: "Failed to get plan" });
  }
}

export async function createPlan(req, res) {
  try {
    const body = req.body || {};
    if (!body.planId || !body.tier || !body.displayName) {
      return res.status(400).json({ error: "planId, tier, and displayName are required" });
    }
    const existing = await PlanConfiguration.findOne({ planId: body.planId }).lean();
    if (existing) return res.status(409).json({ error: "Plan with this planId already exists" });
    const plan = new PlanConfiguration({
      ...body,
      updatedAt: new Date(),
    });
    await plan.save();
    invalidatePlanCache();
    return res.status(201).json(plan.toObject ? plan.toObject() : plan);
  } catch (err) {
    logger.error("admin.createPlan", { error: err.message });
    return res.status(500).json({ error: "Failed to create plan" });
  }
}

export async function updatePlan(req, res) {
  try {
    const plan = await PlanConfiguration.findOne({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const body = req.body || {};
    const { planId, ...updatable } = body;
    Object.assign(plan, updatable, { updatedAt: new Date() });
    await plan.save();
    invalidatePlanCache();
    return res.status(200).json(plan.toObject ? plan.toObject() : plan);
  } catch (err) {
    logger.error("admin.updatePlan", { error: err.message });
    return res.status(500).json({ error: "Failed to update plan" });
  }
}

export async function deletePlan(req, res) {
  try {
    const plan = await PlanConfiguration.findOne({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    plan.active = false;
    plan.updatedAt = new Date();
    await plan.save();
    invalidatePlanCache();
    return res.status(200).json({ message: "Plan deactivated", planId: plan.planId });
  } catch (err) {
    logger.error("admin.deletePlan", { error: err.message });
    return res.status(500).json({ error: "Failed to deactivate plan" });
  }
}

export async function activatePlan(req, res) {
  try {
    const plan = await PlanConfiguration.findOne({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    plan.active = true;
    plan.updatedAt = new Date();
    await plan.save();
    invalidatePlanCache();
    return res.status(200).json({ message: "Plan activated", planId: plan.planId });
  } catch (err) {
    logger.error("admin.activatePlan", { error: err.message });
    return res.status(500).json({ error: "Failed to activate plan" });
  }
}

export async function deactivatePlan(req, res) {
  try {
    const plan = await PlanConfiguration.findOne({ planId: req.params.planId });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    plan.active = false;
    plan.updatedAt = new Date();
    await plan.save();
    invalidatePlanCache();
    return res.status(200).json({ message: "Plan deactivated", planId: plan.planId });
  } catch (err) {
    logger.error("admin.deactivatePlan", { error: err.message });
    return res.status(500).json({ error: "Failed to deactivate plan" });
  }
}

// -----------------------------------------------------------------------------
// Experiments
// -----------------------------------------------------------------------------

function findExperimentById(id) {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  return PricingExperiment.findOne(
    isObjectId ? { $or: [{ _id: id }, { experimentId: id }] } : { experimentId: id }
  );
}

function ensureMetricsForVariants(doc) {
  if (!doc.variants || !Array.isArray(doc.variants)) return;
  const names = doc.variants.map((v) => (v.name != null ? String(v.name) : null)).filter(Boolean);
  const existing = (doc.metrics || []).map((m) => m.variant);
  for (const name of names) {
    if (!existing.includes(name)) {
      doc.metrics = doc.metrics || [];
      doc.metrics.push({
        variant: name,
        impressions: 0,
        checkoutStarts: 0,
        conversions: 0,
        revenue: 0,
        conversionRate: 0,
        avgRevenuePerUser: 0,
      });
    }
  }
}

export async function listExperiments(req, res) {
  try {
    const experiments = await PricingExperiment.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ experiments });
  } catch (err) {
    logger.error("admin.listExperiments", { error: err.message });
    return res.status(500).json({ error: "Failed to list experiments" });
  }
}

export async function createExperiment(req, res) {
  try {
    const body = req.body || {};
    if (!body.experimentId || !body.name) {
      return res.status(400).json({ error: "experimentId and name are required" });
    }
    const existing = await PricingExperiment.findOne({ experimentId: body.experimentId }).lean();
    if (existing) return res.status(409).json({ error: "Experiment with this experimentId already exists" });
    const experiment = new PricingExperiment({
      ...body,
      createdBy: req.user?.userId,
      updatedAt: new Date(),
    });
    ensureMetricsForVariants(experiment);
    await experiment.save();
    return res.status(201).json(experiment.toObject ? experiment.toObject() : experiment);
  } catch (err) {
    logger.error("admin.createExperiment", { error: err.message });
    return res.status(500).json({ error: "Failed to create experiment" });
  }
}

export async function getExperiment(req, res) {
  try {
    const id = req.params.id;
    const experiment = await findExperimentById(id).lean();
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    return res.status(200).json(experiment);
  } catch (err) {
    logger.error("admin.getExperiment", { error: err.message });
    return res.status(500).json({ error: "Failed to get experiment" });
  }
}

export async function updateExperiment(req, res) {
  try {
    const id = req.params.id;
    const experiment = await findExperimentById(id);
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    if (experiment.status === "concluded") {
      return res.status(400).json({ error: "Cannot edit a concluded experiment" });
    }
    const body = req.body || {};
    if (body.name != null) experiment.name = body.name;
    if (body.description != null) experiment.description = body.description;
    if (body.status != null) experiment.status = body.status;
    if (body.targetTier != null) experiment.targetTier = body.targetTier;
    if (Array.isArray(body.variants)) experiment.variants = body.variants;
    ensureMetricsForVariants(experiment);
    experiment.updatedAt = new Date();
    await experiment.save();
    return res.status(200).json(experiment.toObject ? experiment.toObject() : experiment);
  } catch (err) {
    logger.error("admin.updateExperiment", { error: err.message });
    return res.status(500).json({ error: "Failed to update experiment" });
  }
}

export async function getExperimentResults(req, res) {
  try {
    const id = req.params.id;
    const experiment = await findExperimentById(id).lean();
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    const metrics = (experiment.metrics || []).map((m) => ({
      ...m,
      conversionRate: m.impressions > 0 ? (m.conversions / m.impressions) * 100 : 0,
      avgRevenuePerUser: m.conversions > 0 ? m.revenue / m.conversions : 0,
    }));
    return res.status(200).json({ ...experiment, metrics });
  } catch (err) {
    logger.error("admin.getExperimentResults", { error: err.message });
    return res.status(500).json({ error: "Failed to get experiment results" });
  }
}

export async function concludeExperiment(req, res) {
  try {
    const id = req.params.id;
    const experiment = await findExperimentById(id);
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    if (experiment.status === "concluded") {
      return res.status(400).json({ error: "Experiment already concluded" });
    }
    const winner = req.body?.winningVariant ?? null;
    experiment.status = "concluded";
    experiment.concludedAt = new Date();
    experiment.winningVariant = winner;
    experiment.updatedAt = new Date();
    await experiment.save();
    return res.status(200).json(experiment.toObject ? experiment.toObject() : experiment);
  } catch (err) {
    logger.error("admin.concludeExperiment", { error: err.message });
    return res.status(500).json({ error: "Failed to conclude experiment" });
  }
}

export async function trackExperiment(req, res) {
  try {
    const id = req.params.id;
    const { event, userId, variant, amount } = req.body || {};
    if (!event || !variant) {
      return res.status(400).json({ error: "event and variant are required" });
    }
    const validEvents = ["impression", "checkout_start", "conversion"];
    if (!validEvents.includes(event)) {
      return res.status(400).json({ error: "event must be one of: " + validEvents.join(", ") });
    }
    const experiment = await findExperimentById(id);
    if (!experiment) return res.status(404).json({ error: "Experiment not found" });
    if (experiment.status !== "running" && experiment.status !== "paused") {
      return res.status(400).json({ error: "Tracking only allowed for running or paused experiments" });
    }
    ensureMetricsForVariants(experiment);
    await experiment.save();

    const metrics = experiment.metrics || [];
    let entry = metrics.find((m) => String(m.variant) === String(variant));
    if (!entry) {
      entry = { variant, impressions: 0, checkoutStarts: 0, conversions: 0, revenue: 0, conversionRate: 0, avgRevenuePerUser: 0 };
      metrics.push(entry);
    }
    if (event === "impression") entry.impressions = (entry.impressions || 0) + 1;
    if (event === "checkout_start") entry.checkoutStarts = (entry.checkoutStarts || 0) + 1;
    if (event === "conversion") {
      entry.conversions = (entry.conversions || 0) + 1;
      entry.revenue = (entry.revenue || 0) + (typeof amount === "number" ? amount : 0);
    }
    experiment.metrics = metrics;
    experiment.updatedAt = new Date();
    await experiment.save();

    return res.status(200).json({ ok: true, event, variant });
  } catch (err) {
    logger.error("admin.trackExperiment", { error: err.message });
    return res.status(500).json({ error: "Failed to track event" });
  }
}

// -----------------------------------------------------------------------------
// Coupons
// -----------------------------------------------------------------------------

export async function listCoupons(req, res) {
  try {
    const coupons = await CouponConfiguration.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ coupons });
  } catch (err) {
    logger.error("admin.listCoupons", { error: err.message });
    return res.status(500).json({ error: "Failed to list coupons" });
  }
}

export async function getCoupon(req, res) {
  try {
    const coupon = await CouponConfiguration.findOne({ couponId: req.params.couponId }).lean();
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    return res.status(200).json(coupon);
  } catch (err) {
    logger.error("admin.getCoupon", { error: err.message });
    return res.status(500).json({ error: "Failed to get coupon" });
  }
}

export async function createCoupon(req, res) {
  try {
    const body = req.body || {};
    if (!body.couponId || !body.code || !body.type) {
      return res.status(400).json({ error: "couponId, code, and type are required" });
    }
    const existing = await CouponConfiguration.findOne({ couponId: body.couponId }).lean();
    if (existing) return res.status(409).json({ error: "Coupon with this couponId already exists" });
    const doc = new CouponConfiguration({
      ...body,
      stripe: body.stripe || {},
      restrictions: body.restrictions || {},
      createdBy: req.user?.userId,
      updatedAt: new Date(),
    });
    await doc.save();
    if (!doc.stripe?.couponId) {
      try {
        const created = await couponService.createStripeCoupon(doc);
        doc.stripe = { ...doc.stripe, couponId: created.couponId, promoCodeId: created.promoCodeId };
        if (!created.promoCodeId && created.couponId) {
          const promo = await couponService.createStripePromoCode(created.couponId, doc.code, doc.restrictions);
          doc.stripe.promoCodeId = promo.promoCodeId;
        }
        await doc.save();
      } catch (e) {
        logger.warn("admin.createCoupon: Stripe sync failed", { error: e.message });
      }
    }
    return res.status(201).json(doc.toObject ? doc.toObject() : doc);
  } catch (err) {
    logger.error("admin.createCoupon", { error: err.message });
    return res.status(500).json({ error: "Failed to create coupon" });
  }
}

export async function updateCoupon(req, res) {
  try {
    const coupon = await CouponConfiguration.findOne({ couponId: req.params.couponId });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    const body = req.body || {};
    const { couponId, stripe, ...updatable } = body;
    Object.assign(coupon, updatable, { updatedAt: new Date() });
    await coupon.save();
    return res.status(200).json(coupon.toObject ? coupon.toObject() : coupon);
  } catch (err) {
    logger.error("admin.updateCoupon", { error: err.message });
    return res.status(500).json({ error: "Failed to update coupon" });
  }
}

export async function deleteCoupon(req, res) {
  try {
    const coupon = await CouponConfiguration.findOne({ couponId: req.params.couponId });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    coupon.active = false;
    coupon.updatedAt = new Date();
    await coupon.save();
    return res.status(200).json({ message: "Coupon deactivated", couponId: coupon.couponId });
  } catch (err) {
    logger.error("admin.deleteCoupon", { error: err.message });
    return res.status(500).json({ error: "Failed to deactivate coupon" });
  }
}

export async function syncCoupon(req, res) {
  try {
    const coupon = await CouponConfiguration.findOne({ couponId: req.params.couponId });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    let stripeCouponId = coupon.stripe?.couponId;
    if (!stripeCouponId) {
      const created = await couponService.createStripeCoupon(coupon);
      stripeCouponId = created.couponId;
      coupon.stripe = coupon.stripe || {};
      coupon.stripe.couponId = stripeCouponId;
    }
    if (!coupon.stripe?.promoCodeId) {
      const promo = await couponService.createStripePromoCode(stripeCouponId, coupon.code, coupon.restrictions);
      coupon.stripe.promoCodeId = promo.promoCodeId;
    }
    coupon.updatedAt = new Date();
    await coupon.save();
    return res.status(200).json(coupon.toObject ? coupon.toObject() : coupon);
  } catch (err) {
    logger.error("admin.syncCoupon", { error: err.message });
    return res.status(500).json({ error: "Failed to sync coupon to Stripe" });
  }
}
