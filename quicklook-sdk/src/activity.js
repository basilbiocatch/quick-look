let inactivityTimer = null;
let maxInactivityTimer = null;
let isPaused = false;
let pausedByVisibility = false; // true when paused due to tab hidden (no max-inactivity end)
let inactivityTimeout = 5 * 60 * 1000; // Default 5 minutes
const MAX_INACTIVITY_BEFORE_END_MS = 30 * 60 * 1000; // 30 minutes total inactivity → end session
let pauseOnHidden = true;
let activityListenersAttached = false;

let pauseCallback = null;
let resumeCallback = null;
let maxInactivityCallback = null;

export function setActivityCallbacks(onPause, onResume, onMaxInactivityReached) {
  pauseCallback = onPause;
  resumeCallback = onResume;
  maxInactivityCallback = typeof onMaxInactivityReached === "function" ? onMaxInactivityReached : null;
}

export function setActivityConfig(config) {
  if (config.inactivityTimeout !== undefined) {
    inactivityTimeout = config.inactivityTimeout;
  }
  if (config.pauseOnHidden !== undefined) {
    pauseOnHidden = config.pauseOnHidden;
  }
}

export function isPausedByActivity() {
  return isPaused;
}

function clearMaxInactivityTimer() {
  if (maxInactivityTimer) {
    clearTimeout(maxInactivityTimer);
    maxInactivityTimer = null;
  }
}

function pauseRecording(byVisibility = false) {
  if (isPaused) return;
  isPaused = true;
  pausedByVisibility = byVisibility;
  if (pauseCallback) pauseCallback();
  // When paused due to inactivity (not tab hidden), start max-inactivity timer.
  // After 30 min total inactivity we end the session.
  if (!byVisibility && inactivityTimeout > 0 && MAX_INACTIVITY_BEFORE_END_MS > inactivityTimeout) {
    clearMaxInactivityTimer();
    const remainingMs = MAX_INACTIVITY_BEFORE_END_MS - inactivityTimeout;
    maxInactivityTimer = setTimeout(() => {
      maxInactivityTimer = null;
      if (maxInactivityCallback) maxInactivityCallback();
    }, remainingMs);
  }
}

function resumeRecording() {
  if (!isPaused) return;
  clearMaxInactivityTimer();
  pausedByVisibility = false;
  isPaused = false;
  if (resumeCallback) resumeCallback();
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (isPaused || inactivityTimeout <= 0) return;
  
  inactivityTimer = setTimeout(() => {
    pauseRecording(false); // inactivity, not visibility
  }, inactivityTimeout);
}

function handleVisibilityChange() {
  if (!pauseOnHidden) return;
  
  if (typeof document !== "undefined" && document.hidden) {
    pauseRecording(true); // visibility
  } else {
    if (isPaused) {
      resumeRecording();
    }
    resetInactivityTimer();
  }
}

function handleUserActivity() {
  if (typeof document !== "undefined" && document.hidden) return;
  
  if (isPaused) {
    resumeRecording();
  }
  resetInactivityTimer();
}

export function startActivityMonitoring() {
  if (activityListenersAttached || typeof window === "undefined" || typeof document === "undefined") return;
  
  activityListenersAttached = true;
  
  if (pauseOnHidden) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }
  
  if (inactivityTimeout > 0) {
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleUserActivity, { passive: true });
    });
    
    resetInactivityTimer();
  }
}

export function stopActivityMonitoring() {
  if (!activityListenersAttached || typeof document === "undefined") return;
  
  activityListenersAttached = false;
  
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  clearMaxInactivityTimer();
  
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  
  const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
  activityEvents.forEach((event) => {
    document.removeEventListener(event, handleUserActivity);
  });
}
