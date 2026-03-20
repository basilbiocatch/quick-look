/**
 * Facebook / Meta Pixel helpers. Requires the base pixel script in index.html (fbq init + PageView).
 */

const trackFacebookCustomEvent = (eventName, eventData = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", eventName, eventData);
  }
};

const trackFacebookEvent = (eventName, eventData = {}) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", eventName, eventData);
  }
};

/** Track successful purchase (Meta standard Purchase event). */
export const trackFBPurchase = (paymentDetails = {}) => {
  trackFacebookEvent("Purchase", {
    content_name: `${paymentDetails.planType || "pro"} - ${paymentDetails.subscriptionType || "subscription"}`,
    content_type: "product",
    value: paymentDetails.amount ?? 0,
    currency: paymentDetails.currency || "USD",
    content_ids: [paymentDetails.planType || "pro"],
    num_items: 1,
  });
};

/** Track project created (custom event). */
export const trackFBCompleteProjctCreated = (userData = {}) => {
  trackFacebookCustomEvent("projectCreated", {
    content_name: "Project Created",
    content_category: "Registration",
    status: true,
    ...userData,
  });
};
