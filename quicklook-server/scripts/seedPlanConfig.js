#!/usr/bin/env node
"use strict";

/**
 * Seed plan configurations into MongoDB (plan_configurations collection).
 * Upserts default Free and Pro plans. If STRIPE_SECRET_KEY is set, creates
 * Stripe product and prices for Pro and writes the IDs into the Pro plan document.
 * Price IDs are read from the DB at runtime; no STRIPE_PRO_* env vars needed.
 *
 * Usage (from quicklook-server):
 *   node scripts/seedPlanConfig.js
 *
 * Requires .env: QUICKLOOK_DB. Optional: STRIPE_SECRET_KEY (to create/find Stripe prices and save IDs to DB).
 */

import "dotenv/config";
import { quicklookConn } from "../src/db.js";
import PlanConfiguration from "../src/models/planConfigurationModel.js";
import { invalidatePlanCache } from "../src/services/planConfigService.js";

const PRO_MONTHLY_CENTS = 2900; // $29/mo
const PRO_ANNUAL_CENTS = 29000; // $290/year
const PRODUCT_METADATA = { quicklook_plan: "pro" };

const DEFAULT_FREE = {
  planId: "free_v1",
  tier: "free",
  active: true,
  displayName: "Free",
  tagline: "Perfect to get started",
  displayOrder: 0,
  limits: { retentionDays: 30, sessionCap: 1000, projectLimit: 1 },
  features: { recordings: true, aiTools: false, devTools: false },
  ui: {
    description: "Get started with session recording",
    featureList: [
      "30 days data retention",
      "1,000 sessions per month",
      "Session recordings",
      "1 project",
    ],
  },
};

const DEFAULT_PRO = {
  planId: "pro_standard_v1",
  tier: "pro",
  active: true,
  displayName: "Pro",
  tagline: "For growing teams",
  displayOrder: 1,
  stripe: {}, // filled by Stripe step if key present
  pricing: {
    monthly: {
      amount: 29,
      currency: "usd",
      displayPrice: "$29/mo",
    },
    annual: {
      amount: 290,
      currency: "usd",
      displayPrice: "$290/year",
      effectiveMonthly: "$24.17/mo",
      savingsText: "Save $58 (2 months free)",
    },
    defaultInterval: "annual",
  },
  limits: { retentionDays: 90, sessionCap: 5000, projectLimit: null },
  features: { recordings: true, aiTools: true, devTools: true },
  ui: {
    badgeText: "Most Popular",
    description: "Unlock AI-powered insights and analytics",
    featureList: [
      "90 days data retention",
      "5,000 sessions per month",
      "Full AI tools suite",
      "Unlimited projects",
      "Dev tools in replay",
    ],
  },
};

async function upsertPlan(planId, doc) {
  const now = new Date();
  await PlanConfiguration.updateOne(
    { planId },
    {
      $set: {
        ...doc,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
}

async function ensureStripeIdsForPro() {
  const stripeKey = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!stripeKey) {
    console.log("STRIPE_SECRET_KEY not set; skipping Stripe product/price creation. Pro plan will have no price IDs until you run with Stripe configured or add them manually to the plan in DB.");
    return;
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

  const pro = await PlanConfiguration.findOne({ tier: "pro", active: true }).lean();
  if (!pro) {
    console.log("No Pro plan found in DB; skipping Stripe.");
    return;
  }

  const needsMonthly = !pro.stripe?.monthlyPriceId;
  const needsAnnual = !pro.stripe?.annualPriceId;
  if (!needsMonthly && !needsAnnual) {
    console.log("Pro plan already has Stripe price IDs in DB.");
    return;
  }

  let productId = pro.stripe?.productId;
  if (!productId) {
    const existingProducts = await stripe.products.list({ limit: 100 });
    const existing = existingProducts.data.find(
      (p) => p.metadata && p.metadata.quicklook_plan === "pro"
    );
    if (existing) {
      productId = existing.id;
      console.log("Using existing Stripe product:", productId);
    } else {
      const product = await stripe.products.create({
        name: "Quicklook Pro",
        description: "AI insights, 5,000 sessions/month, 90-day retention, unlimited projects",
        metadata: PRODUCT_METADATA,
      });
      productId = product.id;
      console.log("Created Stripe product:", productId);
    }
  }

  let monthlyPriceId = pro.stripe?.monthlyPriceId;
  let annualPriceId = pro.stripe?.annualPriceId;

  if (!monthlyPriceId) {
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 10,
    });
    const monthly = existingPrices.data.find(
      (p) =>
        p.recurring?.interval === "month" && p.unit_amount === PRO_MONTHLY_CENTS
    );
    if (monthly) {
      monthlyPriceId = monthly.id;
      console.log("Using existing monthly price:", monthlyPriceId);
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: PRO_MONTHLY_CENTS,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: PRODUCT_METADATA,
      });
      monthlyPriceId = price.id;
      console.log("Created Stripe monthly price:", monthlyPriceId);
    }
  }

  if (!annualPriceId) {
    const existingPrices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 10,
    });
    const annual = existingPrices.data.find(
      (p) =>
        p.recurring?.interval === "year" && p.unit_amount === PRO_ANNUAL_CENTS
    );
    if (annual) {
      annualPriceId = annual.id;
      console.log("Using existing annual price:", annualPriceId);
    } else {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: PRO_ANNUAL_CENTS,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: PRODUCT_METADATA,
      });
      annualPriceId = price.id;
      console.log("Created Stripe annual price:", annualPriceId);
    }
  }

  await PlanConfiguration.updateOne(
    { planId: pro.planId },
    {
      $set: {
        "stripe.productId": productId,
        "stripe.monthlyPriceId": monthlyPriceId,
        "stripe.annualPriceId": annualPriceId,
        updatedAt: new Date(),
      },
    }
  );
  console.log("Updated Pro plan in MongoDB with Stripe IDs.");
}

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  await quicklookConn.asPromise();

  console.log("Upserting Free plan...");
  await upsertPlan(DEFAULT_FREE.planId, DEFAULT_FREE);

  console.log("Upserting Pro plan...");
  await upsertPlan(DEFAULT_PRO.planId, DEFAULT_PRO);

  await ensureStripeIdsForPro();

  try {
    invalidatePlanCache();
  } catch (_) {}

  console.log("Done. Plans are in MongoDB (plan_configurations). Price IDs come from DB, not env.");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
