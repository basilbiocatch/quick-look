import axios from "axios";
import { getAuthToken } from "./authApi.js";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? `${apiBase.replace(/\/$/, "")}/api/admin` : "/api/admin";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent("quicklook-unauthorized"));
    }
    return Promise.reject(err);
  }
);

// ——— Plans ———
export const getAdminPlans = () => api.get("/plans");
export const getAdminPlan = (id) => api.get(`/plans/${id}`);
export const createPlan = (body) => api.post("/plans", body);
export const updatePlan = (id, body) => api.put(`/plans/${id}`, body);
export const deletePlan = (id) => api.delete(`/plans/${id}`);
export const activatePlan = (planId) => api.post(`/plans/${planId}/activate`);
export const deactivatePlan = (planId) => api.post(`/plans/${planId}/deactivate`);
export const syncPlanToStripe = (planId) => api.post(`/plans/${planId}/sync`).catch(() => null);

// ——— Experiments ———
export const getExperiments = (params) => api.get("/experiments", { params });
export const getExperiment = (id) => api.get(`/experiments/${id}`);
export const createExperiment = (body) => api.post("/experiments", body);
export const updateExperiment = (id, body) => api.put(`/experiments/${id}`, body);
export const getExperimentResults = (id) => api.get(`/experiments/${id}/results`);
export const concludeExperiment = (id, winner) => api.post(`/experiments/${id}/conclude`, { winner });

// ——— Coupons ———
export const getCoupons = () => api.get("/coupons");
export const getCoupon = (couponId) => api.get(`/coupons/${couponId}`);
export const createCoupon = (body) => api.post("/coupons", body);
export const updateCoupon = (couponId, body) => api.put(`/coupons/${couponId}`, body);
export const deleteCoupon = (couponId) => api.delete(`/coupons/${couponId}`);
export const syncCoupon = (couponId) => api.post(`/coupons/${couponId}/sync`);
