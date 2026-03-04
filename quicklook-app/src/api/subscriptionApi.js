import axios from "axios";
import { getAuthToken } from "./authApi.js";
import { getOrCreateDeviceId } from "./quicklookApi.js";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? apiBase.replace(/\/$/, "") : "";

const api = axios.create({
  baseURL: baseURL || undefined,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const createCheckoutSession = (body) =>
  api.post("/api/subscriptions/create-checkout", body);
export const validateCoupon = (code) =>
  api.post("/api/subscriptions/validate-coupon", { code });
export const getSubscriptionStatus = () => api.get("/api/subscriptions/status");
export const createBillingPortal = (returnUrl) =>
  api.post("/api/subscriptions/create-portal", { returnUrl });
export const getInvoices = (params) => api.get("/api/subscriptions/invoices", { params });
export const cancelSubscription = () => api.post("/api/subscriptions/cancel");

/**
 * Fetch plans config. When not logged in, uses QL device ID so the landing page shows
 * a consistent experiment price (same device = same price, and preserved after signup).
 */
export const getPlansConfig = async () => {
  const token = getAuthToken();
  if (!token) {
    const deviceId = await getOrCreateDeviceId();
    if (deviceId) {
      return api.get("/api/config/plans", { headers: { "X-Visitor-ID": deviceId } });
    }
  }
  return api.get("/api/config/plans");
};
export const getBillingConfig = () => api.get("/api/config/billing");
export const validateCouponPublic = (code) =>
  api.get("/api/config/coupons/validate", { params: { code } });
