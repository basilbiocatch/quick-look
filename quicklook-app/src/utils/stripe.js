import { loadStripe } from "@stripe/stripe-js";
import { getBillingConfig } from "../api/subscriptionApi.js";

let stripePromise = null;

export async function getStripe() {
  if (stripePromise) return stripePromise;
  try {
    const res = await getBillingConfig();
    const key = res.data?.publishableKey;
    if (key) stripePromise = loadStripe(key);
  } catch {
    stripePromise = null;
  }
  return stripePromise;
}
