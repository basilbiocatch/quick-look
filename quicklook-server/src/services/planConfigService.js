"use strict";

import crypto from "crypto";
import PlanConfiguration from "../models/planConfigurationModel.js";
import PricingExperiment from "../models/pricingExperimentModel.js";
import User from "../models/userModel.js";
import logger from "../configs/loggingConfig.js";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let planListCache = null;
let planListCacheExpiry = 0;

/**
 * Map DB document to public API shape (no internal IDs).
 * @param {import("mongoose").Document} doc
 * @returns {Object}
 */
function mapConfigToPublicPlan(doc) {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : doc;
  return {
    tier: d.tier,
    displayName: d.displayName,
    tagline: d.tagline || undefined,
    pricing:
      d.tier === "free"
        ? null
        : {
            monthly: d.pricing?.monthly
              ? {
                  amount: d.pricing.monthly.amount,
                  displayPrice: d.pricing.monthly.displayPrice,
                }
              : undefined,
            annual: d.pricing?.annual
              ? {
                  amount: d.pricing.annual.amount,
                  displayPrice: d.pricing.annual.displayPrice,
                  effectiveMonthly: d.pricing.annual.effectiveMonthly,
                  savingsText: d.pricing.annual.savingsText,
                }
              : undefined,
          },
    limits:
      d.limits && Object.keys(d.limits).length
        ? {
            retentionDays: d.limits.retentionDays,
            sessionCap: d.limits.sessionCap,
            projectLimit: d.limits.projectLimit,
          }
        : undefined,
    features:
      d.features && Object.keys(d.features).length
        ? {
            recordings: d.features.recordings,
            aiTools: d.features.aiTools,
            devTools: d.features.devTools,
          }
        : undefined,
    ui:
      d.ui && Object.keys(d.ui).length
        ? {
            badgeText: d.ui.badgeText,
            badgeColor: d.ui.badgeColor,
            description: d.ui.description,
            featureList: d.ui.featureList,
          }
        : undefined,
  };
}

/**
 * Get active plans for the pricing page (cached).
 * Returns array in displayOrder for public GET /api/config/plans.
 */
export async function getActivePlans() {
  if (planListCache && Date.now() < planListCacheExpiry) {
    return planListCache;
  }
  try {
    const docs = await PlanConfiguration.find({ active: true })
      .sort({ displayOrder: 1, tier: 1 })
      .lean();
    planListCache = ensurePlansIncludeEnterprise(
      docs.length > 0
        ? docs.map(mapConfigToPublicPlan).filter(Boolean)
        : getDefaultPlans()
    );
    planListCacheExpiry = Date.now() + CACHE_TTL_MS;
    return planListCache;
  } catch (err) {
    logger.error("planConfigService.getActivePlans", { error: err.message });
    return getDefaultPlans();
  }
}

/**
 * Get a single plan config by tier (first active plan for that tier).
 * Used by create-checkout to resolve priceId.
 */
export async function getPlanByTier(tier) {
  const doc = await PlanConfiguration.findOne({ tier, active: true }).lean();
  return doc || null;
}

/**
 * Get a single plan config by planId (active only).
 */
export async function getPlanByPlanId(planId) {
  if (!planId) return null;
  const doc = await PlanConfiguration.findOne({ planId, active: true }).lean();
  return doc || null;
}

/**
 * Deterministic variant selection from hash(userId + experimentId) and variants[].trafficAllocation (0-100).
 * Returns the chosen variant object { planId, name }.
 */
function selectVariantByTraffic(userId, experimentId, variants) {
  if (!variants?.length) return null;
  const hash = crypto.createHash("md5").update(String(userId) + String(experimentId)).digest("hex");
  const bucket = parseInt(hash.substring(0, 8), 16) % 100;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += Number(v.trafficAllocation) || 0;
    if (bucket < cumulative) return v;
  }
  return variants[0];
}

/**
 * Assign user to an experiment cohort (idempotent). If already assigned, returns existing.
 * Updates User.assignedPlanVariants[targetTier] and User.abTestCohorts.
 * @param {string} userId - User _id
 * @param {string} experimentId - PricingExperiment.experimentId
 * @returns {Promise<{ planId: string, variant: string } | null>} Assigned planId and variant name, or null if experiment not found/not running
 */
