let inactivityTimer = null;
let isPaused = false;
let inactivityTimeout = 5 * 60 * 1000; // Default 5 minutes
let pauseOnHidden = true;
let activityListenersAttached = false;

let pauseCallback = null;
let resumeCallback = null;

export function setActivityCallbacks(onPause, onResume) {
  pauseCallback = onPause;
  resumeCallback = onResume;
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

function pauseRecording() {
  if (isPaused) return;
  isPaused = true;
  if (pauseCallback) pauseCallback();
}

function resumeRecording() {
  if (!isPaused) return;
  isPaused = false;
  if (resumeCallback) resumeCallback();
}

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (isPaused || inactivityTimeout <= 0) return;
  
  inactivityTimer = setTimeout(() => {
    pauseRecording();
  }, inactivityTimeout);
}

function handleVisibilityChange() {
  if (!pauseOnHidden) return;
  
  if (typeof document !== "undefined" && document.hidden) {
    pauseRecording();
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
  
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  
  const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
  activityEvents.forEach((event) => {
    document.removeEventListener(event, handleUserActivity);
  });
}
