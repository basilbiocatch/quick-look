import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAuthToken, setAuthToken, getMe, login as apiLogin, register as apiRegister } from "../api/authApi.js";

const AuthContext = createContext(null);

function userFromData(data) {
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    name: data.name || "",
    sessionCap: data.sessionCap ?? null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await getMe();
      const data = res.data?.user;
      setUser(userFromData(data) || null);
      if (!data) setAuthToken(null);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("quicklook-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("quicklook-unauthorized", handleUnauthorized);
  }, []);

  const login = useCallback(async (credentials) => {
    try {
      const res = await apiLogin(credentials);
      const token = res.data?.token;
      const userData = res.data?.user;
      if (token && userData) {
        setAuthToken(token);
        setUser(userFromData(userData));
        return { success: true };
      }
      return { success: false, error: res.data?.error || "Login failed" };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message || "Login failed" };
    }
  }, []);

  const signup = useCallback(async (payload) => {
    try {
      const res = await apiRegister(payload);
      const token = res.data?.token;
      const userData = res.data?.user;
      if (token && userData) {
        setAuthToken(token);
        setUser(userFromData(userData));
        return { success: true };
      }
      return { success: false, error: res.data?.error || "Registration failed" };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || err.message || "Registration failed" };
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = { user, loading, login, signup, logout, loadUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