export async function assignUserToExperimentCohort(userId, experimentId) {
  const experiment = await PricingExperiment.findOne({ experimentId, status: "running" }).lean();
  if (!experiment?.variants?.length) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  const existing = user.abTestCohorts?.find((c) => String(c.experimentId) === String(experimentId));
  if (existing) {
    return { planId: existing.planId, variant: existing.variant };
  }

  const chosen = selectVariantByTraffic(userId, experimentId, experiment.variants);
  if (!chosen) return null;

  const targetTier = experiment.targetTier || "pro";
  const update = {
    [`assignedPlanVariants.${targetTier}`]: chosen.planId,
    $push: {
      abTestCohorts: {
        experimentId,
        variant: chosen.name,
        assignedAt: new Date(),
        planId: chosen.planId,
      },
    },
    updatedAt: new Date(),
  };
  await User.findByIdAndUpdate(userId, update);
  return { planId: chosen.planId, variant: chosen.name };
}

/**
 * Assign a newly registered user to the same experiment variant they saw as anonymous (visitorId).
 * Call after signup so the price does not change.
 * @param {string} userId - New user _id
 * @param {string} visitorId - Same visitor ID used on the landing page (from signup body)
 */
export async function assignUserToExperimentFromVisitorId(userId, visitorId) {
  if (!userId || !visitorId || typeof visitorId !== "string") return;

  const running = await PricingExperiment.find({ status: "running" }).select("experimentId targetTier variants").lean();
  if (running.length === 0) return;

  const user = await User.findById(userId);
  if (!user) return;

  const abTestCohorts = [];
  const assignedPlanVariants = { ...(user.assignedPlanVariants && user.assignedPlanVariants.toObject ? user.assignedPlanVariants.toObject() : user.assignedPlanVariants) || {} };

  for (const exp of running) {
    if (!exp.variants?.length) continue;
    const targetTier = exp.targetTier || "pro";
    const chosen = selectVariantByTraffic(visitorId, exp.experimentId, exp.variants);
    if (!chosen) continue;
    assignedPlanVariants[targetTier] = chosen.planId;
    abTestCohorts.push({
      experimentId: exp.experimentId,
      variant: chosen.name,
      assignedAt: new Date(),
      planId: chosen.planId,
    });
  }

  await User.findByIdAndUpdate(userId, {
    $set: { assignedPlanVariants, updatedAt: new Date() },
    $push: { abTestCohorts: { $each: abTestCohorts } },
  });
}

/**
 * Get active plans for an anonymous visitor (same variant selection as users, keyed by visitorId).
 * Used so the landing page shows an experiment price and we can persist it at signup.
 * @param {string} visitorId - Stable anonymous ID (e.g. from X-Visitor-ID header)
 * @returns {Promise<Object[]>} Same shape as getActivePlans()
 */
export async function getActivePlansForVisitorId(visitorId) {
  if (!visitorId || typeof visitorId !== "string") return null;

  const running = await PricingExperiment.find({ status: "running" })
    .select("experimentId targetTier variants")
    .lean();
  if (running.length === 0) return null;

  const allActive = await PlanConfiguration.find({ active: true }).sort({ displayOrder: 1, tier: 1 }).lean();
  let freePlan = allActive.find((p) => p.tier === "free");
  let proPlanId = null;

  for (const exp of running) {
    if (!exp.variants?.length) continue;
    const chosen = selectVariantByTraffic(visitorId, exp.experimentId, exp.variants);
    if (chosen && (exp.targetTier || "pro") === "pro") {
      proPlanId = chosen.planId;
      break;
    }
  }
  if (!proPlanId) proPlanId = allActive.find((p) => p.tier === "pro")?.planId;
  let proPlan = proPlanId ? allActive.find((p) => p.planId === proPlanId) : allActive.find((p) => p.tier === "pro");
  if (proPlanId && !proPlan) {
    proPlan = await PlanConfiguration.findOne({ planId: proPlanId, active: true }).lean();
  }

  const docs = [freePlan, proPlan].filter(Boolean);
  if (docs.length === 0) return null;
  return ensurePlansIncludeEnterprise(docs.map(mapConfigToPublicPlan).filter(Boolean));
}

/**
 * Get active plans for the current user (Free + user's assigned Pro variant).
 * If userId is provided, ensures cohort assignment for running experiments and returns
 * plans list with only Free + assigned Pro. If no userId, returns getActivePlans() (anonymous).
 * @param {string | null | undefined} userId - Optional user _id
 * @returns {Promise<Object[]>} Same shape as getActivePlans()
 */
