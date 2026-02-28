import { captureDeviceMeta } from "./collectors/device.js";
import { setIdentity, getIdentity } from "./collectors/identity.js";
import { patchConsole } from "./collectors/console.js";
import { patchNetwork } from "./collectors/network.js";
import { captureStorageSnapshot } from "./collectors/storage.js";
import { setConfig, startSession, endSession, getSessionId, isStarted } from "./session.js";
import { pushEvent, setWorker, setWorkerUrl, startScheduler, flushAndEnd, flushPendingWorkerChunks } from "./upload.js";
import { startRecording, stopRecording, ensureSessionStarted } from "./record.js";

const DEFAULT_API_URL = "http://localhost:3080";

function pushEventAndMaybeStart(ev) {
  pushEvent(ev);
}

let recordingStarted = false;
let stopRecord = null;

function init(projectKey, options = {}) {
  const apiUrl = options.apiUrl || DEFAULT_API_URL;
  const meta = captureDeviceMeta();
  const user = getIdentity();
  if (options.captureStorage) {
    try {
      meta.localStorageSnapshot = captureStorageSnapshot();
    } catch (e) {}
  }
  setConfig({
    apiUrl,
    projectKey: String(projectKey),
    meta,
    user,
    retentionDays: options.retentionDays ?? 30,
  });
  patchConsole(pushEventAndMaybeStart);
  patchNetwork(pushEventAndMaybeStart, apiUrl);
  if (options.workerUrl !== false) {
    const script = typeof document !== "undefined" && document.currentScript;
    const base = script && script.src ? script.src.replace(/\/[^/]*$/, "/") : "";
    const baseOrApi = base || (apiUrl.replace(/\/$/, "") + "/");
    const workerUrl = options.workerUrl || baseOrApi + "compress.worker.js";
    setWorkerUrl(workerUrl);
    try {
      const w = new Worker(workerUrl);
      setWorker(w);
    } catch (e) {
      console.warn("[quicklook] worker failed, using uncompressed upload", e);
    }
  }
  ensureSessionStarted()
    .then(() => {
      flushPendingWorkerChunks();
      startRecording();
      startScheduler();
      recordingStarted = true;
      stopRecord = stopRecording;
    })
    .catch((e) => {
      console.warn("[quicklook] session start failed, recording disabled", e);
    });
}

function identify(data) {
  setIdentity(data);
}

function stop() {
  if (stopRecord) stopRecord();
  flushAndEnd();
  endSession();
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
    stop,
    getSessionId: getSessionIdPublic,
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      if (recordingStarted) flushAndEnd();
      // Do not endSession() here: keep the same session across page navigations (same tab).
      // Session is ended only when the app calls stop() or when the tab is closed (storage is cleared).
    });
    window.addEventListener("beforeunload", () => {
      if (recordingStarted) flushAndEnd();
      // Do not endSession() so that the next page in the same tab reuses the session.
    });
  }
  return api;
}
