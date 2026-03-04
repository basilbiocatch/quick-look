"use strict";

import { billingService } from "../billing/billingService.js";
import { handleSubscriptionEvents } from "../billing/subscriptionEventHandler.js";
import logger from "../configs/loggingConfig.js";

/**
 * Stripe webhook endpoint. Must receive raw body (use express.raw() for this route).
 */
export async function stripeBillingWebhook(req, res) {
  const rawBody = req.body;
  const signature = req.headers["stripe-signature"] || "";
  const headers = req.headers;
  if (!rawBody || (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody))) {
    return res.status(400).send("Missing or invalid body");
  }
  try {
    const { events } = await billingService.handleWebhook(rawBody, signature, headers);
    if (events.length > 0) {
      await handleSubscriptionEvents(events);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error("stripeBillingWebhook", { error: err.message });
    return res.status(400).send(err.message || "Webhook error");
  }
}
