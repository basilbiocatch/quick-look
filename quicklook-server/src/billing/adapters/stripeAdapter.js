"use strict";

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
const appUrl = process.env.APP_URL || "http://localhost:5173";

const stripe = secretKey ? new Stripe(secretKey, { apiVersion: "2024-11-20.acacia" }) : null;

function normalizeStatus(stripeStatus) {
  if (!stripeStatus) return "incomplete";
  const s = String(stripeStatus).toLowerCase();
  if (["active", "trialing"].includes(s)) return s;
  if (["past_due", "unpaid"].includes(s)) return "past_due";
  if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(s)) return "canceled";
  return "incomplete";
}

const stripeAdapter = {
  async createCustomer(email, name) {
    if (!stripe) throw new Error("Stripe not configured");
    const customer = await stripe.customers.create({ email, name: name || undefined });
    return { customerId: customer.id };
  },

  async createCheckoutSession(params) {
    if (!stripe) throw new Error("Stripe not configured");
    const sessionParams = {
      customer: params.customerId,
      mode: "subscription",
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl || `${appUrl}/account/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl || `${appUrl}/account/payment-cancel`,
      subscription_data: {},
      metadata: params.metadata || {},
    };
    if (params.promoCodeId) {
      sessionParams.discounts = [{ promotion_code: params.promoCodeId }];
    }
    const session = await stripe.checkout.sessions.create(sessionParams);
    return { redirectUrl: session.url || "", sessionId: session.id };
  },

  async createBillingPortalSession(customerId, returnUrl) {
    if (!stripe) throw new Error("Stripe not configured");
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || appUrl,
    });
    return { redirectUrl: session.url };
  },

  async getCheckoutSession(sessionId) {
    if (!stripe || !sessionId) return null;
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      return {
        customerId: customerId || null,
        subscriptionId: subId || null,
        metadata: session.metadata || {},
        paymentStatus: session.payment_status || "unpaid",
      };
    } catch (err) {
      if (err.code === "resource_missing_deleted") return null;
      throw err;
    }
  },

  /** List active/trialing subscriptions for a customer; returns first one or null. */
  async getActiveSubscriptionIdForCustomer(customerId) {
    if (!stripe || !customerId) return null;
    try {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });
      const trialing = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      const sub = list.data[0] || trialing.data[0];
      return sub ? sub.id : null;
    } catch (err) {
      if (err.code === "resource_missing_deleted") return null;
      throw err;
    }
  },

  async getSubscription(subscriptionId) {
    if (!stripe) return null;
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
      const item = sub.items?.data?.[0];
      const price = item?.price;
      const interval = price?.recurring?.interval === "year" ? "annual" : "monthly";
      return {
        status: normalizeStatus(sub.status),
        priceId: price?.id || sub.items?.data?.[0]?.price?.id,
        interval,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
      };
    } catch (err) {
      if (err.code === "resource_missing_deleted") return null;
      throw err;
    }
  },

  async cancelSubscription(subscriptionId) {
    if (!stripe) throw new Error("Stripe not configured");
    const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    return {
      canceled: true,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
    };
  },

  async getInvoices(customerId, limit = 10) {
    if (!stripe) return [];
    const list = await stripe.invoices.list({ customer: customerId, limit });
    return list.data.map((inv) => ({
      id: inv.id,
      amount: inv.amount_paid ?? inv.amount_due ?? 0,
      status: inv.status || "draft",
      createdAt: inv.created ? new Date(inv.created * 1000) : new Date(),
      invoicePdfUrl: inv.invoice_pdf || undefined,
    }));
  },

  async getUpcomingInvoice(customerId) {
    if (!stripe) return null;
    try {
      const inv = await stripe.invoices.retrieveUpcoming({ customer: customerId });
      return {
        amount: inv.amount_due ?? 0,
        nextPaymentAt: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000) : undefined,
      };
    } catch (err) {
      if (err.code === "invoice_upcoming_none") return null;
      throw err;
    }
  },

  async getClientConfig() {
    return {
      publishableKey: publishableKey || undefined,
      provider: "stripe",
      checkoutMethod: "redirect",
    };
  },

  async handleWebhook(rawBody, signature, headers) {
    if (!stripe || !webhookSecret) return { events: [] };
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    const events = [];
    const push = (type, payload) => events.push({ type, ...payload });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
          const item = sub.items?.data?.[0];
          const price = item?.price;
          const interval = price?.recurring?.interval === "year" ? "annual" : "monthly";
          push("subscription.created", {
            subscriptionId: sub.id,
            customerId: sub.customer,
            status: normalizeStatus(sub.status),
            priceId: price?.id,
            interval,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
            cancelAtPeriodEnd: !!sub.cancel_at_period_end,
          });
        }
        push("checkout.completed", {
          customerId: session.customer,
          subscriptionId: subId,
          metadata: session.metadata || {},
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const item = sub.items?.data?.[0];
        const price = item?.price;
        const interval = price?.recurring?.interval === "year" ? "annual" : "monthly";
        push("subscription.updated", {
          subscriptionId: sub.id,
          customerId: sub.customer,
          status: normalizeStatus(sub.status),
          priceId: price?.id,
          interval,
          currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
          cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        push("subscription.canceled", {
          subscriptionId: sub.id,
          customerId: sub.customer,
          status: "canceled",
        });
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object;
        push("invoice.paid", {
          subscriptionId: inv.subscription,
          customerId: inv.customer,
        });
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        push("invoice.failed", {
          subscriptionId: inv.subscription,
          customerId: inv.customer,
        });
        break;
      }
      default:
        break;
    }
    return { events };
  },

  async createProduct(name, description, metadata) {
    if (!stripe) throw new Error("Stripe not configured");
    const product = await stripe.products.create({
      name,
      description: description || undefined,
      metadata: metadata || {},
    });
    return { productId: product.id };
  },

  async createPrice(params) {
    if (!stripe) throw new Error("Stripe not configured");
    const price = await stripe.prices.create({
      product: params.productId,
      unit_amount: params.amountCents,
      currency: (params.currency || "usd").toLowerCase(),
      recurring: { interval: params.interval === "year" ? "year" : "month" },
      metadata: params.metadata || {},
    });
    return { priceId: price.id };
  },

  async createCoupon(spec) {
    if (!stripe) throw new Error("Stripe not configured");
    const couponParams = {};
    if (spec.percentOff != null) couponParams.percent_off = spec.percentOff;
    if (spec.duration === "forever" || spec.duration === "once") couponParams.duration = spec.duration;
    if (spec.duration === "repeating" && spec.durationInMonths) couponParams.duration = "repeating";
    if (spec.durationInMonths) couponParams.duration_in_months = spec.durationInMonths;
    const coupon = await stripe.coupons.create(couponParams);
    let promoCodeId = null;
    if (spec.code) {
      const promo = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code: spec.code,
      });
      promoCodeId = promo.id;
    }
    return { couponId: coupon.id, promoCodeId: promoCodeId || undefined };
  },

  async createPromoCode(stripeCouponId, code) {
    if (!stripe) throw new Error("Stripe not configured");
    const promo = await stripe.promotionCodes.create({
      coupon: stripeCouponId,
      code: code || undefined,
    });
    return { promoCodeId: promo.id };
  },

  async validatePromoCode(code) {
    if (!stripe) return { valid: false, error: "Stripe not configured" };
    try {
      const list = await stripe.promotionCodes.list({ code, active: true });
      const promo = list.data[0];
      if (!promo) return { valid: false, error: "Invalid or expired code" };
      const discount = promo.coupon
        ? { percentOff: promo.coupon.percent_off, duration: promo.coupon.duration }
        : undefined;
      return { valid: true, discount, promoCodeId: promo.id };
    } catch (err) {
      return { valid: false, error: err.message || "Invalid code" };
    }
  },
};

export default stripeAdapter;
