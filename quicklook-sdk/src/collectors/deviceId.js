/**
 * Device ID: persistent ID via localStorage + server registration, with client-side
 * fingerprint fallback. Only runs when project config has deviceIdEnabled: true.
 * Storage key: quicklook_device_id (Safari: check Local Storage for your origin; Private Browsing may not persist).
 */
export const DEVICE_ID_STORAGE_KEY = "quicklook_device_id";
const STORAGE_KEY = DEVICE_ID_STORAGE_KEY;

/** Module-scope deviceId set when getOrCreateDeviceId resolves (or from localStorage read). */
let storedDeviceId = null;

/**
 * Simple 53-bit string hash (cyrb53-style). No external deps.
 * @param {string} str
 * @param {number} [seed]
 * @returns {string} hex string
 */
function hashString(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function getCanvasFingerprint() {
  try {
    if (typeof document === "undefined" || !document.createElement) return "";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    canvas.width = 200;
    canvas.height = 50;
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("QuickLook device fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("QuickLook device fingerprint", 4, 17);
    const dataUrl = canvas.toDataURL ? canvas.toDataURL() : "";
    return dataUrl ? hashString(dataUrl) : "";
  } catch {
    return "";
  }
}

function getWebGLFingerprint() {
  try {
    if (typeof document === "undefined" || !document.createElement) return "";
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "";
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
    return renderer + "|" + vendor;
  } catch {
    return "";
  }
}

function getAudioFingerprint() {
  try {
    if (typeof AudioContext === "undefined" && typeof webkitAudioContext === "undefined") return "";
    const Ctx = typeof AudioContext !== "undefined" ? AudioContext : webkitAudioContext;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(0);
    const data = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(data);
    oscillator.stop();
    ctx.close();
    return Array.from(data.slice(0, 32)).join(",");
  } catch {
    return "";
  }
}

/**
 * Build fingerprint object and return a single string (for hashing or fallback ID).
 * @returns {{ object: Record<string, unknown>, string: string }}
 */
function getFingerprint() {
  const screenWidth = typeof screen !== "undefined" ? screen.width : 0;
  const screenHeight = typeof screen !== "undefined" ? screen.height : 0;
  const colorDepth = typeof screen !== "undefined" ? (screen.colorDepth || 24) : 24;
  const timezone =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "";
  const language = typeof navigator !== "undefined" ? navigator.language : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  const hardwareConcurrency = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency || 0) : 0;
  const maxTouchPoints = typeof navigator !== "undefined" ? (navigator.maxTouchPoints ?? 0) : 0;
  const deviceMemory = typeof navigator !== "undefined" && navigator.deviceMemory != null ? navigator.deviceMemory : "";

  const audioRaw = getAudioFingerprint();
  const obj = {
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    audio: audioRaw ? hashString(audioRaw) : "",
    screen: `${screenWidth}x${screenHeight}x${colorDepth}`,
    timezone,
    language,
    platform,
    hardwareConcurrency,
    maxTouchPoints,
    deviceMemory,
  };
  const str = JSON.stringify(obj);
  return { object: obj, string: str };
}

/**
 * Hash fingerprint string to a short stable value.
 * @param {string} fingerprintString
 * @returns {string}
 */
function hashFingerprint(fingerprintString) {
  return hashString(fingerprintString);
}

/**
 * Read deviceId from localStorage (sync). Does not set storedDeviceId.
 * @returns {string | null}
 */
function getStoredDeviceId() {
  try {
    if (typeof localStorage === "undefined") return null;
    const id = localStorage.getItem(STORAGE_KEY);
    return id && typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

function setStoredDeviceId(id) {
  try {
    if (typeof localStorage !== "undefined" && id) localStorage.setItem(STORAGE_KEY, id);
  } catch (_) {}
}

/**
 * Sync: returns current deviceId from memory (set when getOrCreateDeviceId resolved or from initial read).
 * @returns {string | null}
 */
export function getDeviceId() {
  if (storedDeviceId) return storedDeviceId;
  const fromStorage = getStoredDeviceId();
  if (fromStorage) {
    storedDeviceId = fromStorage;
    return storedDeviceId;
  }
  return null;
}

/**
 * Async: get or create device ID. Reads localStorage first; if missing, generates fingerprint,
 * POSTs to apiUrl + '/api/quicklook/device-id', stores and returns deviceId. On network error
 * uses fallback client-only ID (fp_ + fingerprint hash slice).
 * @param {string} apiUrl - Base API URL (no trailing slash).
 * @returns {Promise<string>}
 */
export async function getOrCreateDeviceId(apiUrl) {
  const base = (apiUrl || "").replace(/\/$/, "");
  const existing = getStoredDeviceId();
  if (existing) {
    storedDeviceId = existing;
    return existing;
  }

  const { string: fingerprintString } = getFingerprint();
  const fingerprintHash = hashFingerprint(fingerprintString);
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

  try {
    const url = `${base}/api/quicklook/device-id`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fingerprintHash, userAgent }),
    });
    const data = await res.json();
    if (data && data.deviceId && typeof data.deviceId === "string") {
      storedDeviceId = data.deviceId;
      setStoredDeviceId(data.deviceId);
      return data.deviceId;
    }
  } catch (_) {
    // Network or parse error: use fallback
  }

  const fallback = "fp_" + fingerprintHash.slice(0, 16);
  storedDeviceId = fallback;
  setStoredDeviceId(fallback);
  return fallback;
}
