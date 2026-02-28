const STORAGE_KEY = "quicklook_sid";

let sessionId = null;
let apiUrl = "";
let projectKey = "";
let meta = null;
let user = null;
let retentionDays = 30;
let started = false;

/** Single in-flight start promise so duplicate init() calls don't create two sessions */
let startPromise = null;

function getStoredSessionId() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredSessionId(id) {
  try {
    if (typeof sessionStorage !== "undefined" && id) sessionStorage.setItem(STORAGE_KEY, id);
  } catch (_) {}
}

export function getSessionId() {
  return sessionId;
}

export function getApiUrl() {
  return apiUrl;
}

export function isStarted() {
  return started;
}

export function setConfig(config) {
  if (config.apiUrl) apiUrl = config.apiUrl.replace(/\/$/, "");
  if (config.projectKey) projectKey = config.projectKey;
  if (config.meta) meta = config.meta;
  if (config.user != null) user = config.user;
  if (config.retentionDays != null) retentionDays = config.retentionDays;
}

export async function startSession() {
  if (started && sessionId) return sessionId;
  if (!apiUrl || !projectKey) return sessionId;

  // Reuse existing session from this tab (e.g. user navigated to another page, same origin)
  const stored = getStoredSessionId();
  if (stored && typeof stored === "string" && stored.length > 0) {
    sessionId = stored;
    started = true;
    return sessionId;
  }

  if (startPromise) return startPromise;
  startPromise = (async () => {
    try {
      const body = JSON.stringify({
        projectKey,
        meta: meta || {},
        user: user || {},
        retentionDays,
      });
      const res = await fetch(`${apiUrl}/api/quicklook/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
      let data;
      try {
        data = await res.json();
      } catch (e) {
        console.warn("[quicklook] startSession: invalid JSON response", e);
        return sessionId;
      }
      if (data && data.success !== false && data.sessionId) {
        sessionId = data.sessionId;
        started = true;
        setStoredSessionId(sessionId);
      } else if (data && data.success === false) {
        console.warn("[quicklook] startSession failed:", data.error || "unknown");
      }
    } catch (e) {
      console.warn("[quicklook] startSession failed", e);
    } finally {
      startPromise = null;
    }
    return sessionId;
  })();
  return startPromise;
}

export function endSession(payload) {
  if (!sessionId || !apiUrl) return;
  try {
    const body = JSON.stringify(payload || { status: "close" });
    navigator.sendBeacon(`${apiUrl}/api/quicklook/sessions/${sessionId}/end`, body);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem("quicklook_chunk_index");
      }
    } catch (_) {}
  } catch (e) {
    console.warn("[quicklook] endSession beacon failed", e);
  }
}
