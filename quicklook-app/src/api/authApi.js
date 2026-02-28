import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? apiBase.replace(/\/$/, "") : "";

const authApi = axios.create({
  baseURL: baseURL || undefined,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "quicklook_token";

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

authApi.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

authApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {}
      window.dispatchEvent(new CustomEvent("quicklook-unauthorized"));
    }
    return Promise.reject(err);
  }
);

export function setAuthToken(token) {
  if (token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  } else {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }
}

export function getAuthToken() {
  return getStoredToken();
}

export const register = (body) => authApi.post("/api/auth/register", body);
export const login = (body) => authApi.post("/api/auth/login", body);
export const getMe = () => authApi.get("/api/auth/me");
