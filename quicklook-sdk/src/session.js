const STORAGE_KEY = "quicklook_sid";
const STORAGE_CHAIN_KEY = "quicklook_chain_id";
const STORAGE_START_TIME_KEY = "quicklook_start_time";

let sessionId = null;
let apiUrl = "";
let projectKey = "";
let meta = null;
let user = null;
let retentionDays = 30;
let attributes = null;
let excludedUrls = [];
/** If set (non-empty array), only these URL patterns are recorded; otherwise all URLs are recorded (except excluded). */
let includedUrls = null;
let started = false;
let sessionStartTime = null;
let maxSessionDuration = 60 * 60 * 1000; // 60 minutes default
let sessionChainId = null;
let parentSessionId = null;
let sequenceNumber = 1;

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

function getStoredChainId() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage.getItem(STORAGE_CHAIN_KEY);
  } catch {
    return null;
  }
}

function setStoredChainId(id) {
  try {
    if (typeof sessionStorage !== "undefined" && id) sessionStorage.setItem(STORAGE_CHAIN_KEY, id);
  } catch (_) {}
}

function getStoredStartTime() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const stored = sessionStorage.getItem(STORAGE_START_TIME_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

function setStoredStartTime(time) {
  try {
    if (typeof sessionStorage !== "undefined" && time) {
      sessionStorage.setItem(STORAGE_START_TIME_KEY, String(time));
    }
  } catch (_) {}
}

function clearSessionStorage() {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_CHAIN_KEY);
      sessionStorage.removeItem(STORAGE_START_TIME_KEY);
      sessionStorage.removeItem("quicklook_chunk_index");
    }
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
  if (config.attributes !== undefined) attributes = config.attributes;
  if (config.excludedUrls !== undefined) excludedUrls = Array.isArray(config.excludedUrls) ? config.excludedUrls : [];
  if (config.includedUrls !== undefined) {
    includedUrls = Array.isArray(config.includedUrls) && config.includedUrls.length > 0 ? config.includedUrls : null;
  }
  if (config.maxSessionDuration !== undefined) {
    maxSessionDuration = config.maxSessionDuration;
  }
}

export function getSessionStartTime() {
  return sessionStartTime;
}

export function shouldRotateSession() {
  if (!sessionStartTime || !sessionId || maxSessionDuration <= 0) {
    return false;
  }
  const elapsed = Date.now() - sessionStartTime;
  return elapsed >= maxSessionDuration;
}

/** Returns true if the given URL should not be monitored (excluded or not in allowlist). */
export function isPageExcluded(url) {
  if (!url || typeof url !== "string") return false;
  if (excludedUrls && excludedUrls.length > 0 && excludedUrls.some((p) => p && url.includes(p))) return true;
  if (includedUrls && includedUrls.length > 0) {
    return !includedUrls.some((pattern) => pattern && url.includes(pattern));
  }
  return false;
}

export async function startSession(rotationOptions = null) {
  if (started && sessionId && !rotationOptions) return sessionId;
  if (!apiUrl || !projectKey) return sessionId;

  // Reuse existing session from this tab (e.g. user navigated to another page, same origin)
  const stored = getStoredSessionId();
  const storedStartTime = getStoredStartTime();
  if (stored && typeof stored === "string" && stored.length > 0 && !rotationOptions) {
    sessionId = stored;
    started = true;
    sessionStartTime = storedStartTime || Date.now();
    sessionChainId = getStoredChainId();
    return sessionId;
  }

  // If already creating a session, wait for it
  if (startPromise) {
    return startPromise;
  }
  startPromise = (async () => {
    try {
      const payload = {
        projectKey,
        meta: meta || {},
        user: user || {},
        retentionDays,
      };
      if (attributes != null && typeof attributes === "object" && !Array.isArray(attributes)) {
        payload.attributes = attributes;
      }
      
      // Add session chain info if this is a rotation
      if (rotationOptions) {
        payload.parentSessionId = rotationOptions.parentSessionId;
        payload.sessionChainId = rotationOptions.sessionChainId;
        payload.sequenceNumber = rotationOptions.sequenceNumber;
        payload.splitReason = rotationOptions.splitReason || "duration_limit";
      }
      
      const body = JSON.stringify(payload);
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
        return sessionId;
      }
      if (data && data.success !== false && data.sessionId) {
        sessionId = data.sessionId;
        started = true;
        sessionStartTime = Date.now();
        setStoredSessionId(sessionId);
        setStoredStartTime(sessionStartTime);
        
        // Store or create chain ID
        if (data.sessionChainId) {
          sessionChainId = data.sessionChainId;
          setStoredChainId(sessionChainId);
        } else if (rotationOptions && rotationOptions.sessionChainId) {
          sessionChainId = rotationOptions.sessionChainId;
          setStoredChainId(sessionChainId);
        }
        
        if (rotationOptions) {
          parentSessionId = rotationOptions.parentSessionId;
          sequenceNumber = rotationOptions.sequenceNumber;
        }
      }
    } catch (e) {
      // Session start failed silently
    } finally {
      startPromise = null;
    }
    return sessionId;
  })();
  return startPromise;
}

export async function rotateSession(reason = "duration_limit") {
  if (!sessionId) return null;
  
  const oldSessionId = sessionId;
  const oldChainId = sessionChainId || oldSessionId; // Use first session ID as chain ID
  const newSequence = sequenceNumber + 1;
  
  // Clear current session
  sessionId = null;
  started = false;
  parentSessionId = oldSessionId;
  sequenceNumber = newSequence;
  sessionChainId = oldChainId;
  
  // Start new session with chain info
  await startSession({
    parentSessionId: oldSessionId,
    sessionChainId: oldChainId,
    sequenceNumber: newSequence,
    splitReason: reason,
  });
  
  return { oldSessionId, newSessionId: sessionId, sessionChainId: oldChainId, sequenceNumber: newSequence };
}

export function endSession(payload, { clearStorage = false } = {}) {
  if (!sessionId || !apiUrl) return;
  try {
    const body = JSON.stringify(payload || { status: "close" });
    navigator.sendBeacon(`${apiUrl}/api/quicklook/sessions/${sessionId}/end`, body);
    if (clearStorage) {
      clearSessionStorage();
    }
  } catch (e) {
    // End session beacon failed silently
  }
}
