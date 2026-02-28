import { getSessionId, getApiUrl } from "./session.js";
import pako from "pako";

const FLUSH_INTERVAL_MS = 5000;
const COMPRESS_THRESHOLD_BYTES = 50 * 1024;
const FLUSH_SIZE_BYTES = 150 * 1024;
const FIRST_CHUNK_DELAY_MS = 2000;
const STORAGE_CHUNK_KEY = "quicklook_chunk_index";
let eventBuffer = [];
let chunkIndex = 0;
let chunkIndexRestored = false;
let worker = null;
let workerUrl = "";
let flushTimer = null;
let firstChunkTimer = null;

function ensureRestoredChunkIndex() {
  if (chunkIndexRestored || typeof sessionStorage === "undefined") return;
  chunkIndexRestored = true;
  try {
    const stored = sessionStorage.getItem(STORAGE_CHUNK_KEY);
    if (stored !== null && stored !== "") {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= 0) chunkIndex = n;
    }
  } catch (_) {}
}

function persistChunkIndex() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_CHUNK_KEY, String(chunkIndex));
  } catch (_) {}
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(doFlush, FLUSH_INTERVAL_MS);
}

function scheduleFirstChunkFlush() {
  if (firstChunkTimer) return;
  firstChunkTimer = setTimeout(() => {
    firstChunkTimer = null;
    if (getSessionId()) {
      doFlush();
    } else {
      console.warn('[quicklook] first chunk delayed: waiting for sessionId');
      setTimeout(() => {
        if (getSessionId()) doFlush();
      }, 1000);
    }
  }, FIRST_CHUNK_DELAY_MS);
}

function doFlush() {
  flushTimer = null;
  if (eventBuffer.length === 0) return;
  ensureRestoredChunkIndex();
  const events = eventBuffer.slice();
  eventBuffer = [];
  const index = chunkIndex++;
  persistChunkIndex();
  if (worker && typeof worker.postMessage === "function") {
    worker.postMessage({ index, events });
  } else {
    sendChunkDirect(index, events);
  }
  scheduleFlush();
}

function uint8ArrayToBase64(uint8) {
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < uint8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function sendChunkDirect(index, events) {
  try {
    const sessionId = getSessionId();
    const apiUrl = getApiUrl();
    if (!sessionId || !apiUrl) {
      console.warn("[quicklook] chunk", index, "dropped: no sessionId yet");
      return;
    }
    const json = JSON.stringify(events);
    const useCompression = index === 0 || json.length >= COMPRESS_THRESHOLD_BYTES;
    let body;
    if (useCompression) {
      const compressed = pako.gzip(json);
      body = JSON.stringify({
        index,
        data: uint8ArrayToBase64(compressed),
        compressed: true,
      });
    } else {
      body = JSON.stringify({ index, data: events, compressed: false });
    }
    fetch(`${apiUrl}/api/quicklook/sessions/${sessionId}/chunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (e) {
    console.warn("[quicklook] sendChunkDirect error", e);
  }
}

let pendingWorkerChunks = [];

function sendWorkerChunk(index, data) {
  const sessionId = getSessionId();
  const apiUrl = getApiUrl();
  if (!sessionId || !apiUrl) {
    console.warn('[quicklook] worker chunk', index, 'queued: no sessionId yet');
    pendingWorkerChunks.push({ index, data });
    return;
  }
  fetch(`${apiUrl}/api/quicklook/sessions/${sessionId}/chunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index, data, compressed: true }),
    keepalive: true,
  }).catch(() => {});
}

export function flushPendingWorkerChunks() {
  if (pendingWorkerChunks.length === 0) return;
  const sessionId = getSessionId();
  const apiUrl = getApiUrl();
  if (!sessionId || !apiUrl) return;
  for (const { index, data } of pendingWorkerChunks) {
    fetch(`${apiUrl}/api/quicklook/sessions/${sessionId}/chunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, data, compressed: true }),
      keepalive: true,
    }).catch(() => {});
  }
  pendingWorkerChunks = [];
}

export function setWorker(w) {
  worker = w;
  if (w) {
    w.onmessage = (e) => {
      const { index, data } = e.data || {};
      sendWorkerChunk(index, data);
    };
  }
}

export function setWorkerUrl(url) {
  workerUrl = url;
}

export function pushEvent(ev) {
  eventBuffer.push(ev);
  if (ev && ev.type === 2) {
    scheduleFirstChunkFlush();
  }
  let size = 0;
  try {
    size = new Blob([JSON.stringify(eventBuffer)]).size;
  } catch (e) {
    size = eventBuffer.length * 500;
  }
  if (size >= FLUSH_SIZE_BYTES) {
    doFlush();
  } else {
    scheduleFlush();
  }
}

export function flushAndEnd() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (firstChunkTimer) {
    clearTimeout(firstChunkTimer);
    firstChunkTimer = null;
  }
  if (eventBuffer.length > 0) {
    ensureRestoredChunkIndex();
    const events = eventBuffer.slice();
    eventBuffer = [];
    const index = chunkIndex++;
    persistChunkIndex();
    const sessionId = getSessionId();
    const apiUrl = getApiUrl();
    if (sessionId && apiUrl) {
      const body = JSON.stringify({ index, data: events, compressed: false, status: "close" });
      navigator.sendBeacon(`${apiUrl}/api/quicklook/sessions/${sessionId}/end`, body);
    }
  }
}

export function startScheduler() {
  scheduleFlush();
}
