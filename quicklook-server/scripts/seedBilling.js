#!/usr/bin/env node
"use strict";

/**
 * Billing seed script (provider-agnostic).
 * Reads PAYMENT_PROVIDER (default: stripe), loads the billing adapter, then:
 * - Reads all JSON from config/plans/ and config/coupons/
 * - For each paid plan: if Stripe product/price IDs missing, creates via adapter and writes back to JSON (and optionally MongoDB)
 * - For each coupon: if Stripe IDs missing, creates via adapter and writes back to JSON (and optionally coupon_configurations)
 *
 * Usage (from quicklook-server):
 *   node scripts/seedBilling.js
 *   node scripts/seedBilling.js --dry-run
 *   node scripts/seedBilling.js --plans-only
 *   node scripts/seedBilling.js --coupons-only
 *
 * Requires: .env with QUICKLOOK_DB, STRIPE_SECRET_KEY (when provider is stripe). Optional: PAYMENT_PROVIDER (default stripe).
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { billingService } from "../src/billing/billingService.js";
import { quicklookConn } from "../src/db.js";
import PlanConfiguration from "../src/models/planConfigurationModel.js";
import CouponConfiguration from "../src/models/couponConfigurationModel.js";
import { invalidatePlanCache } from "../src/services/planConfigService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PLANS = path.join(ROOT, "config", "plans");
const CONFIG_COUPONS = path.join(ROOT, "config", "coupons");

const PROVIDER = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
const DRY_RUN = process.argv.includes("--dry-run");
const PLANS_ONLY = process.argv.includes("--plans-only");
const COUPONS_ONLY = process.argv.includes("--coupons-only");

function readJsonDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      path: path.join(dir, f),
      name: f,
      data: JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
    }));
}

function writeJson(filePath, data) {
  if (DRY_RUN) return;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function isPaidPlan(plan) {
  return plan.tier && plan.tier !== "free" && (plan.stripe || plan.pricing);
}

async function seedPlans() {
  const files = readJsonDir(CONFIG_PLANS);
  if (files.length === 0) {
    console.log("No plan files in config/plans/");
    return;
  }
  console.log(`✓ Found ${files.length} plan file(s)`);

  for (const { path: filePath, name, data: plan } of files) {
    if (!isPaidPlan(plan)) {
      console.log(`  Skip ${name} (free tier, no Stripe)`);
      if (!DRY_RUN && process.env.QUICKLOOK_DB) {
        const doc = planToDoc(plan);
        await PlanConfiguration.updateOne(
          { planId: doc.planId },
          { $set: { ...doc, updatedAt: new Date() } },
          { upsert: true }
        );
      }
      continue;
    }

    const stripe = plan.stripe || {};
    let productId = stripe.productId || null;
    let monthlyPriceId = stripe.monthlyPriceId || null;
    let annualPriceId = stripe.annualPriceId || null;
    const pricing = plan.pricing || {};
    const monthly = pricing.monthly || {};
    const annual = pricing.annual || {};

    if (!productId && !DRY_RUN) {
      const name = `QuickLook ${plan.displayName || plan.tier}`;
      const desc = (plan.ui && plan.ui.description) || "";
      const meta = { planId: plan.planId, tier: plan.tier || "" };
      const res = await billingService.createProduct(name, desc, meta);
      productId = res.productId;
      console.log(`  Created product: ${productId}`);
    } else if (productId) {
      console.log(`  Using product: ${productId}`);
    }

    if (productId && !monthlyPriceId && monthly.amount != null && !DRY_RUN) {
      const res = await billingService.createPrice({
        productId,
        amountCents: Math.round(Number(monthly.amount) * 100),
        currency: (monthly.currency || "usd").toLowerCase(),
        interval: "month",
        metadata: { planId: plan.planId, tier: plan.tier || "", interval: "monthly" },
      });
      monthlyPriceId = res.priceId;
      console.log(`  Created monthly price: ${monthlyPriceId}`);
    }

    if (productId && !annualPriceId && annual.amount != null && !DRY_RUN) {
      const res = await billingService.createPrice({
        productId,
        amountCents: Math.round(Number(annual.amount) * 100),
        currency: (annual.currency || "usd").toLowerCase(),
        interval: "year",
        metadata: { planId: plan.planId, tier: plan.tier || "", interval: "annual" },
      });
      annualPriceId = res.priceId;
      console.log(`  Created annual price: ${annualPriceId}`);
    }

    const updated = {
      ...plan,
      stripe: {
        ...plan.stripe,
        productId: productId || plan.stripe?.productId,
        monthlyPriceId: monthlyPriceId || plan.stripe?.monthlyPriceId,
        annualPriceId: annualPriceId || plan.stripe?.annualPriceId,
      },
    };
    writeJson(filePath, updated);

    if (!DRY_RUN && process.env.QUICKLOOK_DB) {
      const doc = planToDoc(updated);
      await PlanConfiguration.updateOne(
        { planId: doc.planId },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`  Saved to MongoDB`);
    }
  }

  if (!DRY_RUN && !COUPONS_ONLY) {
    try {
      invalidatePlanCache();
    } catch (_) {}
  }
}

function planToDoc(plan) {
  const stripe = plan.stripe || {};
  const pricing = plan.pricing || {};
  return {
    planId: plan.planId,
    tier: plan.tier,
    active: plan.active !== false,
    displayName: plan.displayName,
    tagline: plan.tagline || "",
    stripe: {
      productId: stripe.productId || undefined,
      monthlyPriceId: stripe.monthlyPriceId || undefined,
      annualPriceId: stripe.annualPriceId || undefined,
    },
    pricing: {
      monthly: plan.pricing?.monthly ? { amount: plan.pricing.monthly.amount, currency: plan.pricing.monthly.currency || "usd", displayPrice: plan.pricing.monthly.displayPrice } : undefined,
      annual: plan.pricing?.annual ? { amount: plan.pricing.annual.amount, currency: plan.pricing.annual.currency || "usd", displayPrice: plan.pricing.annual.displayPrice, effectiveMonthly: plan.pricing.annual.effectiveMonthly, savingsText: plan.pricing.annual.savingsText } : undefined,
      defaultInterval: plan.pricing?.defaultInterval || "annual",
    },
    limits: plan.limits || {},
    features: plan.features || {},
    ui: plan.ui || {},
  };
}

function couponToStripeSpec(coupon) {
  const type = coupon.type || "percentage";
  const discount = coupon.discount || {};
  const spec = { code: coupon.code || coupon.couponId };

  if (type === "percentage") {
    spec.percentOff = discount.percentOff != null ? Number(discount.percentOff) : 0;
    spec.duration = "once";
  } else if (type === "free_months") {
    spec.percentOff = 100;
    spec.duration = "repeating";
    spec.durationInMonths = Math.max(1, Number(discount.freeMonths) || 1);
  } else {
    spec.percentOff = discount.percentOff != null ? Number(discount.percentOff) : 0;
    spec.duration = "once";
  }
  return spec;
}

async function seedCoupons() {
  const files = readJsonDir(CONFIG_COUPONS);
  if (files.length === 0) {
    console.log("No coupon files in config/coupons/");
    return;
  }
  console.log(`✓ Found ${files.length} coupon file(s)`);

  for (const { path: filePath, data: coupon } of files) {
    const stripe = coupon.stripe || {};
    let couponId = stripe.couponId || null;
    let promoCodeId = stripe.promoCodeId || null;

    if ((!couponId || !promoCodeId) && !DRY_RUN) {
      const spec = couponToStripeSpec(coupon);
      const res = await billingService.createCoupon(spec);
      couponId = res.couponId;
      promoCodeId = res.promoCodeId || null;
      console.log(`  Created coupon: ${couponId}, promo: ${promoCodeId}`);
    }

    const updated = {
      ...coupon,
      stripe: {
        ...coupon.stripe,
        couponId: couponId || coupon.stripe?.couponId,
        promoCodeId: promoCodeId ?? coupon.stripe?.promoCodeId,
      },
    };
    writeJson(filePath, updated);

    if (!DRY_RUN && process.env.QUICKLOOK_DB) {
      const doc = couponToDoc(updated);
      await CouponConfiguration.updateOne(
        { couponId: doc.couponId },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log(`  Saved coupon ${doc.couponId} to MongoDB`);
    }
  }
}

function couponToDoc(coupon) {
  const restrictions = coupon.restrictions || {};
  const code = (coupon.code || "").trim();
  return {
    couponId: coupon.couponId,
    code,
    codeLower: code.toLowerCase(),
    active: coupon.active !== false,
    type: coupon.type || "percentage",
    discount: coupon.discount || {},
    stripe: {
      couponId: coupon.stripe?.couponId || undefined,
      promoCodeId: coupon.stripe?.promoCodeId || undefined,
    },
    restrictions: {
      firstTimeOnly: !!restrictions.firstTimeOnly,
      minAmount: restrictions.minAmount,
      expiresAt: restrictions.expiresAt ? new Date(restrictions.expiresAt) : undefined,
      maxRedemptions: restrictions.maxRedemptions,
      currentRedemptions: restrictions.currentRedemptions ?? 0,
    },
    displayName: coupon.displayName || "",
    description: coupon.description || "",
  };
}

async function main() {
  console.log("════════════════════════════════════════");
  console.log(`QuickLook Billing Seed (provider: ${PROVIDER})`);
  if (DRY_RUN) console.log("Mode: dry-run (no writes)");
  console.log("════════════════════════════════════════\n");

  if (PROVIDER !== "stripe") {
    console.error(`Unsupported PAYMENT_PROVIDER: ${PROVIDER}. Only stripe is implemented.`);
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY && !DRY_RUN) {
    console.error("STRIPE_SECRET_KEY is not set. Set it in .env or use --dry-run.");
    process.exit(1);
  }

  if (process.env.QUICKLOOK_DB && !DRY_RUN) {
    await quicklookConn.asPromise();
  }

  try {
    if (!COUPONS_ONLY) {
      console.log("Plans...");
      await seedPlans();
    }
    if (!PLANS_ONLY) {
      console.log("Coupons...");
      await seedCoupons();
    }
  } finally {
    if (quicklookConn.readyState === 1) await quicklookConn.close();
  }

  console.log("\nDone.");
  if (DRY_RUN) console.log("Run without --dry-run to create resources and write IDs.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
