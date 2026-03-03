import axios from "axios";
import { getAuthToken } from "./authApi.js";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? `${apiBase.replace(/\/$/, "")}/api/quicklook` : "/api/quicklook";
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
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

/**
 * Fetches sessions.
 * Query params: from, to, and any rest (projectKey, deviceId, ipAddress, limit, skip).
 * deviceId is included in the request as a query param when provided in params.
 */
export const getSessions = (params) => {
  const { from, to, ...rest } = params || {};
  const query = { ...rest };
  if (from) query.from = typeof from === "number" ? new Date(from).toISOString() : from;
  if (to) query.to = typeof to === "number" ? new Date(to).toISOString() : to;
  return api.get("/sessions", { params: query });
};
export const getSession = (id) => api.get(`/sessions/${id}`);
export const getEvents = (id) => api.get(`/sessions/${id}/events`);
/** On-demand AI summary (analytics). Returns { aiSummary, generated }. */
export const getEnsureSummary = (sessionId) => api.get(`/sessions/${sessionId}/ensure-summary`);
/** On-demand root cause for friction points (analytics). Returns { frictionPoints, generated }. */
export const getEnsureRootCause = (sessionId) => api.get(`/sessions/${sessionId}/ensure-root-cause`);

export const getInsights = (projectKey, params) =>
  api.get("/insights", { params: { projectKey, ...params } });
export const getInsight = (insightId) => api.get(`/insights/${insightId}`);
export const patchInsight = (insightId, body) => api.patch(`/insights/${insightId}`, body);
export const postInsightsGenerate = (projectKey) =>
  api.post("/insights/generate", { projectKey }, { params: { projectKey } });

export const getReports = (projectKey, params) =>
  api.get("/reports", { params: { projectKey, ...params } });
export const getReport = (reportId) => api.get(`/reports/${reportId}`);
export const postReportsGenerate = (projectKey, options) =>
  api.post("/reports/generate", { projectKey, ...options }, { params: { projectKey, ...options } });

export const getAbTests = (projectKey, params) =>
  api.get("/ab-tests", { params: { projectKey, ...params } });
export const getAbTest = (testId) => api.get(`/ab-tests/${testId}`);
export const createAbTest = (body) => api.post("/ab-tests", body);
export const patchAbTest = (testId, body) => api.patch(`/ab-tests/${testId}`, body);

export const getAccuracyMetrics = (projectKey) =>
  api.get("/accuracy-metrics", { params: { projectKey } });
export const postModelsRetrain = (projectKey) =>
  api.post("/models/retrain", {}, { params: projectKey ? { projectKey } : {} });

export const getProjects = () => api.get("/projects");
export const createProject = (body) => api.post("/projects", body);
export const getProject = (projectKey) => api.get(`/projects/${projectKey}`);
export const updateProject = (projectKey, data) => api.patch(`/projects/${projectKey}`, data);
export const deleteProject = (projectKey) => api.delete(`/projects/${projectKey}`);
