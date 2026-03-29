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

const DEVICE_ID_STORAGE_KEY = "ql_device_id";

/**
 * Get or create a stable device ID (QL device-id mechanism).
 * Cached in localStorage so the same browser keeps the same ID for pricing experiments and session correlation.
 * @returns {Promise<string>} deviceId
 */
export async function getOrCreateDeviceId() {
  try {
    const cached = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (cached && typeof cached === "string" && cached.trim()) return cached.trim();
  } catch {}
  try {
    const res = await api.post("/device-id", {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
    const deviceId = res.data?.deviceId;
    if (deviceId && typeof deviceId === "string") {
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
      return deviceId;
    }
  } catch (err) {
    if (err.response?.status === 401) {
      return null;
    }
  }
  return null;
}

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
 * Query params: from, to, sessionIds (comma-separated or array), and any rest (projectKey, deviceId, ipAddress, limit, skip).
 */
export const getSessions = (params) => {
  const { from, to, sessionIds, ...rest } = params || {};
  const query = { ...rest };
  if (from) query.from = typeof from === "number" ? new Date(from).toISOString() : from;
  if (to) query.to = typeof to === "number" ? new Date(to).toISOString() : to;
  if (sessionIds != null) {
    query.sessionIds = Array.isArray(sessionIds) ? sessionIds.join(",") : String(sessionIds);
  }
  return api.get("/sessions", { params: query });
};
export const getSession = (id) => api.get(`/sessions/${id}`);
export const getEvents = (id) => api.get(`/sessions/${id}/events`);
/** Fetch a batch of chunks for progressive loading. start=0-based, limit=chunks per request */
export const getEventsBatch = (sessionId, start = 0, limit = 5) =>
  api.get(`/sessions/${sessionId}/chunks`, { params: { start, limit } });
/** On-demand AI summary (analytics). Returns { aiSummary, generated }. */
export const getEnsureSummary = (sessionId) => api.get(`/sessions/${sessionId}/ensure-summary`);
/** On-demand root cause for friction points (analytics). Returns { frictionPoints, generated }. */
export const getEnsureRootCause = (sessionId) => api.get(`/sessions/${sessionId}/ensure-root-cause`);

/** Create public share link for a session. Returns { shareToken, shareUrl, shareExpiresAt }. */
export const createShare = (sessionId) => api.post(`/sessions/${sessionId}/share`);
/** Revoke public share for a session. */
export const revokeShare = (sessionId) => api.delete(`/sessions/${sessionId}/share`);
/** Public: get session + events by share token (no auth). Returns { data: { session, events, meta } }. */
export const getPublicShare = (shareToken) => api.get(`/public/share/${encodeURIComponent(shareToken)}`);

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

export const getIssues = (projectKey, params) =>
  api.get("/issues", { params: { projectKey, ...params } });
/** Errors and warnings per day for the last N days. Params: segment, days. */
export const getIssuesDaily = (projectKey, params) =>
  api.get("/issues/daily", { params: { projectKey, ...params } });
export const getIssueDetail = (projectKey, issueId, params) =>
  api.get(`/issues/${issueId}`, { params: { projectKey, ...params } });

/** Product analytics: aggregated event counts. Params: from, to (ISO), name (prefix), sort, limit */
export const getTrackedEventsSummary = (projectKey, params) =>
  api.get(`/projects/${encodeURIComponent(projectKey)}/events/summary`, { params });
/** Charts: totals, daily series, stacked top names. Params: from, to (ISO), name (prefix) */
export const getTrackedEventsAnalytics = (projectKey, params) =>
  api.get(`/projects/${encodeURIComponent(projectKey)}/events/analytics`, { params });
/** Distinct event names in range for filters. Params: from, to (ISO) */
export const getTrackedEventNames = (projectKey, params) =>
  api.get(`/projects/${encodeURIComponent(projectKey)}/event-names`, { params });
/** Per-session tracked events for replay sidebar */
export const getSessionTrackedEvents = (sessionId) =>
  api.get(`/sessions/${encodeURIComponent(sessionId)}/tracked-events`);

export const getProjects = () => api.get("/projects");
export const createProject = (body) => api.post("/projects", body);
export const getProject = (projectKey) => api.get(`/projects/${projectKey}`);
export const updateProject = (projectKey, data) => api.patch(`/projects/${projectKey}`, data);
export const deleteProject = (projectKey) => api.delete(`/projects/${projectKey}`);
