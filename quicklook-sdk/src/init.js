import { captureDeviceMeta } from "./collectors/device.js";
import { getOrCreateDeviceId, getDeviceId } from "./collectors/deviceId.js";
import { setIdentity, getIdentity } from "./collectors/identity.js";
import { patchConsole } from "./collectors/console.js";
import { patchNetwork } from "./collectors/network.js";
import { captureStorageSnapshot } from "./collectors/storage.js";
import { setConfig, endSession, getSessionId, getApiUrl, isStarted, isPageExcluded } from "./session.js";
import { pushEvent, setWorker, setWorkerUrl, startScheduler, flushAndEnd, flush, flushPendingWorkerChunks, stopScheduler, resetAfterSessionEnd } from "./upload.js";
import { startRecording, stopRecording, ensureSessionStarted, setRecordingOptions } from "./record.js";
import { setActivityConfig, setActivityCallbacks, startActivityMonitoring, stopActivityMonitoring } from "./activity.js";

const DEFAULT_API_URL = "https://localhost:3080";

const KNOWN_OPTIONS = new Set(["apiUrl", "retentionDays", "captureStorage", "workerUrl", "excludedUrls", "includedUrls", "inactivityTimeout", "pauseOnHidden", "maxSessionDuration", "inlineStylesheet", "collectFonts", "slimDOM"]);

function pushEventAndMaybeStart(ev) {
  pushEvent(ev);
}

let recordingStarted = false;
let stopRecord = null;

function patchHistoryAPI(pushEventFn, onNavigate) {
  if (typeof window === "undefined" || typeof history === "undefined") return;

  const afterNav = () => {
    pushEventFn({
      type: 4,  // Meta event
      data: { href: window.location.href },
      timestamp: Date.now()
    });
    if (typeof onNavigate === "function") onNavigate();
  };

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    afterNav();
    return result;
  };

  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    afterNav();
    return result;
  };

  window.addEventListener("popstate", afterNav);
}

let initCalled = false;

