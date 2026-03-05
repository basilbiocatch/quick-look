"use strict";

const PROVIDER = (process.env.PAYMENT_PROVIDER || "stripe").toLowerCase();
let adapter = null;

async function getAdapter() {
  if (adapter) return adapter;
  if (PROVIDER === "stripe") {
    const { default: stripeAdapter } = await import("./adapters/stripeAdapter.js");
    adapter = stripeAdapter;
    return adapter;
  }
  throw new Error(`Unsupported PAYMENT_PROVIDER: ${PROVIDER}`);
}

export const billingService = {
  async createCustomer(email, name) {
    const a = await getAdapter();
    return a.createCustomer(email, name);
  },

  async createCheckoutSession(params) {
    const a = await getAdapter();
    return a.createCheckoutSession(params);
  },

  async createBillingPortalSession(customerId, returnUrl) {
    const a = await getAdapter();
    return a.createBillingPortalSession(customerId, returnUrl);
  },

  async getCheckoutSession(sessionId) {
    const a = await getAdapter();
    return a.getCheckoutSession(sessionId);
  },

  async getActiveSubscriptionIdForCustomer(customerId) {
    const a = await getAdapter();
    return a.getActiveSubscriptionIdForCustomer(customerId);
  },

  async getSubscription(subscriptionId) {
    const a = await getAdapter();
    return a.getSubscription(subscriptionId);
  },

  async cancelSubscription(subscriptionId) {
    const a = await getAdapter();
    return a.cancelSubscription(subscriptionId);
  },

  async getInvoices(customerId, limit = 10) {
    const a = await getAdapter();
    return a.getInvoices(customerId, limit);
  },

  async getUpcomingInvoice(customerId) {
    const a = await getAdapter();
    return a.getUpcomingInvoice(customerId);
  },

  async getClientConfig() {
    const a = await getAdapter();
    return a.getClientConfig();
  },

  async handleWebhook(rawBody, signature, headers) {
    const a = await getAdapter();
    return a.handleWebhook(rawBody, signature, headers);
  },

  async createProduct(name, description, metadata) {
    const a = await getAdapter();
    return a.createProduct(name, description, metadata);
  },

  async createPrice(params) {
    const a = await getAdapter();
    return a.createPrice(params);
  },

  async createCoupon(spec) {
    const a = await getAdapter();
    return a.createCoupon(spec);
  },

  async createPromoCode(stripeCouponId, code) {
    const a = await getAdapter();
    return a.createPromoCode(stripeCouponId, code);
  },

  async validatePromoCode(code) {
    const a = await getAdapter();
    return a.validatePromoCode(code);
  },
};
