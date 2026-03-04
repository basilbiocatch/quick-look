"use strict";

/**
 * Provider-agnostic billing interface. All amounts in cents.
 * Normalized status values: active, past_due, canceled, trialing, incomplete.
 * Implementations: stripeAdapter, (later) recurlyAdapter.
 */

/**
 * @typedef {Object} CreateCustomerResult
 * @property {string} customerId
 */

/**
 * @typedef {Object} CreateCheckoutSessionParams
 * @property {string} customerId
 * @property {string} priceId
 * @property {string} [successUrl]
 * @property {string} [cancelUrl]
 * @property {string} [promoCodeId]
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} CreateCheckoutSessionResult
 * @property {string} redirectUrl
 * @property {string} sessionId
 */

/**
 * @typedef {Object} CreateBillingPortalSessionResult
 * @property {string} redirectUrl
 */

/**
 * @typedef {Object} GetSubscriptionResult
 * @property {string} status
 * @property {string} [priceId]
 * @property {string} [interval]
 * @property {Date} [currentPeriodEnd]
 * @property {boolean} [cancelAtPeriodEnd]
 */

/**
 * @typedef {Object} CancelSubscriptionResult
 * @property {boolean} canceled
 * @property {Date} [currentPeriodEnd]
 */

/**
 * @typedef {Object} InvoiceItem
 * @property {string} id
 * @property {number} amount
 * @property {string} status
 * @property {Date} createdAt
 * @property {string} [invoicePdfUrl]
 */

/**
 * @typedef {Object} UpcomingInvoiceResult
 * @property {number} amount
 * @property {Date} nextPaymentAt
 */

/**
 * @typedef {Object} ClientConfigResult
 * @property {string} [publishableKey]
 * @property {string} provider
 * @property {string} [checkoutMethod]
 */

/**
 * @typedef {Object} NormalizedWebhookEvent
 * @property {string} type
 * @property {string} [subscriptionId]
 * @property {string} [customerId]
 * @property {string} [status]
 * @property {string} [priceId]
 * @property {string} [interval]
 * @property {Date} [currentPeriodEnd]
 * @property {boolean} [cancelAtPeriodEnd]
 */

/**
 * @typedef {Object} HandleWebhookResult
 * @property {NormalizedWebhookEvent[]} events
 */

/**
 * @typedef {Object} CreatePriceParams
 * @property {string} productId
 * @property {number} amountCents
 * @property {string} currency
 * @property {string} interval - 'month' | 'year'
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} CreateCouponSpec
 * @property {string} [code]
 * @property {number} [percentOff]
 * @property {number} [durationInMonths]
 * @property {string} [duration] - 'forever' | 'once' | 'repeating'
 */

/**
 * @typedef {Object} CreateCouponResult
 * @property {string} couponId
 * @property {string} [promoCodeId]
 */

/**
 * @typedef {Object} ValidatePromoCodeResult
 * @property {boolean} valid
 * @property {Object} [discount]
 * @property {string} [error]
 */

/**
 * Billing provider contract. Implement in adapters (e.g. stripeAdapter).
 * @interface
 */
export const providerInterface = {
  createCustomer: /** @type {(email: string, name?: string) => Promise<CreateCustomerResult>} */ (async () => ({ customerId: "" })),
  createCheckoutSession: /** @type {(params: CreateCheckoutSessionParams) => Promise<CreateCheckoutSessionResult>} */ (async () => ({ redirectUrl: "", sessionId: "" })),
  createBillingPortalSession: /** @type {(customerId: string, returnUrl: string) => Promise<CreateBillingPortalSessionResult>} */ (async () => ({ redirectUrl: "" })),
  getSubscription: /** @type {(subscriptionId: string) => Promise<GetSubscriptionResult | null>} */ (async () => null),
  cancelSubscription: /** @type {(subscriptionId: string) => Promise<CancelSubscriptionResult>} */ (async () => ({ canceled: false })),
  getInvoices: /** @type {(customerId: string, limit?: number) => Promise<InvoiceItem[]>} */ (async () => []),
  getUpcomingInvoice: /** @type {(customerId: string) => Promise<UpcomingInvoiceResult | null>} */ (async () => null),
  getClientConfig: /** @type {() => Promise<ClientConfigResult>} */ (async () => ({ provider: "" })),
  handleWebhook: /** @type {(rawBody: string | Buffer, signature: string, headers: Object) => Promise<HandleWebhookResult>} */ (async () => ({ events: [] })),
  createProduct: /** @type {(name: string, description?: string, metadata?: Object) => Promise<{ productId: string }>} */ (async () => ({ productId: "" })),
  createPrice: /** @type {(params: CreatePriceParams) => Promise<{ priceId: string }>} */ (async () => ({ priceId: "" })),
  createCoupon: /** @type {(spec: CreateCouponSpec) => Promise<CreateCouponResult>} */ (async () => ({ couponId: "", promoCodeId: "" })),
  validatePromoCode: /** @type {(code: string) => Promise<ValidatePromoCodeResult>} */ (async () => ({ valid: false })),
};