export async function getActivePlansForUser(userId) {
  if (!userId) return getActivePlans();

  const user = await User.findById(userId)
    .select("assignedPlanVariants abTestCohorts plan")
    .lean();
  if (!user) return getActivePlans();

  const running = await PricingExperiment.find({ status: "running" }).select("experimentId targetTier").lean();
  for (const exp of running) {
    await assignUserToExperimentCohort(userId, exp.experimentId);
  }

  // Reload user after possible cohort assignment
  const updated = await User.findById(userId).select("assignedPlanVariants").lean();
  const assigned = updated?.assignedPlanVariants || {};

  const allActive = await PlanConfiguration.find({ active: true }).sort({ displayOrder: 1, tier: 1 }).lean();
  let freePlan = allActive.find((p) => p.tier === "free");
  const proPlanId = assigned.pro || allActive.find((p) => p.tier === "pro")?.planId;
  let proPlan = proPlanId
    ? allActive.find((p) => p.planId === proPlanId)
    : allActive.find((p) => p.tier === "pro");
  if (proPlanId && !proPlan) {
    proPlan = await PlanConfiguration.findOne({ planId: proPlanId, active: true }).lean();
  }

  const docs = [freePlan, proPlan].filter(Boolean);
  if (docs.length === 0) return getDefaultPlans();
  return ensurePlansIncludeEnterprise(docs.map(mapConfigToPublicPlan).filter(Boolean));
}

/**
 * Get Stripe price ID for a plan and interval (monthly | annual).
 * Returns the priceId to pass to createCheckoutSession.
 */
export function getPriceIdForInterval(planConfig, interval) {
  if (!planConfig?.stripe) return null;
  if (interval === "annual" && planConfig.stripe.annualPriceId) {
    return planConfig.stripe.annualPriceId;
  }
  if (interval === "monthly" && planConfig.stripe.monthlyPriceId) {
    return planConfig.stripe.monthlyPriceId;
  }
  return planConfig.stripe.monthlyPriceId || planConfig.stripe.annualPriceId || null;
}

/**
 * Invalidate cache (e.g. after updating a plan in DB).
 */
export function invalidatePlanCache() {
  planListCache = null;
  planListCacheExpiry = 0;
}

/**
 * Default enterprise plan (same shape as mapConfigToPublicPlan). Always included in plans if DB has none.
 */
function getDefaultEnterprisePlan() {
  return {
    tier: "enterprise",
    displayName: "Enterprise",
    tagline: "Custom volume and SLA",
    pricing: null,
    limits: { retentionDays: 365, sessionCap: null, projectLimit: null },
    features: { recordings: true, aiTools: true, devTools: true },
    ui: {
      description: "Contact us for pricing",
      featureList: [
        "365 days data retention",
        "Custom session volume",
        "Full AI tools suite",
        "Unlimited projects",
        "Dedicated support",
      ],
    },
  };
}

/**
 * Ensure plans array includes an enterprise plan. Mutates and returns the same array or a new array with enterprise appended.
 */
function ensurePlansIncludeEnterprise(plans) {
  if (!Array.isArray(plans)) return plans;
  if (plans.some((p) => p && p.tier === "enterprise")) return plans;
  return [...plans, getDefaultEnterprisePlan()];
}

/**
 * Fallback when DB fails or is empty (matches previous static config).
 */
function getDefaultPlans() {
  return [
    {
      tier: "free",
      displayName: "Free",
      limits: { retentionDays: 30, sessionCap: 1000, projectLimit: 1 },
      features: { recordings: true, aiTools: false, devTools: false },
      ui: {
        featureList: [
          "30 days data retention",
          "1,000 sessions per month",
          "Session recordings",
          "1 project",
        ],
      },
    },
    {
      tier: "pro",
      displayName: "Pro",
      pricing: {
        monthly: { amount: 29, displayPrice: "$29/mo" },
        annual: {
          amount: 290,
          displayPrice: "$290/year",
          effectiveMonthly: "$24.17/mo",
          savingsText: "Save $58 (2 months free)",
        },
      },
      limits: { retentionDays: 90, sessionCap: 5000, projectLimit: null },
      features: { recordings: true, aiTools: true, devTools: true },
      ui: {
        badgeText: "Most Popular",
        featureList: [
          "90 days data retention",
          "5,000 sessions per month",
          "Full AI tools suite",
          "Unlimited projects",
          "Dev tools in replay",
        ],
      },
    },
    getDefaultEnterprisePlan(),
  ];
}
