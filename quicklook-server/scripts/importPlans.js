#!/usr/bin/env node
"use strict";

/**
 * Import plan configurations from config/plans/ JSON files into MongoDB and sync with Stripe.
 * - Reads JSON from config/plans/ (or --file for a single file)
 * - Validates schema (planId, tier required)
 * - For paid plans: if stripe productId / price IDs missing, creates them via billingService (Stripe) and writes back to JSON
 * - Upserts PlanConfiguration in MongoDB by planId
 * - Invalidates planConfigService cache after upserts
 *
 * Usage (from quicklook-server):
 *   node scripts/importPlans.js
 *   node scripts/importPlans.js --file config/plans/pro.json
 *   node scripts/importPlans.js --dry-run
 *   node scripts/importPlans.js --force-new-prices
 *
 * Requires: .env with QUICKLOOK_DB. For Stripe sync: STRIPE_SECRET_KEY. PAYMENT_PROVIDER defaults to stripe.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { billingService } from "../src/billing/billingService.js";
import { quicklookConn } from "../src/db.js";
import PlanConfiguration from "../src/models/planConfigurationModel.js";
import { invalidatePlanCache } from "../src/services/planConfigService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PLANS = path.join(ROOT, "config", "plans");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE_NEW_PRICES = process.argv.includes("--force-new-prices");

function getPlanFiles() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const singleFile = fileArg ? fileArg.replace("--file=", "").trim() : null;
  if (singleFile) {
    const resolved = path.isAbsolute(singleFile) ? singleFile : path.join(ROOT, singleFile);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }
    return [{ path: resolved, name: path.basename(resolved), data: JSON.parse(fs.readFileSync(resolved, "utf8")) }];
  }
  if (!fs.existsSync(CONFIG_PLANS)) {
    return [];
  }
  return fs
    .readdirSync(CONFIG_PLANS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const filePath = path.join(CONFIG_PLANS, f);
      return { path: filePath, name: f, data: JSON.parse(fs.readFileSync(filePath, "utf8")) };
    });
}

function validatePlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Plan must be an object");
  if (!plan.planId || typeof plan.planId !== "string") throw new Error("planId is required");
  if (!plan.tier || typeof plan.tier !== "string") throw new Error("tier is required");
  if (plan.tier !== "free" && plan.pricing && !plan.pricing.monthly && !plan.pricing.annual) {
    console.warn(`  Warning: paid plan ${plan.planId} has no pricing.monthly or pricing.annual`);
  }
  return true;
}

function planToDoc(plan) {
  const stripe = plan.stripe || {};
  const pricing = plan.pricing || {};
  const doc = {
    planId: plan.planId,
    tier: plan.tier,
    active: plan.active !== false,
    displayName: plan.displayName || plan.tier,
    tagline: plan.tagline || "",
    displayOrder: typeof plan.displayOrder === "number" ? plan.displayOrder : 0,
    stripe: {
      productId: stripe.productId || undefined,
      monthlyPriceId: stripe.monthlyPriceId || undefined,
      annualPriceId: stripe.annualPriceId || undefined,
    },
    pricing: {
      monthly: plan.pricing?.monthly
        ? {
            amount: plan.pricing.monthly.amount,
            currency: plan.pricing.monthly.currency || "usd",
            displayPrice: plan.pricing.monthly.displayPrice,
          }
        : undefined,
      annual: plan.pricing?.annual
        ? {
            amount: plan.pricing.annual.amount,
            currency: plan.pricing.annual.currency || "usd",
            displayPrice: plan.pricing.annual.displayPrice,
            effectiveMonthly: plan.pricing.annual.effectiveMonthly,
            savingsText: plan.pricing.annual.savingsText,
          }
        : undefined,
      defaultInterval: plan.pricing?.defaultInterval || "annual",
    },
    limits: plan.limits || {},
    features: plan.features || {},
    ui: plan.ui || {},
  };
  return doc;
}

function isPaidPlan(plan) {
  return plan.tier && plan.tier !== "free" && (plan.stripe != null || plan.pricing);
}

async function ensureStripeIds(plan, filePath) {
  const updated = { ...plan };
  const stripe = { ...(plan.stripe || {}) };
  const pricing = plan.pricing || {};
  const monthly = pricing.monthly || {};
  const annual = pricing.annual || {};
  let productId = stripe.productId || null;
  let monthlyPriceId = stripe.monthlyPriceId || null;
  let annualPriceId = stripe.annualPriceId || null;

  if (!productId && !DRY_RUN) {
    const name = `QuickLook ${plan.displayName || plan.tier}`;
    const desc = (plan.ui && plan.ui.description) || "";
    const meta = { planId: plan.planId, tier: plan.tier || "" };
    const res = await billingService.createProduct(name, desc, meta);
    productId = res.productId;
    stripe.productId = productId;
    console.log(`  → Created Stripe product: ${productId}`);
  } else if (productId) {
    console.log(`  → Using product: ${productId}`);
  }

  if (productId && monthly.amount != null && (FORCE_NEW_PRICES || !monthlyPriceId)) {
    if (!DRY_RUN) {
      const res = await billingService.createPrice({
        productId,
        amountCents: Math.round(Number(monthly.amount) * 100),
        currency: (monthly.currency || "usd").toLowerCase(),
        interval: "month",
        metadata: { planId: plan.planId, tier: plan.tier || "", interval: "monthly" },
      });
      monthlyPriceId = res.priceId;
      stripe.monthlyPriceId = monthlyPriceId;
      console.log(`  → Created monthly price: ${monthlyPriceId}`);
    }
  }

  if (productId && annual.amount != null && (FORCE_NEW_PRICES || !annualPriceId)) {
    if (!DRY_RUN) {
      const res = await billingService.createPrice({
        productId,
        amountCents: Math.round(Number(annual.amount) * 100),
        currency: (annual.currency || "usd").toLowerCase(),
        interval: "year",
        metadata: { planId: plan.planId, tier: plan.tier || "", interval: "annual" },
      });
      annualPriceId = res.priceId;
      stripe.annualPriceId = annualPriceId;
      console.log(`  → Created annual price: ${annualPriceId}`);
    }
  }

  updated.stripe = stripe;
  if (!DRY_RUN && (stripe.productId || stripe.monthlyPriceId || stripe.annualPriceId)) {
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
    console.log(`  → Wrote IDs back to ${path.basename(filePath)}`);
  }
  return updated;
}

async function main() {
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  const files = getPlanFiles();
  if (files.length === 0) {
    console.log("No plan files found.");
    process.exit(0);
  }

  await quicklookConn.asPromise();

  let imported = 0;
  for (const { path: filePath, name, data: plan } of files) {
    try {
      validatePlan(plan);
    } catch (err) {
      console.error(`✗ ${name}: ${err.message}`);
      continue;
    }

    console.log(`✓ Loaded ${name}`);

    if (plan.tier === "free") {
      console.log("  → Free tier (no Stripe product needed)");
      if (!DRY_RUN) {
        const doc = planToDoc(plan);
        await PlanConfiguration.updateOne(
          { planId: doc.planId },
          { $set: { ...doc, updatedAt: new Date() } },
          { upsert: true }
        );
        console.log("  → Saved to database");
      }
      imported++;
    } else if (isPaidPlan(plan)) {
      const updated = await ensureStripeIds(plan, filePath);
      if (!DRY_RUN) {
        const doc = planToDoc(updated);
        await PlanConfiguration.updateOne(
          { planId: doc.planId },
          { $set: { ...doc, updatedAt: new Date() } },
          { upsert: true }
        );
        console.log("  → Saved to database");
      }
      imported++;
    } else {
      if (!DRY_RUN) {
        const doc = planToDoc(plan);
        await PlanConfiguration.updateOne(
          { planId: doc.planId },
          { $set: { ...doc, updatedAt: new Date() } },
          { upsert: true }
        );
        console.log("  → Saved to database");
      }
      imported++;
    }
  }

  if (!DRY_RUN && imported > 0) {
    try {
      invalidatePlanCache();
    } catch (_) {}
  }

  console.log(`\nSuccessfully imported ${imported} plan(s)`);
  if (DRY_RUN) console.log("(dry-run: no DB or file writes)");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