function init(projectKey, options = {}) {
  if (initCalled) {
    return;
  }
  initCalled = true;
  const apiUrl = options.apiUrl || DEFAULT_API_URL;
  const meta = captureDeviceMeta();
  const user = getIdentity();
  if (options.captureStorage) {
    try {
      meta.localStorageSnapshot = captureStorageSnapshot();
    } catch (e) {}
  }
  const custom = {};
  for (const key of Object.keys(options)) {
    if (KNOWN_OPTIONS.has(key)) continue;
    const v = options[key];
    if (v !== undefined && v !== null) custom[key] = v;
  }
  const apiUrlNorm = apiUrl.replace(/\/$/, "");
  setConfig({
    apiUrl: apiUrlNorm,
    projectKey: String(projectKey),
    meta,
    user,
    retentionDays: options.retentionDays ?? 30,
    attributes: Object.keys(custom).length ? custom : undefined,
    excludedUrls: options.excludedUrls,
    includedUrls: options.includedUrls,
    maxSessionDuration: options.maxSessionDuration !== undefined ? options.maxSessionDuration : 60 * 60 * 1000,
  });

  setActivityConfig({
    inactivityTimeout: options.inactivityTimeout !== undefined ? options.inactivityTimeout : 5 * 60 * 1000,
    pauseOnHidden: options.pauseOnHidden !== undefined ? options.pauseOnHidden : true,
  });

  setRecordingOptions({
    inlineStylesheet: options.inlineStylesheet !== undefined ? options.inlineStylesheet : false,
    collectFonts: options.collectFonts !== undefined ? options.collectFonts : false,
    slimDOM: options.slimDOM !== undefined ? options.slimDOM : true,
  });
  
  setActivityCallbacks(
    () => {
      if (recordingStarted) {
        stopRecording();
        flush();
        stopScheduler();
      }
    },
    () => {
      if (recordingStarted) {
        ensureSessionStarted().then(() => {
          startRecording();
          startScheduler();
        });
      }
    },
    () => {
      if (recordingStarted) {
        endSession(undefined, { clearStorage: true });
        resetAfterSessionEnd();
      }
    }
  );
  
  patchConsole(pushEventAndMaybeStart);
  patchNetwork(pushEventAndMaybeStart, apiUrlNorm);
  if (options.workerUrl !== false) {
    const script = typeof document !== "undefined" && document.currentScript;
    const base = script && script.src ? script.src.replace(/\/[^/]*$/, "/") : "";
    const baseOrApi = base || apiUrlNorm + "/";
    const workerUrl = options.workerUrl || baseOrApi + "compress.worker.js";
    setWorkerUrl(workerUrl);
    try {
      const w = new Worker(workerUrl);
      setWorker(w);
    } catch (e) {
      // Worker failed, using uncompressed upload
    }
  }

  async function startRecordingOnPage() {
    const sessionId = await ensureSessionStarted();
    if (!sessionId) return false;
    flushPendingWorkerChunks();
    startRecording();
    startScheduler();
    startActivityMonitoring();
    recordingStarted = true;
    stopRecord = stopRecording;
    return true;
  }

  function recheckPageRecording() {
    const url = typeof location !== "undefined" ? location.href : "";
    if (isPageExcluded(url)) {
      if (recordingStarted) {
        stopRecording();
        flush();
        stopScheduler();
        recordingStarted = false;
        stopRecord = null;
      }
    } else if (!recordingStarted) {
      startRecordingOnPage();
    }
  }

  (async () => {
    if (typeof fetch !== "undefined") {
      try {
        const r = await fetch(`${apiUrlNorm}/api/quicklook/projects/${encodeURIComponent(projectKey)}/config`);
        const d = await r.json();
        if (d && d.success) {
          const configUpdate = {};
          if (Array.isArray(d.excludedUrls)) configUpdate.excludedUrls = d.excludedUrls;
          if (typeof d.deviceIdEnabled === "boolean") configUpdate.deviceIdEnabled = d.deviceIdEnabled;
          if (Object.keys(configUpdate).length) setConfig(configUpdate);
          if (configUpdate.deviceIdEnabled) {
            getOrCreateDeviceId(apiUrlNorm);
          }
        }
      } catch (_) {}
    }
    const url = typeof location !== "undefined" ? location.href : "";
    if (isPageExcluded(url)) {
      patchHistoryAPI(pushEventAndMaybeStart, recheckPageRecording);
      return;
    }
    try {
      await startRecordingOnPage();
      patchHistoryAPI(pushEventAndMaybeStart, recheckPageRecording);
    } catch (e) {
      patchHistoryAPI(pushEventAndMaybeStart, recheckPageRecording);
    }
  })();
}

function identify(data) {
  setIdentity(data);
  const sid = getSessionId();
  const apiUrl = getApiUrl();
  if (sid && apiUrl && data && typeof data === "object") {
    const user = getIdentity();
    if (Object.keys(user).length > 0) {
      fetch(`${apiUrl}/api/quicklook/sessions/${encodeURIComponent(sid)}/identify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
        keepalive: true,
      }).catch(() => {});
    }
  }
}

function stop() {
  stopActivityMonitoring();
  if (stopRecord) stopRecord();
  flushAndEnd();
  endSession(undefined, { clearStorage: true });
}

function getSessionIdPublic(cb) {
  const id = getSessionId();
  if (typeof cb === "function") cb(id);
  return id;
}

export function createQuicklook() {
  const api = {
    init,
    identify,
    getIdentity,
    stop,
    getSessionId: getSessionIdPublic,
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", (e) => {
      if (recordingStarted) {
        flushAndEnd();
      }
      // If the page isn't being kept in bfcache, the tab is closing or
      // navigating away from this origin — send an explicit end signal.
      if (!e.persisted) {
        endSession({ status: "close", reason: "pagehide" });
      }
    });

    window.addEventListener("beforeunload", () => {
      if (recordingStarted) {
        flushAndEnd();
      }
    });
  }
  return api;
}
