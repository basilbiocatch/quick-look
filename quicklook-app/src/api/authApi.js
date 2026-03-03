import axios from "axios";

const apiBase = import.meta.env.VITE_API_BASE_URL;
const baseURL = apiBase ? apiBase.replace(/\/$/, "") : "";

const authApi = axios.create({
  baseURL: baseURL || undefined,
  headers: { "Content-Type": "application/json" },
});

const TOKEN_KEY = "quicklook_token";
const REMEMBER_KEY = "quicklook_remember";

function getStoredToken() {
  try {
    const remember = localStorage.getItem(REMEMBER_KEY);
    if (remember === "false") return sessionStorage.getItem(TOKEN_KEY);
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearTokenEverywhere() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
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
      clearTokenEverywhere();
      window.dispatchEvent(new CustomEvent("quicklook-unauthorized"));
    }
    return Promise.reject(err);
  }
);

/**
 * @param {string|null} token - Auth token (null to clear)
 * @param {boolean} [remember=true] - If true, persist in localStorage; if false, sessionStorage only (logout on tab close)
 */
export function setAuthToken(token, remember = true) {
  clearTokenEverywhere();
  if (token) {
    try {
      (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    } catch {}
  }
}

export function getAuthToken() {
  return getStoredToken();
}

export const register = (body) => authApi.post("/api/auth/register", body);
export const login = (body) => authApi.post("/api/auth/login", body);
export const getMe = () => authApi.get("/api/auth/me");
export const verifyEmail = (token) => authApi.post("/api/auth/verify-email", { token });
export const forgotPassword = (email) => authApi.post("/api/auth/forgot-password", { email });
export const resetPassword = (token, newPassword) => authApi.post("/api/auth/reset-password", { token, newPassword });
export const changePassword = (currentPassword, newPassword) => authApi.post("/api/auth/change-password", { currentPassword, newPassword });
export const resendVerificationEmail = () => authApi.post("/api/auth/resend-verification");
