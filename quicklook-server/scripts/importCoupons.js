#!/usr/bin/env node
"use strict";

/**
 * Import coupon configurations from config/coupons/ JSON files into MongoDB and sync with Stripe.
 * - Reads all JSON from config/coupons/
 * - For each coupon: if stripe.couponId/promoCodeId missing, creates in Stripe via billingService.createCoupon and writes back to JSON
 * - Upserts CouponConfiguration in MongoDB by couponId
 *
 * Usage (from quicklook-server):
 *   node scripts/importCoupons.js
 *   node scripts/importCoupons.js --dry-run
 *
 * Requires: .env with QUICKLOOK_DB. For Stripe: STRIPE_SECRET_KEY. PAYMENT_PROVIDER defaults to stripe.
 * Note: couponService is not used here; this script uses billingService (Stripe adapter) for seed/import only.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { billingService } from "../src/billing/billingService.js";
import { quicklookConn } from "../src/db.js";
import CouponConfiguration from "../src/models/couponConfigurationModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_COUPONS = path.join(ROOT, "config", "coupons");

const DRY_RUN = process.argv.includes("--dry-run");

function readCouponFiles() {
  if (!fs.existsSync(CONFIG_COUPONS)) return [];
  return fs
    .readdirSync(CONFIG_COUPONS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const filePath = path.join(CONFIG_COUPONS, f);
      return { path: filePath, name: f, data: JSON.parse(fs.readFileSync(filePath, "utf8")) };
    });
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

function couponToDoc(coupon) {
  const restrictions = coupon.restrictions || {};
  return {
    couponId: coupon.couponId,
    code: (coupon.code || "").trim(),
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
  if (!process.env.QUICKLOOK_DB) {
    console.error("QUICKLOOK_DB is not set. Set it in .env and run again.");
    process.exit(1);
  }

  const files = readCouponFiles();
  if (files.length === 0) {
    console.log("No coupon files in config/coupons/.");
    process.exit(0);
  }

  const provider = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
  if (provider !== "stripe" && !DRY_RUN) {
    console.error(`Unsupported PAYMENT_PROVIDER: ${provider}. Only stripe is implemented.`);
    process.exit(1);
  }

  if (!process.env.STRIPE_SECRET_KEY && !DRY_RUN) {
    console.error("STRIPE_SECRET_KEY is not set. Set it in .env or use --dry-run.");
    process.exit(1);
  }

  await quicklookConn.asPromise();

  let imported = 0;
  for (const { path: filePath, name, data: coupon } of files) {
    if (!coupon.couponId || !coupon.code) {
      console.error(`✗ ${name}: couponId and code are required`);
      continue;
    }

    console.log(`✓ Loaded ${name} (${coupon.code})`);

    const stripe = coupon.stripe || {};
    let couponId = stripe.couponId || null;
    let promoCodeId = stripe.promoCodeId || null;

    if ((!couponId || !promoCodeId) && !DRY_RUN) {
      const spec = couponToStripeSpec(coupon);
      const res = await billingService.createCoupon(spec);
      couponId = res.couponId;
      promoCodeId = res.promoCodeId || null;
      console.log(`  → Created Stripe coupon: ${couponId}, promo: ${promoCodeId}`);
    }

    const updated = {
      ...coupon,
      stripe: {
        ...coupon.stripe,
        couponId: couponId || coupon.stripe?.couponId,
        promoCodeId: promoCodeId ?? coupon.stripe?.promoCodeId,
      },
    };

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf8");
      console.log(`  → Wrote IDs back to ${name}`);

      const doc = couponToDoc(updated);
      await CouponConfiguration.updateOne(
        { couponId: doc.couponId },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true }
      );
      console.log("  → Saved to database");
    }

    imported++;
  }

  console.log(`\nSuccessfully imported ${imported} coupon(s)`);
  if (DRY_RUN) console.log("(dry-run: no Stripe creation, no file or DB writes)");
  await quicklookConn.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
