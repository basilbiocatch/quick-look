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

export const getSessions = (params) => {
  const { from, to, ...rest } = params || {};
  const query = { ...rest };
  if (from) query.from = typeof from === "number" ? new Date(from).toISOString() : from;
  if (to) query.to = typeof to === "number" ? new Date(to).toISOString() : to;
  return api.get("/sessions", { params: query });
};
export const getSession = (id) => api.get(`/sessions/${id}`);
export const getEvents = (id) => api.get(`/sessions/${id}/events`);

export const getProjects = () => api.get("/projects");
export const createProject = (body) => api.post("/projects", body);
