(() => {
  // src/shim.js
  function setupQueue() {
    if (typeof window === "undefined") return;
    if (!window.quicklook) {
      window.quicklook = function() {
        (window.quicklook.q = window.quicklook.q || []).push(arguments);
      };
      window.quicklook.q = [];
    }
  }

  // src/collectors/device.js
  function captureDeviceMeta() {
    const conn = typeof navigator !== "undefined" && navigator.connection;
    return {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      platform: typeof navigator !== "undefined" ? navigator.platform : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      languages: typeof navigator !== "undefined" && Array.isArray(navigator.languages) ? navigator.languages : [],
      screen: typeof screen !== "undefined" ? { width: screen.width, height: screen.height, colorDepth: screen.colorDepth || 24 } : { width: 0, height: 0, colorDepth: 24 },
      viewport: typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : { width: 0, height: 0 },
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      timezone: typeof Intl !== "undefined" && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
      cookieEnabled: typeof navigator !== "undefined" ? navigator.cookieEnabled : false,
      doNotTrack: typeof navigator !== "undefined" ? navigator.doNotTrack : null,
      connection: conn && typeof conn === "object" ? {
        type: conn.type || "",
        effectiveType: conn.effectiveType || "",
        downlink: conn.downlink,
        rtt: conn.rtt
      } : void 0
    };
  }

  // src/collectors/deviceId.js
  var DEVICE_ID_STORAGE_KEY = "quicklook_device_id";
  var STORAGE_KEY = DEVICE_ID_STORAGE_KEY;
  var storedDeviceId = null;
  function hashString(str, seed = 0) {
    let h1 = 3735928559 ^ seed;
    let h2 = 1103547991 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
    h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
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
  function getFingerprint() {
    const screenWidth = typeof screen !== "undefined" ? screen.width : 0;
    const screenHeight = typeof screen !== "undefined" ? screen.height : 0;
    const colorDepth = typeof screen !== "undefined" ? screen.colorDepth || 24 : 24;
    const timezone = typeof Intl !== "undefined" && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
    const language = typeof navigator !== "undefined" ? navigator.language : "";
    const platform = typeof navigator !== "undefined" ? navigator.platform : "";
    const hardwareConcurrency = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 0 : 0;
    const maxTouchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
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
      deviceMemory
    };
    const str = JSON.stringify(obj);
    return { object: obj, string: str };
  }
  function hashFingerprint(fingerprintString) {
    return hashString(fingerprintString);
  }
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
    } catch (_) {
    }
  }
  function getDeviceId() {
    if (storedDeviceId) return storedDeviceId;
    const fromStorage = getStoredDeviceId();
    if (fromStorage) {
      storedDeviceId = fromStorage;
      return storedDeviceId;
    }
    return null;
  }
  async function getOrCreateDeviceId(apiUrl2) {
    const base = (apiUrl2 || "").replace(/\/$/, "");
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
        body: JSON.stringify({ fingerprint: fingerprintHash, userAgent })
      });
      const data = await res.json();
      if (data && data.deviceId && typeof data.deviceId === "string") {
        storedDeviceId = data.deviceId;
        setStoredDeviceId(data.deviceId);
        return data.deviceId;
      }
    } catch (_) {
    }
    const fallback = "fp_" + fingerprintHash.slice(0, 16);
    storedDeviceId = fallback;
    setStoredDeviceId(fallback);
    return fallback;
  }

  // src/collectors/identity.js
  var userIdentity = {};
  function setIdentity(data) {
    if (data && typeof data === "object") {
      userIdentity = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        ...data
      };
    }
  }
  function getIdentity() {
    return { ...userIdentity };
  }

  // src/collectors/console.js
  var MAX_CONSOLE_MESSAGES = 50;
  var MAX_MESSAGE_LENGTH = 1024;
  var count = 0;
  var pushEvent;
  function serializeArgs(args) {
    try {
      const str = JSON.stringify(Array.from(args).map((a) => typeof a === "object" ? String(a) : a));
      return str.length > MAX_MESSAGE_LENGTH ? str.slice(0, MAX_MESSAGE_LENGTH) + "\u2026" : str;
    } catch {
      return "[unserializable]";
    }
  }
  function capture(level, args) {
    if (count >= MAX_CONSOLE_MESSAGES || !pushEvent) return;
    count++;
    pushEvent({
      type: 5,
      data: {
        tag: "ql_console",
        payload: {
          level,
          args: serializeArgs(args),
          timestamp: Date.now()
        }
      },
      timestamp: Date.now()
    });
  }
  function patchConsole(pushEventFn) {
    pushEvent = pushEventFn;
    if (typeof console === "undefined") return;
    const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    ["log", "info", "warn", "error"].forEach((level) => {
      console[level] = function(...args) {
        capture(level, args);
        orig[level].apply(console, args);
      };
    });
  }

  // src/collectors/network.js
  var pushEvent2;
  var apiBase = "";
  var BLOCKLIST = ["/api/quicklook/", "quicklook", "sessions/start", "sessions/", "/chunk", "/end"];
  function isQuicklookUrl(url) {
    if (!url || !apiBase) return false;
    try {
      const u = typeof url === "string" ? url : url.toString();
      if (u.startsWith(apiBase)) return true;
      return BLOCKLIST.some((p) => u.includes(p));
    } catch {
      return false;
    }
  }
  function captureNetwork(method, url, status, duration, responseSize) {
    if (!pushEvent2) return;
    pushEvent2({
      type: 5,
      data: {
        tag: "ql_network",
        payload: { method, url, status, duration, responseSize, timestamp: Date.now() }
      },
      timestamp: Date.now()
    });
  }
  function patchNetwork(pushEventFn, apiUrl2) {
    pushEvent2 = pushEventFn;
    apiBase = apiUrl2 ? apiUrl2.replace(/\/$/, "") : "";
    if (typeof window === "undefined") return;
    const origFetch = window.fetch;
    window.fetch = function(input2, init2) {
      const url = typeof input2 === "string" ? input2 : input2?.url;
      if (isQuicklookUrl(url)) {
        return origFetch.apply(this, arguments);
      }
      const start = Date.now();
      return origFetch.apply(this, arguments).then(
        (res) => {
          const duration = Date.now() - start;
          res.clone().text().then((t) => {
            captureNetwork((init2?.method || "GET").toUpperCase(), url, res.status, duration, t.length);
          });
          return res;
        },
        () => {
          captureNetwork((init2?.method || "GET").toUpperCase(), url, 0, Date.now() - start, 0);
          throw arguments[0];
        }
      );
    };
    const XHR = window.XMLHttpRequest;
    if (XHR) {
      window.XMLHttpRequest = function() {
        const xhr = new XHR();
        const open = xhr.open;
        let method, url, start;
        xhr.open = function(m, u) {
          method = m;
          url = u;
          return open.apply(this, arguments);
        };
        xhr.addEventListener("loadend", function() {
          if (isQuicklookUrl(url)) return;
          const duration = start ? Date.now() - start : 0;
          captureNetwork(method || "GET", url, xhr.status, duration, xhr.responseText?.length || 0);
        });
        xhr.addEventListener("loadstart", function() {
          start = Date.now();
        });
        return xhr;
      };
    }
  }

  // src/collectors/storage.js
  var VALUE_MAX = 200;
  var BLOCKLIST2 = ["token", "password", "secret", "auth", "key"];
  function blockKey(key) {
    const k = String(key).toLowerCase();
    return BLOCKLIST2.some((b) => k.includes(b));
  }
  function captureStorageSnapshot() {
    if (typeof localStorage === "undefined") return null;
    try {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !blockKey(key)) {
          const v = localStorage.getItem(key);
          out[key] = v != null ? String(v).slice(0, VALUE_MAX) : "";
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  // src/session.js
  var STORAGE_KEY2 = "quicklook_sid";
  var STORAGE_CHAIN_KEY = "quicklook_chain_id";
  var STORAGE_START_TIME_KEY = "quicklook_start_time";
  var sessionId = null;
  var apiUrl = "";
  var projectKey = "";
  var meta = null;
  var user = null;
  var retentionDays = 30;
  var attributes = null;
  var excludedUrls = [];
  var includedUrls = null;
  var started = false;
  var sessionStartTime = null;
  var maxSessionDuration = 60 * 60 * 1e3;
  var sessionChainId = null;
  var parentSessionId = null;
  var sequenceNumber = 1;
  var deviceIdEnabled = false;
  var startPromise = null;
  function getStoredSessionId() {
    try {
      if (typeof sessionStorage === "undefined") return null;
      return sessionStorage.getItem(STORAGE_KEY2);
    } catch {
      return null;
    }
  }
  function setStoredSessionId(id) {
    try {
      if (typeof sessionStorage !== "undefined" && id) sessionStorage.setItem(STORAGE_KEY2, id);
    } catch (_) {
    }
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
    } catch (_) {
    }
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
    } catch (_) {
    }
  }
  function clearSessionStorage() {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY2);
        sessionStorage.removeItem(STORAGE_CHAIN_KEY);
        sessionStorage.removeItem(STORAGE_START_TIME_KEY);
        sessionStorage.removeItem("quicklook_chunk_index");
      }
    } catch (_) {
    }
  }
  function getSessionId() {
    return sessionId;
  }
  function getApiUrl() {
    return apiUrl;
  }
  function setConfig(config) {
    if (config.apiUrl) apiUrl = config.apiUrl.replace(/\/$/, "");
    if (config.projectKey) projectKey = config.projectKey;
    if (config.meta) meta = config.meta;
    if (config.user != null) user = config.user;
    if (config.retentionDays != null) retentionDays = config.retentionDays;
    if (config.attributes !== void 0) attributes = config.attributes;
    if (config.excludedUrls !== void 0) excludedUrls = Array.isArray(config.excludedUrls) ? config.excludedUrls : [];
    if (config.includedUrls !== void 0) {
      includedUrls = Array.isArray(config.includedUrls) && config.includedUrls.length > 0 ? config.includedUrls : null;
    }
    if (config.maxSessionDuration !== void 0) {
      maxSessionDuration = config.maxSessionDuration;
    }
    if (typeof config.deviceIdEnabled === "boolean") deviceIdEnabled = config.deviceIdEnabled;
  }
  function shouldRotateSession() {
    if (!sessionStartTime || !sessionId || maxSessionDuration <= 0) {
      return false;
    }
    const elapsed = Date.now() - sessionStartTime;
    return elapsed >= maxSessionDuration;
  }
  function isPageExcluded(url) {
    if (!url || typeof url !== "string") return false;
    if (excludedUrls && excludedUrls.length > 0 && excludedUrls.some((p) => p && url.includes(p))) return true;
    if (includedUrls && includedUrls.length > 0) {
      return !includedUrls.some((pattern) => pattern && url.includes(pattern));
    }
    return false;
  }
  async function startSession(rotationOptions = null) {
    if (started && sessionId && !rotationOptions) return sessionId;
    if (!apiUrl || !projectKey) return sessionId;
    const stored = getStoredSessionId();
    const storedStartTime = getStoredStartTime();
    if (stored && typeof stored === "string" && stored.length > 0 && !rotationOptions) {
      sessionId = stored;
      started = true;
      sessionStartTime = storedStartTime || Date.now();
      sessionChainId = getStoredChainId();
      return sessionId;
    }
    if (startPromise) {
      return startPromise;
    }
    startPromise = (async () => {
      try {
        const payload = {
          projectKey,
          meta: meta || {},
          user: user || {},
          retentionDays
        };
        if (deviceIdEnabled) {
          const deviceId = getDeviceId();
          if (deviceId) payload.deviceId = deviceId;
        }
        if (attributes != null && typeof attributes === "object" && !Array.isArray(attributes)) {
          payload.attributes = attributes;
        }
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
          keepalive: true
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
      } finally {
        startPromise = null;
      }
      return sessionId;
    })();
    return startPromise;
  }
  async function rotateSession(reason = "duration_limit") {
    if (!sessionId) return null;
    const oldSessionId = sessionId;
    const oldChainId = sessionChainId || oldSessionId;
    const newSequence = sequenceNumber + 1;
    sessionId = null;
    started = false;
    parentSessionId = oldSessionId;
    sequenceNumber = newSequence;
    sessionChainId = oldChainId;
    await startSession({
      parentSessionId: oldSessionId,
      sessionChainId: oldChainId,
      sequenceNumber: newSequence,
      splitReason: reason
    });
    return { oldSessionId, newSessionId: sessionId, sessionChainId: oldChainId, sequenceNumber: newSequence };
  }
  function endSession(payload, { clearStorage = false } = {}) {
    if (!sessionId || !apiUrl) return;
    try {
      const body = JSON.stringify(payload || { status: "close" });
      navigator.sendBeacon(`${apiUrl}/api/quicklook/sessions/${sessionId}/end`, body);
      if (clearStorage) {
        clearSessionStorage();
      }
    } catch (e) {
    }
  }

  // src/activity.js
  var inactivityTimer = null;
  var isPaused = false;
  var inactivityTimeout = 5 * 60 * 1e3;
  var pauseOnHidden = true;
  var activityListenersAttached = false;
  var pauseCallback = null;
  var resumeCallback = null;
  function setActivityCallbacks(onPause, onResume) {
    pauseCallback = onPause;
    resumeCallback = onResume;
  }
  function setActivityConfig(config) {
    if (config.inactivityTimeout !== void 0) {
      inactivityTimeout = config.inactivityTimeout;
    }
    if (config.pauseOnHidden !== void 0) {
      pauseOnHidden = config.pauseOnHidden;
    }
  }
  function isPausedByActivity() {
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
  function startActivityMonitoring() {
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
  function stopActivityMonitoring() {
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

  // node_modules/pako/dist/pako.esm.mjs
  var Z_FIXED$1 = 4;
  var Z_BINARY = 0;
  var Z_TEXT = 1;
  var Z_UNKNOWN$1 = 2;
  function zero$1(buf) {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }
  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  var MIN_MATCH$1 = 3;
  var MAX_MATCH$1 = 258;
  var LENGTH_CODES$1 = 29;
  var LITERALS$1 = 256;
  var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
  var D_CODES$1 = 30;
  var BL_CODES$1 = 19;
  var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
  var MAX_BITS$1 = 15;
  var Buf_size = 16;
  var MAX_BL_BITS = 7;
  var END_BLOCK = 256;
  var REP_3_6 = 16;
  var REPZ_3_10 = 17;
  var REPZ_11_138 = 18;
  var extra_lbits = (
    /* extra bits for each length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0])
  );
  var extra_dbits = (
    /* extra bits for each distance code */
    new Uint8Array([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13])
  );
  var extra_blbits = (
    /* extra bits for each bit length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])
  );
  var bl_order = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var DIST_CODE_LEN = 512;
  var static_ltree = new Array((L_CODES$1 + 2) * 2);
  zero$1(static_ltree);
  var static_dtree = new Array(D_CODES$1 * 2);
  zero$1(static_dtree);
  var _dist_code = new Array(DIST_CODE_LEN);
  zero$1(_dist_code);
  var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
  zero$1(_length_code);
  var base_length = new Array(LENGTH_CODES$1);
  zero$1(base_length);
  var base_dist = new Array(D_CODES$1);
  zero$1(base_dist);
  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;
  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
  var d_code = (dist) => {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  };
  var put_short = (s, w) => {
    s.pending_buf[s.pending++] = w & 255;
    s.pending_buf[s.pending++] = w >>> 8 & 255;
  };
  var send_bits = (s, value, length) => {
    if (s.bi_valid > Buf_size - length) {
      s.bi_buf |= value << s.bi_valid & 65535;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> Buf_size - s.bi_valid;
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= value << s.bi_valid & 65535;
      s.bi_valid += length;
    }
  };
  var send_code = (s, c, tree) => {
    send_bits(
      s,
      tree[c * 2],
      tree[c * 2 + 1]
      /*.Len*/
    );
  };
  var bi_reverse = (code, len) => {
    let res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  };
  var bi_flush = (s) => {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 255;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  };
  var gen_bitlen = (s, desc) => {
    const tree = desc.dyn_tree;
    const max_code = desc.max_code;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const extra = desc.stat_desc.extra_bits;
    const base = desc.stat_desc.extra_base;
    const max_length = desc.stat_desc.max_length;
    let h;
    let n2, m;
    let bits;
    let xbits;
    let f;
    let overflow = 0;
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0;
    }
    tree[s.heap[s.heap_max] * 2 + 1] = 0;
    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n2 = s.heap[h];
      bits = tree[tree[n2 * 2 + 1] * 2 + 1] + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n2 * 2 + 1] = bits;
      if (n2 > max_code) {
        continue;
      }
      s.bl_count[bits]++;
      xbits = 0;
      if (n2 >= base) {
        xbits = extra[n2 - base];
      }
      f = tree[n2 * 2];
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n2 * 2 + 1] + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--;
      s.bl_count[bits + 1] += 2;
      s.bl_count[max_length]--;
      overflow -= 2;
    } while (overflow > 0);
    for (bits = max_length; bits !== 0; bits--) {
      n2 = s.bl_count[bits];
      while (n2 !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] !== bits) {
          s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
          tree[m * 2 + 1] = bits;
        }
        n2--;
      }
    }
  };
  var gen_codes = (tree, max_code, bl_count) => {
    const next_code = new Array(MAX_BITS$1 + 1);
    let code = 0;
    let bits;
    let n2;
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      code = code + bl_count[bits - 1] << 1;
      next_code[bits] = code;
    }
    for (n2 = 0; n2 <= max_code; n2++) {
      let len = tree[n2 * 2 + 1];
      if (len === 0) {
        continue;
      }
      tree[n2 * 2] = bi_reverse(next_code[len]++, len);
    }
  };
  var tr_static_init = () => {
    let n2;
    let bits;
    let length;
    let code;
    let dist;
    const bl_count = new Array(MAX_BITS$1 + 1);
    length = 0;
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length;
      for (n2 = 0; n2 < 1 << extra_lbits[code]; n2++) {
        _length_code[length++] = code;
      }
    }
    _length_code[length - 1] = code;
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n2 = 0; n2 < 1 << extra_dbits[code]; n2++) {
        _dist_code[dist++] = code;
      }
    }
    dist >>= 7;
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7;
      for (n2 = 0; n2 < 1 << extra_dbits[code] - 7; n2++) {
        _dist_code[256 + dist++] = code;
      }
    }
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0;
    }
    n2 = 0;
    while (n2 <= 143) {
      static_ltree[n2 * 2 + 1] = 8;
      n2++;
      bl_count[8]++;
    }
    while (n2 <= 255) {
      static_ltree[n2 * 2 + 1] = 9;
      n2++;
      bl_count[9]++;
    }
    while (n2 <= 279) {
      static_ltree[n2 * 2 + 1] = 7;
      n2++;
      bl_count[7]++;
    }
    while (n2 <= 287) {
      static_ltree[n2 * 2 + 1] = 8;
      n2++;
      bl_count[8]++;
    }
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
    for (n2 = 0; n2 < D_CODES$1; n2++) {
      static_dtree[n2 * 2 + 1] = 5;
      static_dtree[n2 * 2] = bi_reverse(n2, 5);
    }
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
  };
  var init_block = (s) => {
    let n2;
    for (n2 = 0; n2 < L_CODES$1; n2++) {
      s.dyn_ltree[n2 * 2] = 0;
    }
    for (n2 = 0; n2 < D_CODES$1; n2++) {
      s.dyn_dtree[n2 * 2] = 0;
    }
    for (n2 = 0; n2 < BL_CODES$1; n2++) {
      s.bl_tree[n2 * 2] = 0;
    }
    s.dyn_ltree[END_BLOCK * 2] = 1;
    s.opt_len = s.static_len = 0;
    s.sym_next = s.matches = 0;
  };
  var bi_windup = (s) => {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  };
  var smaller = (tree, n2, m, depth) => {
    const _n2 = n2 * 2;
    const _m2 = m * 2;
    return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n2] <= depth[m];
  };
  var pqdownheap = (s, tree, k) => {
    const v = s.heap[k];
    let j = k << 1;
    while (j <= s.heap_len) {
      if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }
      s.heap[k] = s.heap[j];
      k = j;
      j <<= 1;
    }
    s.heap[k] = v;
  };
  var compress_block = (s, ltree, dtree) => {
    let dist;
    let lc;
    let sx = 0;
    let code;
    let extra;
    if (s.sym_next !== 0) {
      do {
        dist = s.pending_buf[s.sym_buf + sx++] & 255;
        dist += (s.pending_buf[s.sym_buf + sx++] & 255) << 8;
        lc = s.pending_buf[s.sym_buf + sx++];
        if (dist === 0) {
          send_code(s, lc, ltree);
        } else {
          code = _length_code[lc];
          send_code(s, code + LITERALS$1 + 1, ltree);
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra);
          }
          dist--;
          code = d_code(dist);
          send_code(s, code, dtree);
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra);
          }
        }
      } while (sx < s.sym_next);
    }
    send_code(s, END_BLOCK, ltree);
  };
  var build_tree = (s, desc) => {
    const tree = desc.dyn_tree;
    const stree = desc.stat_desc.static_tree;
    const has_stree = desc.stat_desc.has_stree;
    const elems = desc.stat_desc.elems;
    let n2, m;
    let max_code = -1;
    let node2;
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE$1;
    for (n2 = 0; n2 < elems; n2++) {
      if (tree[n2 * 2] !== 0) {
        s.heap[++s.heap_len] = max_code = n2;
        s.depth[n2] = 0;
      } else {
        tree[n2 * 2 + 1] = 0;
      }
    }
    while (s.heap_len < 2) {
      node2 = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
      tree[node2 * 2] = 1;
      s.depth[node2] = 0;
      s.opt_len--;
      if (has_stree) {
        s.static_len -= stree[node2 * 2 + 1];
      }
    }
    desc.max_code = max_code;
    for (n2 = s.heap_len >> 1; n2 >= 1; n2--) {
      pqdownheap(s, tree, n2);
    }
    node2 = elems;
    do {
      n2 = s.heap[
        1
        /*SMALLEST*/
      ];
      s.heap[
        1
        /*SMALLEST*/
      ] = s.heap[s.heap_len--];
      pqdownheap(
        s,
        tree,
        1
        /*SMALLEST*/
      );
      m = s.heap[
        1
        /*SMALLEST*/
      ];
      s.heap[--s.heap_max] = n2;
      s.heap[--s.heap_max] = m;
      tree[node2 * 2] = tree[n2 * 2] + tree[m * 2];
      s.depth[node2] = (s.depth[n2] >= s.depth[m] ? s.depth[n2] : s.depth[m]) + 1;
      tree[n2 * 2 + 1] = tree[m * 2 + 1] = node2;
      s.heap[
        1
        /*SMALLEST*/
      ] = node2++;
      pqdownheap(
        s,
        tree,
        1
        /*SMALLEST*/
      );
    } while (s.heap_len >= 2);
    s.heap[--s.heap_max] = s.heap[
      1
      /*SMALLEST*/
    ];
    gen_bitlen(s, desc);
    gen_codes(tree, max_code, s.bl_count);
  };
  var scan_tree = (s, tree, max_code) => {
    let n2;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count2 = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] = 65535;
    for (n2 = 0; n2 <= max_code; n2++) {
      curlen = nextlen;
      nextlen = tree[(n2 + 1) * 2 + 1];
      if (++count2 < max_count && curlen === nextlen) {
        continue;
      } else if (count2 < min_count) {
        s.bl_tree[curlen * 2] += count2;
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2]++;
        }
        s.bl_tree[REP_3_6 * 2]++;
      } else if (count2 <= 10) {
        s.bl_tree[REPZ_3_10 * 2]++;
      } else {
        s.bl_tree[REPZ_11_138 * 2]++;
      }
      count2 = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  };
  var send_tree = (s, tree, max_code) => {
    let n2;
    let prevlen = -1;
    let curlen;
    let nextlen = tree[0 * 2 + 1];
    let count2 = 0;
    let max_count = 7;
    let min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    for (n2 = 0; n2 <= max_code; n2++) {
      curlen = nextlen;
      nextlen = tree[(n2 + 1) * 2 + 1];
      if (++count2 < max_count && curlen === nextlen) {
        continue;
      } else if (count2 < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count2 !== 0);
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count2--;
        }
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count2 - 3, 2);
      } else if (count2 <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count2 - 3, 3);
      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count2 - 11, 7);
      }
      count2 = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  };
  var build_bl_tree = (s) => {
    let max_blindex;
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
    build_tree(s, s.bl_desc);
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
        break;
      }
    }
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    return max_blindex;
  };
  var send_all_trees = (s, lcodes, dcodes, blcodes) => {
    let rank2;
    send_bits(s, lcodes - 257, 5);
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4);
    for (rank2 = 0; rank2 < blcodes; rank2++) {
      send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
    }
    send_tree(s, s.dyn_ltree, lcodes - 1);
    send_tree(s, s.dyn_dtree, dcodes - 1);
  };
  var detect_data_type = (s) => {
    let block_mask = 4093624447;
    let n2;
    for (n2 = 0; n2 <= 31; n2++, block_mask >>>= 1) {
      if (block_mask & 1 && s.dyn_ltree[n2 * 2] !== 0) {
        return Z_BINARY;
      }
    }
    if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
      return Z_TEXT;
    }
    for (n2 = 32; n2 < LITERALS$1; n2++) {
      if (s.dyn_ltree[n2 * 2] !== 0) {
        return Z_TEXT;
      }
    }
    return Z_BINARY;
  };
  var static_init_done = false;
  var _tr_init$1 = (s) => {
    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }
    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
    s.bi_buf = 0;
    s.bi_valid = 0;
    init_block(s);
  };
  var _tr_stored_block$1 = (s, buf, stored_len, last) => {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
    bi_windup(s);
    put_short(s, stored_len);
    put_short(s, ~stored_len);
    if (stored_len) {
      s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending);
    }
    s.pending += stored_len;
  };
  var _tr_align$1 = (s) => {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  };
  var _tr_flush_block$1 = (s, buf, stored_len, last) => {
    let opt_lenb, static_lenb;
    let max_blindex = 0;
    if (s.level > 0) {
      if (s.strm.data_type === Z_UNKNOWN$1) {
        s.strm.data_type = detect_data_type(s);
      }
      build_tree(s, s.l_desc);
      build_tree(s, s.d_desc);
      max_blindex = build_bl_tree(s);
      opt_lenb = s.opt_len + 3 + 7 >>> 3;
      static_lenb = s.static_len + 3 + 7 >>> 3;
      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }
    } else {
      opt_lenb = static_lenb = stored_len + 5;
    }
    if (stored_len + 4 <= opt_lenb && buf !== -1) {
      _tr_stored_block$1(s, buf, stored_len, last);
    } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    init_block(s);
    if (last) {
      bi_windup(s);
    }
  };
  var _tr_tally$1 = (s, dist, lc) => {
    s.pending_buf[s.sym_buf + s.sym_next++] = dist;
    s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8;
    s.pending_buf[s.sym_buf + s.sym_next++] = lc;
    if (dist === 0) {
      s.dyn_ltree[lc * 2]++;
    } else {
      s.matches++;
      dist--;
      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
      s.dyn_dtree[d_code(dist) * 2]++;
    }
    return s.sym_next === s.sym_end;
  };
  var _tr_init_1 = _tr_init$1;
  var _tr_stored_block_1 = _tr_stored_block$1;
  var _tr_flush_block_1 = _tr_flush_block$1;
  var _tr_tally_1 = _tr_tally$1;
  var _tr_align_1 = _tr_align$1;
  var trees = {
    _tr_init: _tr_init_1,
    _tr_stored_block: _tr_stored_block_1,
    _tr_flush_block: _tr_flush_block_1,
    _tr_tally: _tr_tally_1,
    _tr_align: _tr_align_1
  };
  var adler32 = (adler, buf, len, pos) => {
    let s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n2 = 0;
    while (len !== 0) {
      n2 = len > 2e3 ? 2e3 : len;
      len -= n2;
      do {
        s1 = s1 + buf[pos++] | 0;
        s2 = s2 + s1 | 0;
      } while (--n2);
      s1 %= 65521;
      s2 %= 65521;
    }
    return s1 | s2 << 16 | 0;
  };
  var adler32_1 = adler32;
  var makeTable = () => {
    let c, table = [];
    for (var n2 = 0; n2 < 256; n2++) {
      c = n2;
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n2] = c;
    }
    return table;
  };
  var crcTable = new Uint32Array(makeTable());
  var crc32 = (crc, buf, len, pos) => {
    const t = crcTable;
    const end = pos + len;
    crc ^= -1;
    for (let i = pos; i < end; i++) {
      crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
    }
    return crc ^ -1;
  };
  var crc32_1 = crc32;
  var messages = {
    2: "need dictionary",
    /* Z_NEED_DICT       2  */
    1: "stream end",
    /* Z_STREAM_END      1  */
    0: "",
    /* Z_OK              0  */
    "-1": "file error",
    /* Z_ERRNO         (-1) */
    "-2": "stream error",
    /* Z_STREAM_ERROR  (-2) */
    "-3": "data error",
    /* Z_DATA_ERROR    (-3) */
    "-4": "insufficient memory",
    /* Z_MEM_ERROR     (-4) */
    "-5": "buffer error",
    /* Z_BUF_ERROR     (-5) */
    "-6": "incompatible version"
    /* Z_VERSION_ERROR (-6) */
  };
  var constants$2 = {
    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    //Z_VERSION_ERROR: -6,
    /* compression levels */
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY: 0,
    Z_TEXT: 1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN: 2,
    /* The deflate compression method */
    Z_DEFLATED: 8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
  };
  var { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } = trees;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$2,
    Z_PARTIAL_FLUSH,
    Z_FULL_FLUSH: Z_FULL_FLUSH$1,
    Z_FINISH: Z_FINISH$3,
    Z_BLOCK: Z_BLOCK$1,
    Z_OK: Z_OK$3,
    Z_STREAM_END: Z_STREAM_END$3,
    Z_STREAM_ERROR: Z_STREAM_ERROR$2,
    Z_DATA_ERROR: Z_DATA_ERROR$2,
    Z_BUF_ERROR: Z_BUF_ERROR$1,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
    Z_FILTERED,
    Z_HUFFMAN_ONLY,
    Z_RLE,
    Z_FIXED,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
    Z_UNKNOWN,
    Z_DEFLATED: Z_DEFLATED$2
  } = constants$2;
  var MAX_MEM_LEVEL = 9;
  var MAX_WBITS$1 = 15;
  var DEF_MEM_LEVEL = 8;
  var LENGTH_CODES = 29;
  var LITERALS = 256;
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  var D_CODES = 30;
  var BL_CODES = 19;
  var HEAP_SIZE = 2 * L_CODES + 1;
  var MAX_BITS = 15;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
  var PRESET_DICT = 32;
  var INIT_STATE = 42;
  var GZIP_STATE = 57;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;
  var BS_NEED_MORE = 1;
  var BS_BLOCK_DONE = 2;
  var BS_FINISH_STARTED = 3;
  var BS_FINISH_DONE = 4;
  var OS_CODE = 3;
  var err = (strm, errorCode) => {
    strm.msg = messages[errorCode];
    return errorCode;
  };
  var rank = (f) => {
    return f * 2 - (f > 4 ? 9 : 0);
  };
  var zero = (buf) => {
    let len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  };
  var slide_hash = (s) => {
    let n2, m;
    let p;
    let wsize = s.w_size;
    n2 = s.hash_size;
    p = n2;
    do {
      m = s.head[--p];
      s.head[p] = m >= wsize ? m - wsize : 0;
    } while (--n2);
    n2 = wsize;
    p = n2;
    do {
      m = s.prev[--p];
      s.prev[p] = m >= wsize ? m - wsize : 0;
    } while (--n2);
  };
  var HASH_ZLIB = (s, prev, data) => (prev << s.hash_shift ^ data) & s.hash_mask;
  var HASH = HASH_ZLIB;
  var flush_pending = (strm) => {
    const s = strm.state;
    let len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) {
      return;
    }
    strm.output.set(s.pending_buf.subarray(s.pending_out, s.pending_out + len), strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  };
  var flush_block_only = (s, last) => {
    _tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  };
  var put_byte = (s, b) => {
    s.pending_buf[s.pending++] = b;
  };
  var putShortMSB = (s, b) => {
    s.pending_buf[s.pending++] = b >>> 8 & 255;
    s.pending_buf[s.pending++] = b & 255;
  };
  var read_buf = (strm, buf, start, size) => {
    let len = strm.avail_in;
    if (len > size) {
      len = size;
    }
    if (len === 0) {
      return 0;
    }
    strm.avail_in -= len;
    buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32_1(strm.adler, buf, len, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32_1(strm.adler, buf, len, start);
    }
    strm.next_in += len;
    strm.total_in += len;
    return len;
  };
  var longest_match = (s, cur_match) => {
    let chain_length = s.max_chain_length;
    let scan = s.strstart;
    let match;
    let len;
    let best_len = s.prev_length;
    let nice_match = s.nice_match;
    const limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
    const _win = s.window;
    const wmask = s.w_mask;
    const prev = s.prev;
    const strend = s.strstart + MAX_MATCH;
    let scan_end1 = _win[scan + best_len - 1];
    let scan_end = _win[scan + best_len];
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }
    do {
      match = cur_match;
      if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
        continue;
      }
      scan += 2;
      match++;
      do {
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;
      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  };
  var fill_window = (s) => {
    const _w_size = s.w_size;
    let n2, more, str;
    do {
      more = s.window_size - s.lookahead - s.strstart;
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
        s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        s.block_start -= _w_size;
        if (s.insert > s.strstart) {
          s.insert = s.strstart;
        }
        slide_hash(s);
        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }
      n2 = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n2;
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];
        s.ins_h = HASH(s, s.ins_h, s.window[str + 1]);
        while (s.insert) {
          s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
  };
  var deflate_stored = (s, flush2) => {
    let min_block = s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5;
    let len, left, have, last = 0;
    let used = s.strm.avail_in;
    do {
      len = 65535;
      have = s.bi_valid + 42 >> 3;
      if (s.strm.avail_out < have) {
        break;
      }
      have = s.strm.avail_out - have;
      left = s.strstart - s.block_start;
      if (len > left + s.strm.avail_in) {
        len = left + s.strm.avail_in;
      }
      if (len > have) {
        len = have;
      }
      if (len < min_block && (len === 0 && flush2 !== Z_FINISH$3 || flush2 === Z_NO_FLUSH$2 || len !== left + s.strm.avail_in)) {
        break;
      }
      last = flush2 === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0;
      _tr_stored_block(s, 0, 0, last);
      s.pending_buf[s.pending - 4] = len;
      s.pending_buf[s.pending - 3] = len >> 8;
      s.pending_buf[s.pending - 2] = ~len;
      s.pending_buf[s.pending - 1] = ~len >> 8;
      flush_pending(s.strm);
      if (left) {
        if (left > len) {
          left = len;
        }
        s.strm.output.set(s.window.subarray(s.block_start, s.block_start + left), s.strm.next_out);
        s.strm.next_out += left;
        s.strm.avail_out -= left;
        s.strm.total_out += left;
        s.block_start += left;
        len -= left;
      }
      if (len) {
        read_buf(s.strm, s.strm.output, s.strm.next_out, len);
        s.strm.next_out += len;
        s.strm.avail_out -= len;
        s.strm.total_out += len;
      }
    } while (last === 0);
    used -= s.strm.avail_in;
    if (used) {
      if (used >= s.w_size) {
        s.matches = 2;
        s.window.set(s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in), 0);
        s.strstart = s.w_size;
        s.insert = s.strstart;
      } else {
        if (s.window_size - s.strstart <= used) {
          s.strstart -= s.w_size;
          s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
          if (s.matches < 2) {
            s.matches++;
          }
          if (s.insert > s.strstart) {
            s.insert = s.strstart;
          }
        }
        s.window.set(s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in), s.strstart);
        s.strstart += used;
        s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used;
      }
      s.block_start = s.strstart;
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart;
    }
    if (last) {
      return BS_FINISH_DONE;
    }
    if (flush2 !== Z_NO_FLUSH$2 && flush2 !== Z_FINISH$3 && s.strm.avail_in === 0 && s.strstart === s.block_start) {
      return BS_BLOCK_DONE;
    }
    have = s.window_size - s.strstart;
    if (s.strm.avail_in > have && s.block_start >= s.w_size) {
      s.block_start -= s.w_size;
      s.strstart -= s.w_size;
      s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0);
      if (s.matches < 2) {
        s.matches++;
      }
      have += s.w_size;
      if (s.insert > s.strstart) {
        s.insert = s.strstart;
      }
    }
    if (have > s.strm.avail_in) {
      have = s.strm.avail_in;
    }
    if (have) {
      read_buf(s.strm, s.window, s.strstart, have);
      s.strstart += have;
      s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have;
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart;
    }
    have = s.bi_valid + 42 >> 3;
    have = s.pending_buf_size - have > 65535 ? 65535 : s.pending_buf_size - have;
    min_block = have > s.w_size ? s.w_size : have;
    left = s.strstart - s.block_start;
    if (left >= min_block || (left || flush2 === Z_FINISH$3) && flush2 !== Z_NO_FLUSH$2 && s.strm.avail_in === 0 && left <= have) {
      len = left > have ? have : left;
      last = flush2 === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0;
      _tr_stored_block(s, s.block_start, len, last);
      s.block_start += len;
      flush_pending(s.strm);
    }
    return last ? BS_FINISH_STARTED : BS_NEED_MORE;
  };
  var deflate_fast = (s, flush2) => {
    let hash_head;
    let bflush;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush2 === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
          s.match_length--;
          do {
            s.strstart++;
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1]);
        }
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush2 === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_slow = (s, flush2) => {
    let hash_head;
    let bflush;
    let max_insert;
    for (; ; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush2 === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;
      if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
        if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
          s.match_length = MIN_MATCH - 1;
        }
      }
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1]);
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      } else if (s.match_available) {
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
        if (bflush) {
          flush_block_only(s, false);
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    if (s.match_available) {
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);
      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush2 === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_rle = (s, flush2) => {
    let bflush;
    let prev;
    let scan, strend;
    const _win = s.window;
    for (; ; ) {
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush2 === Z_NO_FLUSH$2) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
          } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        bflush = _tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush2 === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  var deflate_huff = (s, flush2) => {
    let bflush;
    for (; ; ) {
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush2 === Z_NO_FLUSH$2) {
            return BS_NEED_MORE;
          }
          break;
        }
      }
      s.match_length = 0;
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush2 === Z_FINISH$3) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.sym_next) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  };
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
  var configuration_table = [
    /*      good lazy nice chain */
    new Config(0, 0, 0, 0, deflate_stored),
    /* 0 store only */
    new Config(4, 4, 8, 4, deflate_fast),
    /* 1 max speed, no lazy matches */
    new Config(4, 5, 16, 8, deflate_fast),
    /* 2 */
    new Config(4, 6, 32, 32, deflate_fast),
    /* 3 */
    new Config(4, 4, 16, 16, deflate_slow),
    /* 4 lazy matches */
    new Config(8, 16, 32, 32, deflate_slow),
    /* 5 */
    new Config(8, 16, 128, 128, deflate_slow),
    /* 6 */
    new Config(8, 32, 128, 256, deflate_slow),
    /* 7 */
    new Config(32, 128, 258, 1024, deflate_slow),
    /* 8 */
    new Config(32, 258, 258, 4096, deflate_slow)
    /* 9 max compression */
  ];
  var lm_init = (s) => {
    s.window_size = 2 * s.w_size;
    zero(s.head);
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;
    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  };
  function DeflateState() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = Z_DEFLATED$2;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2);
    this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2);
    this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = new Uint16Array(MAX_BITS + 1);
    this.heap = new Uint16Array(2 * L_CODES + 1);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = new Uint16Array(2 * L_CODES + 1);
    zero(this.depth);
    this.sym_buf = 0;
    this.lit_bufsize = 0;
    this.sym_next = 0;
    this.sym_end = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
  var deflateStateCheck = (strm) => {
    if (!strm) {
      return 1;
    }
    const s = strm.state;
    if (!s || s.strm !== strm || s.status !== INIT_STATE && //#ifdef GZIP
    s.status !== GZIP_STATE && //#endif
    s.status !== EXTRA_STATE && s.status !== NAME_STATE && s.status !== COMMENT_STATE && s.status !== HCRC_STATE && s.status !== BUSY_STATE && s.status !== FINISH_STATE) {
      return 1;
    }
    return 0;
  };
  var deflateResetKeep = (strm) => {
    if (deflateStateCheck(strm)) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN;
    const s = strm.state;
    s.pending = 0;
    s.pending_out = 0;
    if (s.wrap < 0) {
      s.wrap = -s.wrap;
    }
    s.status = //#ifdef GZIP
    s.wrap === 2 ? GZIP_STATE : (
      //#endif
      s.wrap ? INIT_STATE : BUSY_STATE
    );
    strm.adler = s.wrap === 2 ? 0 : 1;
    s.last_flush = -2;
    _tr_init(s);
    return Z_OK$3;
  };
  var deflateReset = (strm) => {
    const ret = deflateResetKeep(strm);
    if (ret === Z_OK$3) {
      lm_init(strm.state);
    }
    return ret;
  };
  var deflateSetHeader = (strm, head) => {
    if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
      return Z_STREAM_ERROR$2;
    }
    strm.state.gzhead = head;
    return Z_OK$3;
  };
  var deflateInit2 = (strm, level, method, windowBits, memLevel, strategy) => {
    if (!strm) {
      return Z_STREAM_ERROR$2;
    }
    let wrap = 1;
    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6;
    }
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap = 2;
      windowBits -= 16;
    }
    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED || windowBits === 8 && wrap !== 1) {
      return err(strm, Z_STREAM_ERROR$2);
    }
    if (windowBits === 8) {
      windowBits = 9;
    }
    const s = new DeflateState();
    strm.state = s;
    s.strm = strm;
    s.status = INIT_STATE;
    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;
    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
    s.window = new Uint8Array(s.w_size * 2);
    s.head = new Uint16Array(s.hash_size);
    s.prev = new Uint16Array(s.w_size);
    s.lit_bufsize = 1 << memLevel + 6;
    s.pending_buf_size = s.lit_bufsize * 4;
    s.pending_buf = new Uint8Array(s.pending_buf_size);
    s.sym_buf = s.lit_bufsize;
    s.sym_end = (s.lit_bufsize - 1) * 3;
    s.level = level;
    s.strategy = strategy;
    s.method = method;
    return deflateReset(strm);
  };
  var deflateInit = (strm, level) => {
    return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
  };
  var deflate$2 = (strm, flush2) => {
    if (deflateStateCheck(strm) || flush2 > Z_BLOCK$1 || flush2 < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    if (!strm.output || strm.avail_in !== 0 && !strm.input || s.status === FINISH_STATE && flush2 !== Z_FINISH$3) {
      return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2);
    }
    const old_flush = s.last_flush;
    s.last_flush = flush2;
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    } else if (strm.avail_in === 0 && rank(flush2) <= rank(old_flush) && flush2 !== Z_FINISH$3) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$1);
    }
    if (s.status === INIT_STATE && s.wrap === 0) {
      s.status = BUSY_STATE;
    }
    if (s.status === INIT_STATE) {
      let header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
      let level_flags = -1;
      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= level_flags << 6;
      if (s.strstart !== 0) {
        header |= PRESET_DICT;
      }
      header += 31 - header % 31;
      putShortMSB(s, header);
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      strm.adler = 1;
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
    if (s.status === GZIP_STATE) {
      strm.adler = 0;
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) {
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
        flush_pending(strm);
        if (s.pending !== 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      } else {
        put_byte(
          s,
          (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 255);
        put_byte(s, s.gzhead.time >> 8 & 255);
        put_byte(s, s.gzhead.time >> 16 & 255);
        put_byte(s, s.gzhead.time >> 24 & 255);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, s.gzhead.os & 255);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 255);
          put_byte(s, s.gzhead.extra.length >> 8 & 255);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra) {
        let beg = s.pending;
        let left = (s.gzhead.extra.length & 65535) - s.gzindex;
        while (s.pending + left > s.pending_buf_size) {
          let copy = s.pending_buf_size - s.pending;
          s.pending_buf.set(s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy), s.pending);
          s.pending = s.pending_buf_size;
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          s.gzindex += copy;
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
          beg = 0;
          left -= copy;
        }
        let gzhead_extra = new Uint8Array(s.gzhead.extra);
        s.pending_buf.set(gzhead_extra.subarray(s.gzindex, s.gzindex + left), s.pending);
        s.pending += left;
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex = 0;
      }
      s.status = NAME_STATE;
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name) {
        let beg = s.pending;
        let val;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return Z_OK$3;
            }
            beg = 0;
          }
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        s.gzindex = 0;
      }
      s.status = COMMENT_STATE;
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment) {
        let beg = s.pending;
        let val;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            if (s.pending !== 0) {
              s.last_flush = -1;
              return Z_OK$3;
            }
            beg = 0;
          }
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
      }
      s.status = HCRC_STATE;
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
          if (s.pending !== 0) {
            s.last_flush = -1;
            return Z_OK$3;
          }
        }
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        strm.adler = 0;
      }
      s.status = BUSY_STATE;
      flush_pending(strm);
      if (s.pending !== 0) {
        s.last_flush = -1;
        return Z_OK$3;
      }
    }
    if (strm.avail_in !== 0 || s.lookahead !== 0 || flush2 !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE) {
      let bstate = s.level === 0 ? deflate_stored(s, flush2) : s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush2) : s.strategy === Z_RLE ? deflate_rle(s, flush2) : configuration_table[s.level].func(s, flush2);
      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
        }
        return Z_OK$3;
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush2 === Z_PARTIAL_FLUSH) {
          _tr_align(s);
        } else if (flush2 !== Z_BLOCK$1) {
          _tr_stored_block(s, 0, 0, false);
          if (flush2 === Z_FULL_FLUSH$1) {
            zero(s.head);
            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK$3;
        }
      }
    }
    if (flush2 !== Z_FINISH$3) {
      return Z_OK$3;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$3;
    }
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      put_byte(s, strm.adler >> 16 & 255);
      put_byte(s, strm.adler >> 24 & 255);
      put_byte(s, strm.total_in & 255);
      put_byte(s, strm.total_in >> 8 & 255);
      put_byte(s, strm.total_in >> 16 & 255);
      put_byte(s, strm.total_in >> 24 & 255);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    flush_pending(strm);
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3;
  };
  var deflateEnd = (strm) => {
    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2;
    }
    const status = strm.state.status;
    strm.state = null;
    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3;
  };
  var deflateSetDictionary = (strm, dictionary) => {
    let dictLength = dictionary.length;
    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2;
    }
    const s = strm.state;
    const wrap = s.wrap;
    if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
      return Z_STREAM_ERROR$2;
    }
    if (wrap === 1) {
      strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0);
    }
    s.wrap = 0;
    if (dictLength >= s.w_size) {
      if (wrap === 0) {
        zero(s.head);
        s.strstart = 0;
        s.block_start = 0;
        s.insert = 0;
      }
      let tmpDict = new Uint8Array(s.w_size);
      tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0);
      dictionary = tmpDict;
      dictLength = s.w_size;
    }
    const avail = strm.avail_in;
    const next = strm.next_in;
    const input2 = strm.input;
    strm.avail_in = dictLength;
    strm.next_in = 0;
    strm.input = dictionary;
    fill_window(s);
    while (s.lookahead >= MIN_MATCH) {
      let str = s.strstart;
      let n2 = s.lookahead - (MIN_MATCH - 1);
      do {
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1]);
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
      } while (--n2);
      s.strstart = str;
      s.lookahead = MIN_MATCH - 1;
      fill_window(s);
    }
    s.strstart += s.lookahead;
    s.block_start = s.strstart;
    s.insert = s.lookahead;
    s.lookahead = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    strm.next_in = next;
    strm.input = input2;
    strm.avail_in = avail;
    s.wrap = wrap;
    return Z_OK$3;
  };
  var deflateInit_1 = deflateInit;
  var deflateInit2_1 = deflateInit2;
  var deflateReset_1 = deflateReset;
  var deflateResetKeep_1 = deflateResetKeep;
  var deflateSetHeader_1 = deflateSetHeader;
  var deflate_2$1 = deflate$2;
  var deflateEnd_1 = deflateEnd;
  var deflateSetDictionary_1 = deflateSetDictionary;
  var deflateInfo = "pako deflate (from Nodeca project)";
  var deflate_1$2 = {
    deflateInit: deflateInit_1,
    deflateInit2: deflateInit2_1,
    deflateReset: deflateReset_1,
    deflateResetKeep: deflateResetKeep_1,
    deflateSetHeader: deflateSetHeader_1,
    deflate: deflate_2$1,
    deflateEnd: deflateEnd_1,
    deflateSetDictionary: deflateSetDictionary_1,
    deflateInfo
  };
  var _has = (obj, key) => {
    return Object.prototype.hasOwnProperty.call(obj, key);
  };
  var assign = function(obj) {
    const sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      const source = sources.shift();
      if (!source) {
        continue;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be non-object");
      }
      for (const p in source) {
        if (_has(source, p)) {
          obj[p] = source[p];
        }
      }
    }
    return obj;
  };
  var flattenChunks = (chunks) => {
    let len = 0;
    for (let i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }
    const result2 = new Uint8Array(len);
    for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
      let chunk = chunks[i];
      result2.set(chunk, pos);
      pos += chunk.length;
    }
    return result2;
  };
  var common = {
    assign,
    flattenChunks
  };
  var STR_APPLY_UIA_OK = true;
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch (__) {
    STR_APPLY_UIA_OK = false;
  }
  var _utf8len = new Uint8Array(256);
  for (let q = 0; q < 256; q++) {
    _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
  }
  _utf8len[254] = _utf8len[254] = 1;
  var string2buf = (str) => {
    if (typeof TextEncoder === "function" && TextEncoder.prototype.encode) {
      return new TextEncoder().encode(str);
    }
    let buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    buf = new Uint8Array(buf_len);
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      if (c < 128) {
        buf[i++] = c;
      } else if (c < 2048) {
        buf[i++] = 192 | c >>> 6;
        buf[i++] = 128 | c & 63;
      } else if (c < 65536) {
        buf[i++] = 224 | c >>> 12;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      } else {
        buf[i++] = 240 | c >>> 18;
        buf[i++] = 128 | c >>> 12 & 63;
        buf[i++] = 128 | c >>> 6 & 63;
        buf[i++] = 128 | c & 63;
      }
    }
    return buf;
  };
  var buf2binstring = (buf, len) => {
    if (len < 65534) {
      if (buf.subarray && STR_APPLY_UIA_OK) {
        return String.fromCharCode.apply(null, buf.length === len ? buf : buf.subarray(0, len));
      }
    }
    let result2 = "";
    for (let i = 0; i < len; i++) {
      result2 += String.fromCharCode(buf[i]);
    }
    return result2;
  };
  var buf2string = (buf, max) => {
    const len = max || buf.length;
    if (typeof TextDecoder === "function" && TextDecoder.prototype.decode) {
      return new TextDecoder().decode(buf.subarray(0, max));
    }
    let i, out;
    const utf16buf = new Array(len * 2);
    for (out = 0, i = 0; i < len; ) {
      let c = buf[i++];
      if (c < 128) {
        utf16buf[out++] = c;
        continue;
      }
      let c_len = _utf8len[c];
      if (c_len > 4) {
        utf16buf[out++] = 65533;
        i += c_len - 1;
        continue;
      }
      c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i < len) {
        c = c << 6 | buf[i++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out++] = 65533;
        continue;
      }
      if (c < 65536) {
        utf16buf[out++] = c;
      } else {
        c -= 65536;
        utf16buf[out++] = 55296 | c >> 10 & 1023;
        utf16buf[out++] = 56320 | c & 1023;
      }
    }
    return buf2binstring(utf16buf, out);
  };
  var utf8border = (buf, max) => {
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    let pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len[buf[pos]] > max ? pos : max;
  };
  var strings = {
    string2buf,
    buf2string,
    utf8border
  };
  function ZStream() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
  var zstream = ZStream;
  var toString$1 = Object.prototype.toString;
  var {
    Z_NO_FLUSH: Z_NO_FLUSH$1,
    Z_SYNC_FLUSH,
    Z_FULL_FLUSH,
    Z_FINISH: Z_FINISH$2,
    Z_OK: Z_OK$2,
    Z_STREAM_END: Z_STREAM_END$2,
    Z_DEFAULT_COMPRESSION,
    Z_DEFAULT_STRATEGY,
    Z_DEFLATED: Z_DEFLATED$1
  } = constants$2;
  function Deflate$1(options) {
    this.options = common.assign({
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED$1,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY
    }, options || {});
    let opt = this.options;
    if (opt.raw && opt.windowBits > 0) {
      opt.windowBits = -opt.windowBits;
    } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
      opt.windowBits += 16;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = deflate_1$2.deflateInit2(
      this.strm,
      opt.level,
      opt.method,
      opt.windowBits,
      opt.memLevel,
      opt.strategy
    );
    if (status !== Z_OK$2) {
      throw new Error(messages[status]);
    }
    if (opt.header) {
      deflate_1$2.deflateSetHeader(this.strm, opt.header);
    }
    if (opt.dictionary) {
      let dict;
      if (typeof opt.dictionary === "string") {
        dict = strings.string2buf(opt.dictionary);
      } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
        dict = new Uint8Array(opt.dictionary);
      } else {
        dict = opt.dictionary;
      }
      status = deflate_1$2.deflateSetDictionary(this.strm, dict);
      if (status !== Z_OK$2) {
        throw new Error(messages[status]);
      }
      this._dict_set = true;
    }
  }
  Deflate$1.prototype.push = function(data, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    let status, _flush_mode;
    if (this.ended) {
      return false;
    }
    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1;
    if (typeof data === "string") {
      strm.input = strings.string2buf(data);
    } else if (toString$1.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      if ((_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) && strm.avail_out <= 6) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      status = deflate_1$2.deflate(strm, _flush_mode);
      if (status === Z_STREAM_END$2) {
        if (strm.next_out > 0) {
          this.onData(strm.output.subarray(0, strm.next_out));
        }
        status = deflate_1$2.deflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return status === Z_OK$2;
      }
      if (strm.avail_out === 0) {
        this.onData(strm.output);
        continue;
      }
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out));
        strm.avail_out = 0;
        continue;
      }
      if (strm.avail_in === 0) break;
    }
    return true;
  };
  Deflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Deflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK$2) {
      this.result = common.flattenChunks(this.chunks);
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function deflate$1(input2, options) {
    const deflator = new Deflate$1(options);
    deflator.push(input2, true);
    if (deflator.err) {
      throw deflator.msg || messages[deflator.err];
    }
    return deflator.result;
  }
  function deflateRaw$1(input2, options) {
    options = options || {};
    options.raw = true;
    return deflate$1(input2, options);
  }
  function gzip$1(input2, options) {
    options = options || {};
    options.gzip = true;
    return deflate$1(input2, options);
  }
  var Deflate_1$1 = Deflate$1;
  var deflate_2 = deflate$1;
  var deflateRaw_1$1 = deflateRaw$1;
  var gzip_1$1 = gzip$1;
  var constants$1 = constants$2;
  var deflate_1$1 = {
    Deflate: Deflate_1$1,
    deflate: deflate_2,
    deflateRaw: deflateRaw_1$1,
    gzip: gzip_1$1,
    constants: constants$1
  };
  var BAD$1 = 16209;
  var TYPE$1 = 16191;
  var inffast = function inflate_fast(strm, start) {
    let _in;
    let last;
    let _out;
    let beg;
    let end;
    let dmax;
    let wsize;
    let whave;
    let wnext;
    let s_window;
    let hold;
    let bits;
    let lcode;
    let dcode;
    let lmask;
    let dmask;
    let here;
    let op;
    let len;
    let dist;
    let from;
    let from_source;
    let input2, output;
    const state = strm.state;
    _in = strm.next_in;
    input2 = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    dmax = state.dmax;
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;
    top:
      do {
        if (bits < 15) {
          hold += input2[_in++] << bits;
          bits += 8;
          hold += input2[_in++] << bits;
          bits += 8;
        }
        here = lcode[hold & lmask];
        dolen:
          for (; ; ) {
            op = here >>> 24;
            hold >>>= op;
            bits -= op;
            op = here >>> 16 & 255;
            if (op === 0) {
              output[_out++] = here & 65535;
            } else if (op & 16) {
              len = here & 65535;
              op &= 15;
              if (op) {
                if (bits < op) {
                  hold += input2[_in++] << bits;
                  bits += 8;
                }
                len += hold & (1 << op) - 1;
                hold >>>= op;
                bits -= op;
              }
              if (bits < 15) {
                hold += input2[_in++] << bits;
                bits += 8;
                hold += input2[_in++] << bits;
                bits += 8;
              }
              here = dcode[hold & dmask];
              dodist:
                for (; ; ) {
                  op = here >>> 24;
                  hold >>>= op;
                  bits -= op;
                  op = here >>> 16 & 255;
                  if (op & 16) {
                    dist = here & 65535;
                    op &= 15;
                    if (bits < op) {
                      hold += input2[_in++] << bits;
                      bits += 8;
                      if (bits < op) {
                        hold += input2[_in++] << bits;
                        bits += 8;
                      }
                    }
                    dist += hold & (1 << op) - 1;
                    if (dist > dmax) {
                      strm.msg = "invalid distance too far back";
                      state.mode = BAD$1;
                      break top;
                    }
                    hold >>>= op;
                    bits -= op;
                    op = _out - beg;
                    if (dist > op) {
                      op = dist - op;
                      if (op > whave) {
                        if (state.sane) {
                          strm.msg = "invalid distance too far back";
                          state.mode = BAD$1;
                          break top;
                        }
                      }
                      from = 0;
                      from_source = s_window;
                      if (wnext === 0) {
                        from += wsize - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      } else if (wnext < op) {
                        from += wsize + wnext - op;
                        op -= wnext;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = 0;
                          if (wnext < len) {
                            op = wnext;
                            len -= op;
                            do {
                              output[_out++] = s_window[from++];
                            } while (--op);
                            from = _out - dist;
                            from_source = output;
                          }
                        }
                      } else {
                        from += wnext - op;
                        if (op < len) {
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                      while (len > 2) {
                        output[_out++] = from_source[from++];
                        output[_out++] = from_source[from++];
                        output[_out++] = from_source[from++];
                        len -= 3;
                      }
                      if (len) {
                        output[_out++] = from_source[from++];
                        if (len > 1) {
                          output[_out++] = from_source[from++];
                        }
                      }
                    } else {
                      from = _out - dist;
                      do {
                        output[_out++] = output[from++];
                        output[_out++] = output[from++];
                        output[_out++] = output[from++];
                        len -= 3;
                      } while (len > 2);
                      if (len) {
                        output[_out++] = output[from++];
                        if (len > 1) {
                          output[_out++] = output[from++];
                        }
                      }
                    }
                  } else if ((op & 64) === 0) {
                    here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                    continue dodist;
                  } else {
                    strm.msg = "invalid distance code";
                    state.mode = BAD$1;
                    break top;
                  }
                  break;
                }
            } else if ((op & 64) === 0) {
              here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
              continue dolen;
            } else if (op & 32) {
              state.mode = TYPE$1;
              break top;
            } else {
              strm.msg = "invalid literal/length code";
              state.mode = BAD$1;
              break top;
            }
            break;
          }
      } while (_in < last && _out < end);
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
    strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
    state.hold = hold;
    state.bits = bits;
    return;
  };
  var MAXBITS = 15;
  var ENOUGH_LENS$1 = 852;
  var ENOUGH_DISTS$1 = 592;
  var CODES$1 = 0;
  var LENS$1 = 1;
  var DISTS$1 = 2;
  var lbase = new Uint16Array([
    /* Length codes 257..285 base */
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
  ]);
  var lext = new Uint8Array([
    /* Length codes 257..285 extra */
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
  ]);
  var dbase = new Uint16Array([
    /* Distance codes 0..29 base */
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
  ]);
  var dext = new Uint8Array([
    /* Distance codes 0..29 extra */
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
  ]);
  var inflate_table = (type, lens, lens_index, codes, table, table_index, work, opts) => {
    const bits = opts.bits;
    let len = 0;
    let sym = 0;
    let min = 0, max = 0;
    let root2 = 0;
    let curr = 0;
    let drop = 0;
    let left = 0;
    let used = 0;
    let huff = 0;
    let incr;
    let fill;
    let low;
    let mask;
    let next;
    let base = null;
    let match;
    const count2 = new Uint16Array(MAXBITS + 1);
    const offs = new Uint16Array(MAXBITS + 1);
    let extra = null;
    let here_bits, here_op, here_val;
    for (len = 0; len <= MAXBITS; len++) {
      count2[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count2[lens[lens_index + sym]]++;
    }
    root2 = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count2[max] !== 0) {
        break;
      }
    }
    if (root2 > max) {
      root2 = max;
    }
    if (max === 0) {
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      opts.bits = 1;
      return 0;
    }
    for (min = 1; min < max; min++) {
      if (count2[min] !== 0) {
        break;
      }
    }
    if (root2 < min) {
      root2 = min;
    }
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count2[len];
      if (left < 0) {
        return -1;
      }
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1;
    }
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count2[len];
    }
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }
    if (type === CODES$1) {
      base = extra = work;
      match = 20;
    } else if (type === LENS$1) {
      base = lbase;
      extra = lext;
      match = 257;
    } else {
      base = dbase;
      extra = dext;
      match = 0;
    }
    huff = 0;
    sym = 0;
    len = min;
    next = table_index;
    curr = root2;
    drop = 0;
    low = -1;
    used = 1 << root2;
    mask = used - 1;
    if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
      return 1;
    }
    for (; ; ) {
      here_bits = len - drop;
      if (work[sym] + 1 < match) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] >= match) {
        here_op = extra[work[sym] - match];
        here_val = base[work[sym] - match];
      } else {
        here_op = 32 + 64;
        here_val = 0;
      }
      incr = 1 << len - drop;
      fill = 1 << curr;
      min = fill;
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
      } while (fill !== 0);
      incr = 1 << len - 1;
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }
      sym++;
      if (--count2[len] === 0) {
        if (len === max) {
          break;
        }
        len = lens[lens_index + work[sym]];
      }
      if (len > root2 && (huff & mask) !== low) {
        if (drop === 0) {
          drop = root2;
        }
        next += min;
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count2[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }
        used += 1 << curr;
        if (type === LENS$1 && used > ENOUGH_LENS$1 || type === DISTS$1 && used > ENOUGH_DISTS$1) {
          return 1;
        }
        low = huff & mask;
        table[low] = root2 << 24 | curr << 16 | next - table_index | 0;
      }
    }
    if (huff !== 0) {
      table[next + huff] = len - drop << 24 | 64 << 16 | 0;
    }
    opts.bits = root2;
    return 0;
  };
  var inftrees = inflate_table;
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  var {
    Z_FINISH: Z_FINISH$1,
    Z_BLOCK,
    Z_TREES,
    Z_OK: Z_OK$1,
    Z_STREAM_END: Z_STREAM_END$1,
    Z_NEED_DICT: Z_NEED_DICT$1,
    Z_STREAM_ERROR: Z_STREAM_ERROR$1,
    Z_DATA_ERROR: Z_DATA_ERROR$1,
    Z_MEM_ERROR: Z_MEM_ERROR$1,
    Z_BUF_ERROR,
    Z_DEFLATED
  } = constants$2;
  var HEAD = 16180;
  var FLAGS = 16181;
  var TIME = 16182;
  var OS = 16183;
  var EXLEN = 16184;
  var EXTRA = 16185;
  var NAME = 16186;
  var COMMENT = 16187;
  var HCRC = 16188;
  var DICTID = 16189;
  var DICT = 16190;
  var TYPE = 16191;
  var TYPEDO = 16192;
  var STORED = 16193;
  var COPY_ = 16194;
  var COPY = 16195;
  var TABLE = 16196;
  var LENLENS = 16197;
  var CODELENS = 16198;
  var LEN_ = 16199;
  var LEN = 16200;
  var LENEXT = 16201;
  var DIST = 16202;
  var DISTEXT = 16203;
  var MATCH = 16204;
  var LIT = 16205;
  var CHECK = 16206;
  var LENGTH = 16207;
  var DONE = 16208;
  var BAD = 16209;
  var MEM = 16210;
  var SYNC = 16211;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  var MAX_WBITS = 15;
  var DEF_WBITS = MAX_WBITS;
  var zswap32 = (q) => {
    return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
  };
  function InflateState() {
    this.strm = null;
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = new Uint16Array(320);
    this.work = new Uint16Array(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
  var inflateStateCheck = (strm) => {
    if (!strm) {
      return 1;
    }
    const state = strm.state;
    if (!state || state.strm !== strm || state.mode < HEAD || state.mode > SYNC) {
      return 1;
    }
    return 0;
  };
  var inflateResetKeep = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = "";
    if (state.wrap) {
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.flags = -1;
    state.dmax = 32768;
    state.head = null;
    state.hold = 0;
    state.bits = 0;
    state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS);
    state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS);
    state.sane = 1;
    state.back = -1;
    return Z_OK$1;
  };
  var inflateReset = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);
  };
  var inflateReset2 = (strm, windowBits) => {
    let wrap;
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else {
      wrap = (windowBits >> 4) + 5;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  };
  var inflateInit2 = (strm, windowBits) => {
    if (!strm) {
      return Z_STREAM_ERROR$1;
    }
    const state = new InflateState();
    strm.state = state;
    state.strm = strm;
    state.window = null;
    state.mode = HEAD;
    const ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK$1) {
      strm.state = null;
    }
    return ret;
  };
  var inflateInit = (strm) => {
    return inflateInit2(strm, DEF_WBITS);
  };
  var virgin = true;
  var lenfix;
  var distfix;
  var fixedtables = (state) => {
    if (virgin) {
      lenfix = new Int32Array(512);
      distfix = new Int32Array(32);
      let sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }
      inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }
      inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
      virgin = false;
    }
    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  };
  var updatewindow = (strm, src, end, copy) => {
    let dist;
    const state = strm.state;
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;
      state.window = new Uint8Array(state.wsize);
    }
    if (copy >= state.wsize) {
      state.window.set(src.subarray(end - state.wsize, end), 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext);
      copy -= dist;
      if (copy) {
        state.window.set(src.subarray(end - copy, end), 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  };
  var inflate$2 = (strm, flush2) => {
    let state;
    let input2, output;
    let next;
    let put;
    let have, left;
    let hold;
    let bits;
    let _in, _out;
    let copy;
    let from;
    let from_source;
    let here = 0;
    let here_bits, here_op, here_val;
    let last_bits, last_op, last_val;
    let len;
    let ret;
    const hbuf = new Uint8Array(4);
    let opts;
    let n2;
    const order = (
      /* permutation of code lengths */
      new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15])
    );
    if (inflateStateCheck(strm) || !strm.output || !strm.input && strm.avail_in !== 0) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    }
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input2 = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    _in = have;
    _out = left;
    ret = Z_OK$1;
    inf_leave:
      for (; ; ) {
        switch (state.mode) {
          case HEAD:
            if (state.wrap === 0) {
              state.mode = TYPEDO;
              break;
            }
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 2 && hold === 35615) {
              if (state.wbits === 0) {
                state.wbits = 15;
              }
              state.check = 0;
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
              hold = 0;
              bits = 0;
              state.mode = FLAGS;
              break;
            }
            if (state.head) {
              state.head.done = false;
            }
            if (!(state.wrap & 1) || /* check if zlib header allowed */
            (((hold & 255) << 8) + (hold >> 8)) % 31) {
              strm.msg = "incorrect header check";
              state.mode = BAD;
              break;
            }
            if ((hold & 15) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            hold >>>= 4;
            bits -= 4;
            len = (hold & 15) + 8;
            if (state.wbits === 0) {
              state.wbits = len;
            }
            if (len > 15 || len > state.wbits) {
              strm.msg = "invalid window size";
              state.mode = BAD;
              break;
            }
            state.dmax = 1 << state.wbits;
            state.flags = 0;
            strm.adler = state.check = 1;
            state.mode = hold & 512 ? DICTID : TYPE;
            hold = 0;
            bits = 0;
            break;
          case FLAGS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            state.flags = hold;
            if ((state.flags & 255) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            if (state.flags & 57344) {
              strm.msg = "unknown header flags set";
              state.mode = BAD;
              break;
            }
            if (state.head) {
              state.head.text = hold >> 8 & 1;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = TIME;
          /* falls through */
          case TIME:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.time = hold;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              hbuf[2] = hold >>> 16 & 255;
              hbuf[3] = hold >>> 24 & 255;
              state.check = crc32_1(state.check, hbuf, 4, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = OS;
          /* falls through */
          case OS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.xflags = hold & 255;
              state.head.os = hold >> 8;
            }
            if (state.flags & 512 && state.wrap & 4) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32_1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = EXLEN;
          /* falls through */
          case EXLEN:
            if (state.flags & 1024) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              state.length = hold;
              if (state.head) {
                state.head.extra_len = hold;
              }
              if (state.flags & 512 && state.wrap & 4) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32_1(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
            } else if (state.head) {
              state.head.extra = null;
            }
            state.mode = EXTRA;
          /* falls through */
          case EXTRA:
            if (state.flags & 1024) {
              copy = state.length;
              if (copy > have) {
                copy = have;
              }
              if (copy) {
                if (state.head) {
                  len = state.head.extra_len - state.length;
                  if (!state.head.extra) {
                    state.head.extra = new Uint8Array(state.head.extra_len);
                  }
                  state.head.extra.set(
                    input2.subarray(
                      next,
                      // extra field is limited to 65536 bytes
                      // - no need for additional size check
                      next + copy
                    ),
                    /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                    len
                  );
                }
                if (state.flags & 512 && state.wrap & 4) {
                  state.check = crc32_1(state.check, input2, copy, next);
                }
                have -= copy;
                next += copy;
                state.length -= copy;
              }
              if (state.length) {
                break inf_leave;
              }
            }
            state.length = 0;
            state.mode = NAME;
          /* falls through */
          case NAME:
            if (state.flags & 2048) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input2[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.name += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input2, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.name = null;
            }
            state.length = 0;
            state.mode = COMMENT;
          /* falls through */
          case COMMENT:
            if (state.flags & 4096) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len = input2[next + copy++];
                if (state.head && len && state.length < 65536) {
                  state.head.comment += String.fromCharCode(len);
                }
              } while (len && copy < have);
              if (state.flags & 512 && state.wrap & 4) {
                state.check = crc32_1(state.check, input2, copy, next);
              }
              have -= copy;
              next += copy;
              if (len) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.comment = null;
            }
            state.mode = HCRC;
          /* falls through */
          case HCRC:
            if (state.flags & 512) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 4 && hold !== (state.check & 65535)) {
                strm.msg = "header crc mismatch";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            if (state.head) {
              state.head.hcrc = state.flags >> 9 & 1;
              state.head.done = true;
            }
            strm.adler = state.check = 0;
            state.mode = TYPE;
            break;
          case DICTID:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            strm.adler = state.check = zswap32(hold);
            hold = 0;
            bits = 0;
            state.mode = DICT;
          /* falls through */
          case DICT:
            if (state.havedict === 0) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              return Z_NEED_DICT$1;
            }
            strm.adler = state.check = 1;
            state.mode = TYPE;
          /* falls through */
          case TYPE:
            if (flush2 === Z_BLOCK || flush2 === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case TYPEDO:
            if (state.last) {
              hold >>>= bits & 7;
              bits -= bits & 7;
              state.mode = CHECK;
              break;
            }
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            state.last = hold & 1;
            hold >>>= 1;
            bits -= 1;
            switch (hold & 3) {
              case 0:
                state.mode = STORED;
                break;
              case 1:
                fixedtables(state);
                state.mode = LEN_;
                if (flush2 === Z_TREES) {
                  hold >>>= 2;
                  bits -= 2;
                  break inf_leave;
                }
                break;
              case 2:
                state.mode = TABLE;
                break;
              case 3:
                strm.msg = "invalid block type";
                state.mode = BAD;
            }
            hold >>>= 2;
            bits -= 2;
            break;
          case STORED:
            hold >>>= bits & 7;
            bits -= bits & 7;
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
              strm.msg = "invalid stored block lengths";
              state.mode = BAD;
              break;
            }
            state.length = hold & 65535;
            hold = 0;
            bits = 0;
            state.mode = COPY_;
            if (flush2 === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case COPY_:
            state.mode = COPY;
          /* falls through */
          case COPY:
            copy = state.length;
            if (copy) {
              if (copy > have) {
                copy = have;
              }
              if (copy > left) {
                copy = left;
              }
              if (copy === 0) {
                break inf_leave;
              }
              output.set(input2.subarray(next, next + copy), put);
              have -= copy;
              next += copy;
              left -= copy;
              put += copy;
              state.length -= copy;
              break;
            }
            state.mode = TYPE;
            break;
          case TABLE:
            while (bits < 14) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            state.nlen = (hold & 31) + 257;
            hold >>>= 5;
            bits -= 5;
            state.ndist = (hold & 31) + 1;
            hold >>>= 5;
            bits -= 5;
            state.ncode = (hold & 15) + 4;
            hold >>>= 4;
            bits -= 4;
            if (state.nlen > 286 || state.ndist > 30) {
              strm.msg = "too many length or distance symbols";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = LENLENS;
          /* falls through */
          case LENLENS:
            while (state.have < state.ncode) {
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              state.lens[order[state.have++]] = hold & 7;
              hold >>>= 3;
              bits -= 3;
            }
            while (state.have < 19) {
              state.lens[order[state.have++]] = 0;
            }
            state.lencode = state.lendyn;
            state.lenbits = 7;
            opts = { bits: state.lenbits };
            ret = inftrees(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid code lengths set";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = CODELENS;
          /* falls through */
          case CODELENS:
            while (state.have < state.nlen + state.ndist) {
              for (; ; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              if (here_val < 16) {
                hold >>>= here_bits;
                bits -= here_bits;
                state.lens[state.have++] = here_val;
              } else {
                if (here_val === 16) {
                  n2 = here_bits + 2;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input2[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  if (state.have === 0) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  len = state.lens[state.have - 1];
                  copy = 3 + (hold & 3);
                  hold >>>= 2;
                  bits -= 2;
                } else if (here_val === 17) {
                  n2 = here_bits + 3;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input2[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 3 + (hold & 7);
                  hold >>>= 3;
                  bits -= 3;
                } else {
                  n2 = here_bits + 7;
                  while (bits < n2) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input2[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len = 0;
                  copy = 11 + (hold & 127);
                  hold >>>= 7;
                  bits -= 7;
                }
                if (state.have + copy > state.nlen + state.ndist) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                while (copy--) {
                  state.lens[state.have++] = len;
                }
              }
            }
            if (state.mode === BAD) {
              break;
            }
            if (state.lens[256] === 0) {
              strm.msg = "invalid code -- missing end-of-block";
              state.mode = BAD;
              break;
            }
            state.lenbits = 9;
            opts = { bits: state.lenbits };
            ret = inftrees(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid literal/lengths set";
              state.mode = BAD;
              break;
            }
            state.distbits = 6;
            state.distcode = state.distdyn;
            opts = { bits: state.distbits };
            ret = inftrees(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
            state.distbits = opts.bits;
            if (ret) {
              strm.msg = "invalid distances set";
              state.mode = BAD;
              break;
            }
            state.mode = LEN_;
            if (flush2 === Z_TREES) {
              break inf_leave;
            }
          /* falls through */
          case LEN_:
            state.mode = LEN;
          /* falls through */
          case LEN:
            if (have >= 6 && left >= 258) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              inffast(strm, _out);
              put = strm.next_out;
              output = strm.output;
              left = strm.avail_out;
              next = strm.next_in;
              input2 = strm.input;
              have = strm.avail_in;
              hold = state.hold;
              bits = state.bits;
              if (state.mode === TYPE) {
                state.back = -1;
              }
              break;
            }
            state.back = 0;
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if (here_op && (here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            state.length = here_val;
            if (here_op === 0) {
              state.mode = LIT;
              break;
            }
            if (here_op & 32) {
              state.back = -1;
              state.mode = TYPE;
              break;
            }
            if (here_op & 64) {
              strm.msg = "invalid literal/length code";
              state.mode = BAD;
              break;
            }
            state.extra = here_op & 15;
            state.mode = LENEXT;
          /* falls through */
          case LENEXT:
            if (state.extra) {
              n2 = state.extra;
              while (bits < n2) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              state.length += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            state.was = state.length;
            state.mode = DIST;
          /* falls through */
          case DIST:
            for (; ; ) {
              here = state.distcode[hold & (1 << state.distbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input2[next++] << bits;
              bits += 8;
            }
            if ((here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (; ; ) {
                here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            if (here_op & 64) {
              strm.msg = "invalid distance code";
              state.mode = BAD;
              break;
            }
            state.offset = here_val;
            state.extra = here_op & 15;
            state.mode = DISTEXT;
          /* falls through */
          case DISTEXT:
            if (state.extra) {
              n2 = state.extra;
              while (bits < n2) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              state.offset += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            if (state.offset > state.dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD;
              break;
            }
            state.mode = MATCH;
          /* falls through */
          case MATCH:
            if (left === 0) {
              break inf_leave;
            }
            copy = _out - left;
            if (state.offset > copy) {
              copy = state.offset - copy;
              if (copy > state.whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD;
                  break;
                }
              }
              if (copy > state.wnext) {
                copy -= state.wnext;
                from = state.wsize - copy;
              } else {
                from = state.wnext - copy;
              }
              if (copy > state.length) {
                copy = state.length;
              }
              from_source = state.window;
            } else {
              from_source = output;
              from = put - state.offset;
              copy = state.length;
            }
            if (copy > left) {
              copy = left;
            }
            left -= copy;
            state.length -= copy;
            do {
              output[put++] = from_source[from++];
            } while (--copy);
            if (state.length === 0) {
              state.mode = LEN;
            }
            break;
          case LIT:
            if (left === 0) {
              break inf_leave;
            }
            output[put++] = state.length;
            left--;
            state.mode = LEN;
            break;
          case CHECK:
            if (state.wrap) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold |= input2[next++] << bits;
                bits += 8;
              }
              _out -= left;
              strm.total_out += _out;
              state.total += _out;
              if (state.wrap & 4 && _out) {
                strm.adler = state.check = /*UPDATE_CHECK(state.check, put - _out, _out);*/
                state.flags ? crc32_1(state.check, output, _out, put - _out) : adler32_1(state.check, output, _out, put - _out);
              }
              _out = left;
              if (state.wrap & 4 && (state.flags ? hold : zswap32(hold)) !== state.check) {
                strm.msg = "incorrect data check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = LENGTH;
          /* falls through */
          case LENGTH:
            if (state.wrap && state.flags) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input2[next++] << bits;
                bits += 8;
              }
              if (state.wrap & 4 && hold !== (state.total & 4294967295)) {
                strm.msg = "incorrect length check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = DONE;
          /* falls through */
          case DONE:
            ret = Z_STREAM_END$1;
            break inf_leave;
          case BAD:
            ret = Z_DATA_ERROR$1;
            break inf_leave;
          case MEM:
            return Z_MEM_ERROR$1;
          case SYNC:
          /* falls through */
          default:
            return Z_STREAM_ERROR$1;
        }
      }
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush2 !== Z_FINISH$1)) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap & 4 && _out) {
      strm.adler = state.check = /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
      state.flags ? crc32_1(state.check, output, _out, strm.next_out - _out) : adler32_1(state.check, output, _out, strm.next_out - _out);
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if ((_in === 0 && _out === 0 || flush2 === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR;
    }
    return ret;
  };
  var inflateEnd = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    let state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK$1;
  };
  var inflateGetHeader = (strm, head) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    const state = strm.state;
    if ((state.wrap & 2) === 0) {
      return Z_STREAM_ERROR$1;
    }
    state.head = head;
    head.done = false;
    return Z_OK$1;
  };
  var inflateSetDictionary = (strm, dictionary) => {
    const dictLength = dictionary.length;
    let state;
    let dictid;
    let ret;
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR$1;
    }
    if (state.mode === DICT) {
      dictid = 1;
      dictid = adler32_1(dictid, dictionary, dictLength, 0);
      if (dictid !== state.check) {
        return Z_DATA_ERROR$1;
      }
    }
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
      state.mode = MEM;
      return Z_MEM_ERROR$1;
    }
    state.havedict = 1;
    return Z_OK$1;
  };
  var inflateReset_1 = inflateReset;
  var inflateReset2_1 = inflateReset2;
  var inflateResetKeep_1 = inflateResetKeep;
  var inflateInit_1 = inflateInit;
  var inflateInit2_1 = inflateInit2;
  var inflate_2$1 = inflate$2;
  var inflateEnd_1 = inflateEnd;
  var inflateGetHeader_1 = inflateGetHeader;
  var inflateSetDictionary_1 = inflateSetDictionary;
  var inflateInfo = "pako inflate (from Nodeca project)";
  var inflate_1$2 = {
    inflateReset: inflateReset_1,
    inflateReset2: inflateReset2_1,
    inflateResetKeep: inflateResetKeep_1,
    inflateInit: inflateInit_1,
    inflateInit2: inflateInit2_1,
    inflate: inflate_2$1,
    inflateEnd: inflateEnd_1,
    inflateGetHeader: inflateGetHeader_1,
    inflateSetDictionary: inflateSetDictionary_1,
    inflateInfo
  };
  function GZheader() {
    this.text = 0;
    this.time = 0;
    this.xflags = 0;
    this.os = 0;
    this.extra = null;
    this.extra_len = 0;
    this.name = "";
    this.comment = "";
    this.hcrc = 0;
    this.done = false;
  }
  var gzheader = GZheader;
  var toString = Object.prototype.toString;
  var {
    Z_NO_FLUSH,
    Z_FINISH,
    Z_OK,
    Z_STREAM_END,
    Z_NEED_DICT,
    Z_STREAM_ERROR,
    Z_DATA_ERROR,
    Z_MEM_ERROR
  } = constants$2;
  function Inflate$1(options) {
    this.options = common.assign({
      chunkSize: 1024 * 64,
      windowBits: 15,
      to: ""
    }, options || {});
    const opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) {
        opt.windowBits = -15;
      }
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
      opt.windowBits += 32;
    }
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15;
      }
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new zstream();
    this.strm.avail_out = 0;
    let status = inflate_1$2.inflateInit2(
      this.strm,
      opt.windowBits
    );
    if (status !== Z_OK) {
      throw new Error(messages[status]);
    }
    this.header = new gzheader();
    inflate_1$2.inflateGetHeader(this.strm, this.header);
    if (opt.dictionary) {
      if (typeof opt.dictionary === "string") {
        opt.dictionary = strings.string2buf(opt.dictionary);
      } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
        opt.dictionary = new Uint8Array(opt.dictionary);
      }
      if (opt.raw) {
        status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary);
        if (status !== Z_OK) {
          throw new Error(messages[status]);
        }
      }
    }
  }
  Inflate$1.prototype.push = function(data, flush_mode) {
    const strm = this.strm;
    const chunkSize = this.options.chunkSize;
    const dictionary = this.options.dictionary;
    let status, _flush_mode, last_avail_out;
    if (this.ended) return false;
    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode;
    else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH;
    if (toString.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    for (; ; ) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = inflate_1$2.inflate(strm, _flush_mode);
      if (status === Z_NEED_DICT && dictionary) {
        status = inflate_1$2.inflateSetDictionary(strm, dictionary);
        if (status === Z_OK) {
          status = inflate_1$2.inflate(strm, _flush_mode);
        } else if (status === Z_DATA_ERROR) {
          status = Z_NEED_DICT;
        }
      }
      while (strm.avail_in > 0 && status === Z_STREAM_END && strm.state.wrap > 0 && data[strm.next_in] !== 0) {
        inflate_1$2.inflateReset(strm);
        status = inflate_1$2.inflate(strm, _flush_mode);
      }
      switch (status) {
        case Z_STREAM_ERROR:
        case Z_DATA_ERROR:
        case Z_NEED_DICT:
        case Z_MEM_ERROR:
          this.onEnd(status);
          this.ended = true;
          return false;
      }
      last_avail_out = strm.avail_out;
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === Z_STREAM_END) {
          if (this.options.to === "string") {
            let next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
            let tail = strm.next_out - next_out_utf8;
            let utf8str = strings.buf2string(strm.output, next_out_utf8);
            strm.next_out = tail;
            strm.avail_out = chunkSize - tail;
            if (tail) strm.output.set(strm.output.subarray(next_out_utf8, next_out_utf8 + tail), 0);
            this.onData(utf8str);
          } else {
            this.onData(strm.output.length === strm.next_out ? strm.output : strm.output.subarray(0, strm.next_out));
          }
        }
      }
      if (status === Z_OK && last_avail_out === 0) continue;
      if (status === Z_STREAM_END) {
        status = inflate_1$2.inflateEnd(this.strm);
        this.onEnd(status);
        this.ended = true;
        return true;
      }
      if (strm.avail_in === 0) break;
    }
    return true;
  };
  Inflate$1.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Inflate$1.prototype.onEnd = function(status) {
    if (status === Z_OK) {
      if (this.options.to === "string") {
        this.result = this.chunks.join("");
      } else {
        this.result = common.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function inflate$1(input2, options) {
    const inflator = new Inflate$1(options);
    inflator.push(input2);
    if (inflator.err) throw inflator.msg || messages[inflator.err];
    return inflator.result;
  }
  function inflateRaw$1(input2, options) {
    options = options || {};
    options.raw = true;
    return inflate$1(input2, options);
  }
  var Inflate_1$1 = Inflate$1;
  var inflate_2 = inflate$1;
  var inflateRaw_1$1 = inflateRaw$1;
  var ungzip$1 = inflate$1;
  var constants = constants$2;
  var inflate_1$1 = {
    Inflate: Inflate_1$1,
    inflate: inflate_2,
    inflateRaw: inflateRaw_1$1,
    ungzip: ungzip$1,
    constants
  };
  var { Deflate, deflate, deflateRaw, gzip } = deflate_1$1;
  var { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1;
  var Deflate_1 = Deflate;
  var deflate_1 = deflate;
  var deflateRaw_1 = deflateRaw;
  var gzip_1 = gzip;
  var Inflate_1 = Inflate;
  var inflate_1 = inflate;
  var inflateRaw_1 = inflateRaw;
  var ungzip_1 = ungzip;
  var constants_1 = constants$2;
  var pako = {
    Deflate: Deflate_1,
    deflate: deflate_1,
    deflateRaw: deflateRaw_1,
    gzip: gzip_1,
    Inflate: Inflate_1,
    inflate: inflate_1,
    inflateRaw: inflateRaw_1,
    ungzip: ungzip_1,
    constants: constants_1
  };

  // src/upload.js
  var FLUSH_INTERVAL_MS = 5e3;
  var COMPRESS_THRESHOLD_BYTES = 50 * 1024;
  var FLUSH_SIZE_BYTES = 150 * 1024;
  var FIRST_CHUNK_DELAY_MS = 500;
  var STORAGE_CHUNK_KEY = "quicklook_chunk_index";
  var eventBuffer = [];
  var chunkIndex = 0;
  var chunkIndexRestored = false;
  var worker = null;
  var workerUrl = "";
  var flushTimer = null;
  var firstChunkTimer = null;
  function ensureRestoredChunkIndex() {
    if (chunkIndexRestored || typeof sessionStorage === "undefined") return;
    chunkIndexRestored = true;
    try {
      const stored = sessionStorage.getItem(STORAGE_CHUNK_KEY);
      if (stored !== null && stored !== "") {
        const n2 = parseInt(stored, 10);
        if (!Number.isNaN(n2) && n2 >= 0) chunkIndex = n2;
      }
    } catch (_) {
    }
  }
  function persistChunkIndex() {
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_CHUNK_KEY, String(chunkIndex));
    } catch (_) {
    }
  }
  function scheduleFlush() {
    if (flushTimer) return;
    if (isPausedByActivity()) return;
    flushTimer = setTimeout(doFlush, FLUSH_INTERVAL_MS);
  }
  function scheduleFirstChunkFlush() {
    if (firstChunkTimer) return;
    firstChunkTimer = setTimeout(() => {
      firstChunkTimer = null;
      if (getSessionId()) {
        doFlush();
      } else {
        let retries = 0;
        const maxRetries = 5;
        const retry = () => {
          retries++;
          if (getSessionId()) {
            doFlush();
          } else if (retries < maxRetries) {
            setTimeout(retry, 1e3 * retries);
          }
        };
        setTimeout(retry, 1e3);
      }
    }, FIRST_CHUNK_DELAY_MS);
  }
  async function doFlush() {
    flushTimer = null;
    if (eventBuffer.length === 0) {
      return;
    }
    if (shouldRotateSession()) {
      try {
        const result2 = await rotateSession("duration_limit");
        if (result2) {
          chunkIndex = 0;
          persistChunkIndex();
        }
      } catch (e) {
      }
    }
    ensureRestoredChunkIndex();
    const events = eventBuffer.slice();
    eventBuffer = [];
    const index2 = chunkIndex++;
    persistChunkIndex();
    if (worker && typeof worker.postMessage === "function") {
      worker.postMessage({ index: index2, events });
    } else {
      sendChunkDirect(index2, events);
    }
    if (!isPausedByActivity()) {
      scheduleFlush();
    }
  }
  function uint8ArrayToBase64(uint8) {
    const chunk = 8192;
    let binary = "";
    for (let i = 0; i < uint8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function sendChunkDirect(index2, events) {
    try {
      const sessionId2 = getSessionId();
      const apiUrl2 = getApiUrl();
      if (!sessionId2 || !apiUrl2) {
        return;
      }
      const json = JSON.stringify(events);
      const useCompression = index2 === 0 || json.length >= COMPRESS_THRESHOLD_BYTES;
      let body;
      if (useCompression) {
        const compressed = pako.gzip(json);
        body = JSON.stringify({
          index: index2,
          data: uint8ArrayToBase64(compressed),
          compressed: true
        });
      } else {
        body = JSON.stringify({ index: index2, data: events, compressed: false });
      }
      fetch(`${apiUrl2}/api/quicklook/sessions/${sessionId2}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      }).catch(() => {
      });
    } catch (e) {
    }
  }
  var pendingWorkerChunks = [];
  function sendWorkerChunk(index2, data) {
    const sessionId2 = getSessionId();
    const apiUrl2 = getApiUrl();
    if (!sessionId2 || !apiUrl2) {
      pendingWorkerChunks.push({ index: index2, data });
      return;
    }
    fetch(`${apiUrl2}/api/quicklook/sessions/${sessionId2}/chunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: index2, data, compressed: true }),
      keepalive: true
    }).catch(() => {
    });
  }
  function flushPendingWorkerChunks() {
    if (pendingWorkerChunks.length === 0) return;
    const sessionId2 = getSessionId();
    const apiUrl2 = getApiUrl();
    if (!sessionId2 || !apiUrl2) return;
    for (const { index: index2, data } of pendingWorkerChunks) {
      fetch(`${apiUrl2}/api/quicklook/sessions/${sessionId2}/chunk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: index2, data, compressed: true }),
        keepalive: true
      }).catch(() => {
      });
    }
    pendingWorkerChunks = [];
  }
  function setWorker(w) {
    worker = w;
    if (w) {
      w.onmessage = (e) => {
        const { index: index2, data } = e.data || {};
        sendWorkerChunk(index2, data);
      };
    }
  }
  function setWorkerUrl(url) {
    workerUrl = url;
  }
  function pushEvent3(ev) {
    if (isPausedByActivity()) {
      return;
    }
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
  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (firstChunkTimer) {
      clearTimeout(firstChunkTimer);
      firstChunkTimer = null;
    }
    if (eventBuffer.length > 0) {
      doFlush();
    }
  }
  var flushedOnUnload = false;
  function flushAndEnd() {
    if (flushedOnUnload) return;
    flushedOnUnload = true;
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
      const index2 = chunkIndex++;
      persistChunkIndex();
      const sessionId2 = getSessionId();
      const apiUrl2 = getApiUrl();
      if (sessionId2 && apiUrl2) {
        const body = JSON.stringify({ index: index2, data: events, compressed: false });
        navigator.sendBeacon(`${apiUrl2}/api/quicklook/sessions/${sessionId2}/chunk`, body);
      }
    }
  }
  function startScheduler() {
    scheduleFlush();
  }
  function stopScheduler() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  // node_modules/@rrweb/record/dist/record.js
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var _a;
  var __defProp$1 = Object.defineProperty;
  var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  var NodeType$3 = /* @__PURE__ */ ((NodeType2) => {
    NodeType2[NodeType2["Document"] = 0] = "Document";
    NodeType2[NodeType2["DocumentType"] = 1] = "DocumentType";
    NodeType2[NodeType2["Element"] = 2] = "Element";
    NodeType2[NodeType2["Text"] = 3] = "Text";
    NodeType2[NodeType2["CDATA"] = 4] = "CDATA";
    NodeType2[NodeType2["Comment"] = 5] = "Comment";
    return NodeType2;
  })(NodeType$3 || {});
  var testableAccessors$1 = {
    Node: [
      "childNodes",
      "parentNode",
      "parentElement",
      "textContent",
      "ownerDocument"
    ],
    ShadowRoot: ["host", "styleSheets"],
    Element: ["shadowRoot", "querySelector", "querySelectorAll"],
    MutationObserver: []
  };
  var testableMethods$1 = {
    Node: ["contains", "getRootNode"],
    ShadowRoot: ["getSelection"],
    Element: [],
    MutationObserver: ["constructor"]
  };
  var untaintedBasePrototype$1 = {};
  var isAngularZonePresent$1 = () => {
    return !!globalThis.Zone;
  };
  function getUntaintedPrototype$1(key) {
    if (untaintedBasePrototype$1[key])
      return untaintedBasePrototype$1[key];
    const defaultObj = globalThis[key];
    const defaultPrototype = defaultObj.prototype;
    const accessorNames = key in testableAccessors$1 ? testableAccessors$1[key] : void 0;
    const isUntaintedAccessors = Boolean(
      accessorNames && // @ts-expect-error 2345
      accessorNames.every(
        (accessor) => {
          var _a2, _b;
          return Boolean(
            (_b = (_a2 = Object.getOwnPropertyDescriptor(defaultPrototype, accessor)) == null ? void 0 : _a2.get) == null ? void 0 : _b.toString().includes("[native code]")
          );
        }
      )
    );
    const methodNames = key in testableMethods$1 ? testableMethods$1[key] : void 0;
    const isUntaintedMethods = Boolean(
      methodNames && methodNames.every(
        // @ts-expect-error 2345
        (method) => {
          var _a2;
          return typeof defaultPrototype[method] === "function" && ((_a2 = defaultPrototype[method]) == null ? void 0 : _a2.toString().includes("[native code]"));
        }
      )
    );
    if (isUntaintedAccessors && isUntaintedMethods && !isAngularZonePresent$1()) {
      untaintedBasePrototype$1[key] = defaultObj.prototype;
      return defaultObj.prototype;
    }
    try {
      const iframeEl = document.createElement("iframe");
      document.body.appendChild(iframeEl);
      const win = iframeEl.contentWindow;
      if (!win) return defaultObj.prototype;
      const untaintedObject = win[key].prototype;
      document.body.removeChild(iframeEl);
      if (!untaintedObject) return defaultPrototype;
      return untaintedBasePrototype$1[key] = untaintedObject;
    } catch {
      return defaultPrototype;
    }
  }
  var untaintedAccessorCache$1 = {};
  function getUntaintedAccessor$1(key, instance, accessor) {
    var _a2;
    const cacheKey = `${key}.${String(accessor)}`;
    if (untaintedAccessorCache$1[cacheKey])
      return untaintedAccessorCache$1[cacheKey].call(
        instance
      );
    const untaintedPrototype = getUntaintedPrototype$1(key);
    const untaintedAccessor = (_a2 = Object.getOwnPropertyDescriptor(
      untaintedPrototype,
      accessor
    )) == null ? void 0 : _a2.get;
    if (!untaintedAccessor) return instance[accessor];
    untaintedAccessorCache$1[cacheKey] = untaintedAccessor;
    return untaintedAccessor.call(instance);
  }
  var untaintedMethodCache$1 = {};
  function getUntaintedMethod$1(key, instance, method) {
    const cacheKey = `${key}.${String(method)}`;
    if (untaintedMethodCache$1[cacheKey])
      return untaintedMethodCache$1[cacheKey].bind(
        instance
      );
    const untaintedPrototype = getUntaintedPrototype$1(key);
    const untaintedMethod = untaintedPrototype[method];
    if (typeof untaintedMethod !== "function") return instance[method];
    untaintedMethodCache$1[cacheKey] = untaintedMethod;
    return untaintedMethod.bind(instance);
  }
  function ownerDocument$1(n2) {
    return getUntaintedAccessor$1("Node", n2, "ownerDocument");
  }
  function childNodes$1(n2) {
    return getUntaintedAccessor$1("Node", n2, "childNodes");
  }
  function parentNode$1(n2) {
    return getUntaintedAccessor$1("Node", n2, "parentNode");
  }
  function parentElement$1(n2) {
    return getUntaintedAccessor$1("Node", n2, "parentElement");
  }
  function textContent$1(n2) {
    return getUntaintedAccessor$1("Node", n2, "textContent");
  }
  function contains$1(n2, other) {
    return getUntaintedMethod$1("Node", n2, "contains")(other);
  }
  function getRootNode$1(n2) {
    return getUntaintedMethod$1("Node", n2, "getRootNode")();
  }
  function host$1(n2) {
    if (!n2 || !("host" in n2)) return null;
    return getUntaintedAccessor$1("ShadowRoot", n2, "host");
  }
  function styleSheets$1(n2) {
    return n2.styleSheets;
  }
  function shadowRoot$1(n2) {
    if (!n2 || !("shadowRoot" in n2)) return null;
    return getUntaintedAccessor$1("Element", n2, "shadowRoot");
  }
  function querySelector$1(n2, selectors) {
    return getUntaintedAccessor$1("Element", n2, "querySelector")(selectors);
  }
  function querySelectorAll$1(n2, selectors) {
    return getUntaintedAccessor$1("Element", n2, "querySelectorAll")(selectors);
  }
  function mutationObserverCtor$1() {
    return getUntaintedPrototype$1("MutationObserver").constructor;
  }
  function patch$1(source, name, replacement) {
    try {
      if (!(name in source)) {
        return () => {
        };
      }
      const original = source[name];
      const wrapped = replacement(original);
      if (typeof wrapped === "function") {
        wrapped.prototype = wrapped.prototype || {};
        Object.defineProperties(wrapped, {
          __rrweb_original__: {
            enumerable: false,
            value: original
          }
        });
      }
      source[name] = wrapped;
      return () => {
        source[name] = original;
      };
    } catch {
      return () => {
      };
    }
  }
  var index$1 = {
    ownerDocument: ownerDocument$1,
    childNodes: childNodes$1,
    parentNode: parentNode$1,
    parentElement: parentElement$1,
    textContent: textContent$1,
    contains: contains$1,
    getRootNode: getRootNode$1,
    host: host$1,
    styleSheets: styleSheets$1,
    shadowRoot: shadowRoot$1,
    querySelector: querySelector$1,
    querySelectorAll: querySelectorAll$1,
    mutationObserver: mutationObserverCtor$1,
    patch: patch$1
  };
  function isElement(n2) {
    return n2.nodeType === n2.ELEMENT_NODE;
  }
  function isShadowRoot(n2) {
    const hostEl = (
      // anchor and textarea elements also have a `host` property
      // but only shadow roots have a `mode` property
      n2 && "host" in n2 && "mode" in n2 && index$1.host(n2) || null
    );
    return Boolean(
      hostEl && "shadowRoot" in hostEl && index$1.shadowRoot(hostEl) === n2
    );
  }
  function isNativeShadowDom(shadowRoot2) {
    return Object.prototype.toString.call(shadowRoot2) === "[object ShadowRoot]";
  }
  function fixBrowserCompatibilityIssuesInCSS(cssText) {
    if (cssText.includes(" background-clip: text;") && !cssText.includes(" -webkit-background-clip: text;")) {
      cssText = cssText.replace(
        /\sbackground-clip:\s*text;/g,
        " -webkit-background-clip: text; background-clip: text;"
      );
    }
    return cssText;
  }
  function escapeImportStatement(rule2) {
    const { cssText } = rule2;
    if (cssText.split('"').length < 3) return cssText;
    const statement = ["@import", `url(${JSON.stringify(rule2.href)})`];
    if (rule2.layerName === "") {
      statement.push(`layer`);
    } else if (rule2.layerName) {
      statement.push(`layer(${rule2.layerName})`);
    }
    if (rule2.supportsText) {
      statement.push(`supports(${rule2.supportsText})`);
    }
    if (rule2.media.length) {
      statement.push(rule2.media.mediaText);
    }
    return statement.join(" ") + ";";
  }
  function stringifyStylesheet(s2) {
    try {
      const rules2 = s2.rules || s2.cssRules;
      if (!rules2) {
        return null;
      }
      let sheetHref = s2.href;
      if (!sheetHref && s2.ownerNode) {
        sheetHref = s2.ownerNode.baseURI;
      }
      const stringifiedRules = Array.from(
        rules2,
        (rule2) => stringifyRule(rule2, sheetHref)
      ).join("");
      return fixBrowserCompatibilityIssuesInCSS(stringifiedRules);
    } catch (error) {
      return null;
    }
  }
  function stringifyRule(rule2, sheetHref) {
    if (isCSSImportRule(rule2)) {
      let importStringified;
      try {
        importStringified = // for same-origin stylesheets,
        // we can access the imported stylesheet rules directly
        stringifyStylesheet(rule2.styleSheet) || // work around browser issues with the raw string `@import url(...)` statement
        escapeImportStatement(rule2);
      } catch (error) {
        importStringified = rule2.cssText;
      }
      if (rule2.styleSheet.href) {
        return absolutifyURLs(importStringified, rule2.styleSheet.href);
      }
      return importStringified;
    } else {
      let ruleStringified = rule2.cssText;
      if (isCSSStyleRule(rule2) && rule2.selectorText.includes(":")) {
        ruleStringified = fixSafariColons(ruleStringified);
      }
      if (sheetHref) {
        return absolutifyURLs(ruleStringified, sheetHref);
      }
      return ruleStringified;
    }
  }
  function fixSafariColons(cssStringified) {
    const regex = /(\[(?:[\w-]+)[^\\])(:(?:[\w-]+)\])/gm;
    return cssStringified.replace(regex, "$1\\$2");
  }
  function isCSSImportRule(rule2) {
    return "styleSheet" in rule2;
  }
  function isCSSStyleRule(rule2) {
    return "selectorText" in rule2;
  }
  var Mirror = class {
    constructor() {
      __publicField$1(this, "idNodeMap", /* @__PURE__ */ new Map());
      __publicField$1(this, "nodeMetaMap", /* @__PURE__ */ new WeakMap());
    }
    getId(n2) {
      var _a2;
      if (!n2) return -1;
      const id = (_a2 = this.getMeta(n2)) == null ? void 0 : _a2.id;
      return id ?? -1;
    }
    getNode(id) {
      return this.idNodeMap.get(id) || null;
    }
    getIds() {
      return Array.from(this.idNodeMap.keys());
    }
    getMeta(n2) {
      return this.nodeMetaMap.get(n2) || null;
    }
    // removes the node from idNodeMap
    // doesn't remove the node from nodeMetaMap
    removeNodeFromMap(n2) {
      const id = this.getId(n2);
      this.idNodeMap.delete(id);
      if (n2.childNodes) {
        n2.childNodes.forEach(
          (childNode) => this.removeNodeFromMap(childNode)
        );
      }
    }
    has(id) {
      return this.idNodeMap.has(id);
    }
    hasNode(node2) {
      return this.nodeMetaMap.has(node2);
    }
    add(n2, meta2) {
      const id = meta2.id;
      this.idNodeMap.set(id, n2);
      this.nodeMetaMap.set(n2, meta2);
    }
    replace(id, n2) {
      const oldNode = this.getNode(id);
      if (oldNode) {
        const meta2 = this.nodeMetaMap.get(oldNode);
        if (meta2) this.nodeMetaMap.set(n2, meta2);
      }
      this.idNodeMap.set(id, n2);
    }
    reset() {
      this.idNodeMap = /* @__PURE__ */ new Map();
      this.nodeMetaMap = /* @__PURE__ */ new WeakMap();
    }
  };
  function createMirror$2() {
    return new Mirror();
  }
  function maskInputValue({
    element,
    maskInputOptions,
    tagName,
    type,
    value,
    maskInputFn
  }) {
    let text = value || "";
    const actualType = type && toLowerCase(type);
    if (maskInputOptions[tagName.toLowerCase()] || actualType && maskInputOptions[actualType]) {
      if (maskInputFn) {
        text = maskInputFn(text, element);
      } else {
        text = "*".repeat(text.length);
      }
    }
    return text;
  }
  function toLowerCase(str) {
    return str.toLowerCase();
  }
  var ORIGINAL_ATTRIBUTE_NAME = "__rrweb_original__";
  function is2DCanvasBlank(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const chunkSize = 50;
    for (let x2 = 0; x2 < canvas.width; x2 += chunkSize) {
      for (let y = 0; y < canvas.height; y += chunkSize) {
        const getImageData = ctx.getImageData;
        const originalGetImageData = ORIGINAL_ATTRIBUTE_NAME in getImageData ? getImageData[ORIGINAL_ATTRIBUTE_NAME] : getImageData;
        const pixelBuffer = new Uint32Array(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          originalGetImageData.call(
            ctx,
            x2,
            y,
            Math.min(chunkSize, canvas.width - x2),
            Math.min(chunkSize, canvas.height - y)
          ).data.buffer
        );
        if (pixelBuffer.some((pixel) => pixel !== 0)) return false;
      }
    }
    return true;
  }
  function getInputType(element) {
    const type = element.type;
    return element.hasAttribute("data-rr-is-password") ? "password" : type ? (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      toLowerCase(type)
    ) : null;
  }
  function extractFileExtension(path, baseURL) {
    let url;
    try {
      url = new URL(path, baseURL ?? window.location.href);
    } catch (err2) {
      return null;
    }
    const regex = /\.([0-9a-z]+)(?:$)/i;
    const match = url.pathname.match(regex);
    return (match == null ? void 0 : match[1]) ?? null;
  }
  function extractOrigin(url) {
    let origin = "";
    if (url.indexOf("//") > -1) {
      origin = url.split("/").slice(0, 3).join("/");
    } else {
      origin = url.split("/")[0];
    }
    origin = origin.split("?")[0];
    return origin;
  }
  var URL_IN_CSS_REF = /url\((?:(')([^']*)'|(")(.*?)"|([^)]*))\)/gm;
  var URL_PROTOCOL_MATCH = /^(?:[a-z+]+:)?\/\//i;
  var URL_WWW_MATCH = /^www\..*/i;
  var DATA_URI = /^(data:)([^,]*),(.*)/i;
  function absolutifyURLs(cssText, href) {
    return (cssText || "").replace(
      URL_IN_CSS_REF,
      (origin, quote1, path1, quote2, path2, path3) => {
        const filePath = path1 || path2 || path3;
        const maybeQuote = quote1 || quote2 || "";
        if (!filePath) {
          return origin;
        }
        if (URL_PROTOCOL_MATCH.test(filePath) || URL_WWW_MATCH.test(filePath)) {
          return `url(${maybeQuote}${filePath}${maybeQuote})`;
        }
        if (DATA_URI.test(filePath)) {
          return `url(${maybeQuote}${filePath}${maybeQuote})`;
        }
        if (filePath[0] === "/") {
          return `url(${maybeQuote}${extractOrigin(href) + filePath}${maybeQuote})`;
        }
        const stack = href.split("/");
        const parts = filePath.split("/");
        stack.pop();
        for (const part of parts) {
          if (part === ".") {
            continue;
          } else if (part === "..") {
            stack.pop();
          } else {
            stack.push(part);
          }
        }
        return `url(${maybeQuote}${stack.join("/")}${maybeQuote})`;
      }
    );
  }
  function normalizeCssString(cssText, _testNoPxNorm = false) {
    if (_testNoPxNorm) {
      return cssText.replace(/(\/\*[^*]*\*\/)|[\s;]/g, "");
    } else {
      return cssText.replace(/(\/\*[^*]*\*\/)|[\s;]/g, "").replace(/0px/g, "0");
    }
  }
  function splitCssText(cssText, style, _testNoPxNorm = false) {
    const childNodes2 = Array.from(style.childNodes);
    const splits = [];
    let iterCount = 0;
    if (childNodes2.length > 1 && cssText && typeof cssText === "string") {
      let cssTextNorm = normalizeCssString(cssText, _testNoPxNorm);
      const normFactor = cssTextNorm.length / cssText.length;
      for (let i2 = 1; i2 < childNodes2.length; i2++) {
        if (childNodes2[i2].textContent && typeof childNodes2[i2].textContent === "string") {
          const textContentNorm = normalizeCssString(
            childNodes2[i2].textContent,
            _testNoPxNorm
          );
          const jLimit = 100;
          let j = 3;
          for (; j < textContentNorm.length; j++) {
            if (
              // keep consuming css identifiers (to get a decent chunk more quickly)
              textContentNorm[j].match(/[a-zA-Z0-9]/) || // substring needs to be unique to this section
              textContentNorm.indexOf(textContentNorm.substring(0, j), 1) !== -1
            ) {
              continue;
            }
            break;
          }
          for (; j < textContentNorm.length; j++) {
            let startSubstring = textContentNorm.substring(0, j);
            let cssNormSplits = cssTextNorm.split(startSubstring);
            let splitNorm = -1;
            if (cssNormSplits.length === 2) {
              splitNorm = cssNormSplits[0].length;
            } else if (cssNormSplits.length > 2 && cssNormSplits[0] === "" && childNodes2[i2 - 1].textContent !== "") {
              splitNorm = cssTextNorm.indexOf(startSubstring, 1);
            } else if (cssNormSplits.length === 1) {
              startSubstring = startSubstring.substring(
                0,
                startSubstring.length - 1
              );
              cssNormSplits = cssTextNorm.split(startSubstring);
              if (cssNormSplits.length <= 1) {
                splits.push(cssText);
                return splits;
              }
              j = jLimit + 1;
            } else if (j === textContentNorm.length - 1) {
              splitNorm = cssTextNorm.indexOf(startSubstring);
            }
            if (cssNormSplits.length >= 2 && j > jLimit) {
              const prevTextContent = childNodes2[i2 - 1].textContent;
              if (prevTextContent && typeof prevTextContent === "string") {
                const prevMinLength = normalizeCssString(prevTextContent).length;
                splitNorm = cssTextNorm.indexOf(startSubstring, prevMinLength);
              }
              if (splitNorm === -1) {
                splitNorm = cssNormSplits[0].length;
              }
            }
            if (splitNorm !== -1) {
              let k = Math.floor(splitNorm / normFactor);
              for (; k > 0 && k < cssText.length; ) {
                iterCount += 1;
                if (iterCount > 50 * childNodes2.length) {
                  splits.push(cssText);
                  return splits;
                }
                const normPart = normalizeCssString(
                  cssText.substring(0, k),
                  _testNoPxNorm
                );
                if (normPart.length === splitNorm) {
                  splits.push(cssText.substring(0, k));
                  cssText = cssText.substring(k);
                  cssTextNorm = cssTextNorm.substring(splitNorm);
                  break;
                } else if (normPart.length < splitNorm) {
                  k += Math.max(
                    1,
                    Math.floor((splitNorm - normPart.length) / normFactor)
                  );
                } else {
                  k -= Math.max(
                    1,
                    Math.floor((normPart.length - splitNorm) * normFactor)
                  );
                }
              }
              break;
            }
          }
        }
      }
    }
    splits.push(cssText);
    return splits;
  }
  function markCssSplits(cssText, style) {
    return splitCssText(cssText, style).join("/* rr_split */");
  }
  var _id = 1;
  var tagNameRegex = new RegExp("[^a-z0-9-_:]");
  var IGNORED_NODE = -2;
  function genId() {
    return _id++;
  }
  function getValidTagName$1(element) {
    if (element instanceof HTMLFormElement) {
      return "form";
    }
    const processedTagName = toLowerCase(element.tagName);
    if (tagNameRegex.test(processedTagName)) {
      return "div";
    }
    return processedTagName;
  }
  var canvasService;
  var canvasCtx;
  var SRCSET_NOT_SPACES = /^[^ \t\n\r\u000c]+/;
  var SRCSET_COMMAS_OR_SPACES = /^[, \t\n\r\u000c]+/;
  function getAbsoluteSrcsetString(doc, attributeValue) {
    if (attributeValue.trim() === "") {
      return attributeValue;
    }
    let pos = 0;
    function collectCharacters(regEx) {
      let chars2;
      const match = regEx.exec(attributeValue.substring(pos));
      if (match) {
        chars2 = match[0];
        pos += chars2.length;
        return chars2;
      }
      return "";
    }
    const output = [];
    while (true) {
      collectCharacters(SRCSET_COMMAS_OR_SPACES);
      if (pos >= attributeValue.length) {
        break;
      }
      let url = collectCharacters(SRCSET_NOT_SPACES);
      if (url.slice(-1) === ",") {
        url = absoluteToDoc(doc, url.substring(0, url.length - 1));
        output.push(url);
      } else {
        let descriptorsStr = "";
        url = absoluteToDoc(doc, url);
        let inParens = false;
        while (true) {
          const c2 = attributeValue.charAt(pos);
          if (c2 === "") {
            output.push((url + descriptorsStr).trim());
            break;
          } else if (!inParens) {
            if (c2 === ",") {
              pos += 1;
              output.push((url + descriptorsStr).trim());
              break;
            } else if (c2 === "(") {
              inParens = true;
            }
          } else {
            if (c2 === ")") {
              inParens = false;
            }
          }
          descriptorsStr += c2;
          pos += 1;
        }
      }
    }
    return output.join(", ");
  }
  var cachedDocument = /* @__PURE__ */ new WeakMap();
  function absoluteToDoc(doc, attributeValue) {
    if (!attributeValue || attributeValue.trim() === "") {
      return attributeValue;
    }
    return getHref(doc, attributeValue);
  }
  function isSVGElement(el) {
    return Boolean(el.tagName === "svg" || el.ownerSVGElement);
  }
  function getHref(doc, customHref) {
    let a2 = cachedDocument.get(doc);
    if (!a2) {
      a2 = doc.createElement("a");
      cachedDocument.set(doc, a2);
    }
    if (!customHref) {
      customHref = "";
    } else if (customHref.startsWith("blob:") || customHref.startsWith("data:")) {
      return customHref;
    }
    a2.setAttribute("href", customHref);
    return a2.href;
  }
  function transformAttribute(doc, tagName, name, value) {
    if (!value) {
      return value;
    }
    if (name === "src" || name === "href" && !(tagName === "use" && value[0] === "#")) {
      return absoluteToDoc(doc, value);
    } else if (name === "xlink:href" && value[0] !== "#") {
      return absoluteToDoc(doc, value);
    } else if (name === "background" && ["table", "td", "th"].includes(tagName)) {
      return absoluteToDoc(doc, value);
    } else if (name === "srcset") {
      return getAbsoluteSrcsetString(doc, value);
    } else if (name === "style") {
      return absolutifyURLs(value, getHref(doc));
    } else if (tagName === "object" && name === "data") {
      return absoluteToDoc(doc, value);
    }
    return value;
  }
  function ignoreAttribute(tagName, name, _value) {
    return ["video", "audio"].includes(tagName) && name === "autoplay";
  }
  function _isBlockedElement(element, blockClass, blockSelector) {
    try {
      if (typeof blockClass === "string") {
        if (element.classList.contains(blockClass)) {
          return true;
        }
      } else {
        for (let eIndex = element.classList.length; eIndex--; ) {
          const className = element.classList[eIndex];
          if (blockClass.test(className)) {
            return true;
          }
        }
      }
      if (blockSelector) {
        return element.matches(blockSelector);
      }
    } catch (e2) {
    }
    return false;
  }
  function classMatchesRegex(node2, regex, checkAncestors) {
    if (!node2) return false;
    if (node2.nodeType !== node2.ELEMENT_NODE) {
      if (!checkAncestors) return false;
      return classMatchesRegex(index$1.parentNode(node2), regex, checkAncestors);
    }
    for (let eIndex = node2.classList.length; eIndex--; ) {
      const className = node2.classList[eIndex];
      if (regex.test(className)) {
        return true;
      }
    }
    if (!checkAncestors) return false;
    return classMatchesRegex(index$1.parentNode(node2), regex, checkAncestors);
  }
  function needMaskingText(node2, maskTextClass, maskTextSelector, checkAncestors) {
    let el;
    if (isElement(node2)) {
      el = node2;
      if (!index$1.childNodes(el).length) {
        return false;
      }
    } else if (index$1.parentElement(node2) === null) {
      return false;
    } else {
      el = index$1.parentElement(node2);
    }
    try {
      if (typeof maskTextClass === "string") {
        if (checkAncestors) {
          if (el.closest(`.${maskTextClass}`)) return true;
        } else {
          if (el.classList.contains(maskTextClass)) return true;
        }
      } else {
        if (classMatchesRegex(el, maskTextClass, checkAncestors)) return true;
      }
      if (maskTextSelector) {
        if (checkAncestors) {
          if (el.closest(maskTextSelector)) return true;
        } else {
          if (el.matches(maskTextSelector)) return true;
        }
      }
    } catch (e2) {
    }
    return false;
  }
  function onceIframeLoaded(iframeEl, listener, iframeLoadTimeout) {
    const win = iframeEl.contentWindow;
    if (!win) {
      return;
    }
    let fired = false;
    let readyState;
    try {
      readyState = win.document.readyState;
    } catch (error) {
      return;
    }
    if (readyState !== "complete") {
      const timer = setTimeout(() => {
        if (!fired) {
          listener();
          fired = true;
        }
      }, iframeLoadTimeout);
      iframeEl.addEventListener("load", () => {
        clearTimeout(timer);
        fired = true;
        listener();
      });
      return;
    }
    const blankUrl = "about:blank";
    if (win.location.href !== blankUrl || iframeEl.src === blankUrl || iframeEl.src === "") {
      setTimeout(listener, 0);
      return iframeEl.addEventListener("load", listener);
    }
    iframeEl.addEventListener("load", listener);
  }
  function onceStylesheetLoaded(link, listener, styleSheetLoadTimeout) {
    let fired = false;
    let styleSheetLoaded;
    try {
      styleSheetLoaded = link.sheet;
    } catch (error) {
      return;
    }
    if (styleSheetLoaded) return;
    const timer = setTimeout(() => {
      if (!fired) {
        listener();
        fired = true;
      }
    }, styleSheetLoadTimeout);
    link.addEventListener("load", () => {
      clearTimeout(timer);
      fired = true;
      listener();
    });
  }
  function serializeNode(n2, options) {
    const {
      doc,
      mirror: mirror2,
      blockClass,
      blockSelector,
      needsMask,
      inlineStylesheet,
      maskInputOptions = {},
      maskTextFn,
      maskInputFn,
      dataURLOptions = {},
      inlineImages,
      recordCanvas,
      keepIframeSrcFn,
      newlyAddedElement = false,
      cssCaptured = false
    } = options;
    const rootId = getRootId(doc, mirror2);
    switch (n2.nodeType) {
      case n2.DOCUMENT_NODE:
        if (n2.compatMode !== "CSS1Compat") {
          return {
            type: NodeType$3.Document,
            childNodes: [],
            compatMode: n2.compatMode
            // probably "BackCompat"
          };
        } else {
          return {
            type: NodeType$3.Document,
            childNodes: []
          };
        }
      case n2.DOCUMENT_TYPE_NODE:
        return {
          type: NodeType$3.DocumentType,
          name: n2.name,
          publicId: n2.publicId,
          systemId: n2.systemId,
          rootId
        };
      case n2.ELEMENT_NODE:
        return serializeElementNode(n2, {
          doc,
          blockClass,
          blockSelector,
          inlineStylesheet,
          maskInputOptions,
          maskInputFn,
          dataURLOptions,
          inlineImages,
          recordCanvas,
          keepIframeSrcFn,
          newlyAddedElement,
          rootId
        });
      case n2.TEXT_NODE:
        return serializeTextNode(n2, {
          doc,
          needsMask,
          maskTextFn,
          rootId,
          cssCaptured
        });
      case n2.CDATA_SECTION_NODE:
        return {
          type: NodeType$3.CDATA,
          textContent: "",
          rootId
        };
      case n2.COMMENT_NODE:
        return {
          type: NodeType$3.Comment,
          textContent: index$1.textContent(n2) || "",
          rootId
        };
      default:
        return false;
    }
  }
  function getRootId(doc, mirror2) {
    if (!mirror2.hasNode(doc)) return void 0;
    const docId = mirror2.getId(doc);
    return docId === 1 ? void 0 : docId;
  }
  function serializeTextNode(n2, options) {
    const { needsMask, maskTextFn, rootId, cssCaptured } = options;
    const parent = index$1.parentNode(n2);
    const parentTagName = parent && parent.tagName;
    let textContent2 = "";
    const isStyle = parentTagName === "STYLE" ? true : void 0;
    const isScript = parentTagName === "SCRIPT" ? true : void 0;
    if (isScript) {
      textContent2 = "SCRIPT_PLACEHOLDER";
    } else if (!cssCaptured) {
      textContent2 = index$1.textContent(n2);
      if (isStyle && textContent2) {
        textContent2 = absolutifyURLs(textContent2, getHref(options.doc));
      }
    }
    if (!isStyle && !isScript && textContent2 && needsMask) {
      textContent2 = maskTextFn ? maskTextFn(textContent2, index$1.parentElement(n2)) : textContent2.replace(/[\S]/g, "*");
    }
    return {
      type: NodeType$3.Text,
      textContent: textContent2 || "",
      rootId
    };
  }
  function serializeElementNode(n2, options) {
    const {
      doc,
      blockClass,
      blockSelector,
      inlineStylesheet,
      maskInputOptions = {},
      maskInputFn,
      dataURLOptions = {},
      inlineImages,
      recordCanvas,
      keepIframeSrcFn,
      newlyAddedElement = false,
      rootId
    } = options;
    const needBlock = _isBlockedElement(n2, blockClass, blockSelector);
    const tagName = getValidTagName$1(n2);
    let attributes2 = {};
    const len = n2.attributes.length;
    for (let i2 = 0; i2 < len; i2++) {
      const attr = n2.attributes[i2];
      if (!ignoreAttribute(tagName, attr.name, attr.value)) {
        attributes2[attr.name] = transformAttribute(
          doc,
          tagName,
          toLowerCase(attr.name),
          attr.value
        );
      }
    }
    if (tagName === "link" && inlineStylesheet) {
      const stylesheet = Array.from(doc.styleSheets).find((s2) => {
        return s2.href === n2.href;
      });
      let cssText = null;
      if (stylesheet) {
        cssText = stringifyStylesheet(stylesheet);
      }
      if (cssText) {
        delete attributes2.rel;
        delete attributes2.href;
        attributes2._cssText = cssText;
      }
    }
    if (tagName === "style" && n2.sheet) {
      let cssText = stringifyStylesheet(
        n2.sheet
      );
      if (cssText) {
        if (n2.childNodes.length > 1) {
          cssText = markCssSplits(cssText, n2);
        }
        attributes2._cssText = cssText;
      }
    }
    if (["input", "textarea", "select"].includes(tagName)) {
      const value = n2.value;
      const checked = n2.checked;
      if (attributes2.type !== "radio" && attributes2.type !== "checkbox" && attributes2.type !== "submit" && attributes2.type !== "button" && value) {
        attributes2.value = maskInputValue({
          element: n2,
          type: getInputType(n2),
          tagName,
          value,
          maskInputOptions,
          maskInputFn
        });
      } else if (checked) {
        attributes2.checked = checked;
      }
    }
    if (tagName === "option") {
      if (n2.selected && !maskInputOptions["select"]) {
        attributes2.selected = true;
      } else {
        delete attributes2.selected;
      }
    }
    if (tagName === "dialog" && n2.open) {
      attributes2.rr_open_mode = n2.matches("dialog:modal") ? "modal" : "non-modal";
    }
    if (tagName === "canvas" && recordCanvas) {
      if (n2.__context === "2d") {
        if (!is2DCanvasBlank(n2)) {
          attributes2.rr_dataURL = n2.toDataURL(
            dataURLOptions.type,
            dataURLOptions.quality
          );
        }
      } else if (!("__context" in n2)) {
        const canvasDataURL = n2.toDataURL(
          dataURLOptions.type,
          dataURLOptions.quality
        );
        const blankCanvas = doc.createElement("canvas");
        blankCanvas.width = n2.width;
        blankCanvas.height = n2.height;
        const blankCanvasDataURL = blankCanvas.toDataURL(
          dataURLOptions.type,
          dataURLOptions.quality
        );
        if (canvasDataURL !== blankCanvasDataURL) {
          attributes2.rr_dataURL = canvasDataURL;
        }
      }
    }
    if (tagName === "img" && inlineImages) {
      if (!canvasService) {
        canvasService = doc.createElement("canvas");
        canvasCtx = canvasService.getContext("2d");
      }
      const image = n2;
      const imageSrc = image.currentSrc || image.getAttribute("src") || "<unknown-src>";
      const priorCrossOrigin = image.crossOrigin;
      const recordInlineImage = () => {
        image.removeEventListener("load", recordInlineImage);
        try {
          canvasService.width = image.naturalWidth;
          canvasService.height = image.naturalHeight;
          canvasCtx.drawImage(image, 0, 0);
          attributes2.rr_dataURL = canvasService.toDataURL(
            dataURLOptions.type,
            dataURLOptions.quality
          );
        } catch (err2) {
          if (image.crossOrigin !== "anonymous") {
            image.crossOrigin = "anonymous";
            if (image.complete && image.naturalWidth !== 0)
              recordInlineImage();
            else image.addEventListener("load", recordInlineImage);
            return;
          } else {
            console.warn(
              `Cannot inline img src=${imageSrc}! Error: ${err2}`
            );
          }
        }
        if (image.crossOrigin === "anonymous") {
          priorCrossOrigin ? attributes2.crossOrigin = priorCrossOrigin : image.removeAttribute("crossorigin");
        }
      };
      if (image.complete && image.naturalWidth !== 0) recordInlineImage();
      else image.addEventListener("load", recordInlineImage);
    }
    if (["audio", "video"].includes(tagName)) {
      const mediaAttributes = attributes2;
      mediaAttributes.rr_mediaState = n2.paused ? "paused" : "played";
      mediaAttributes.rr_mediaCurrentTime = n2.currentTime;
      mediaAttributes.rr_mediaPlaybackRate = n2.playbackRate;
      mediaAttributes.rr_mediaMuted = n2.muted;
      mediaAttributes.rr_mediaLoop = n2.loop;
      mediaAttributes.rr_mediaVolume = n2.volume;
    }
    if (!newlyAddedElement) {
      if (n2.scrollLeft) {
        attributes2.rr_scrollLeft = n2.scrollLeft;
      }
      if (n2.scrollTop) {
        attributes2.rr_scrollTop = n2.scrollTop;
      }
    }
    if (needBlock) {
      const { width, height } = n2.getBoundingClientRect();
      attributes2 = {
        class: attributes2.class,
        rr_width: `${width}px`,
        rr_height: `${height}px`
      };
    }
    if (tagName === "iframe" && !keepIframeSrcFn(attributes2.src)) {
      if (!n2.contentDocument) {
        attributes2.rr_src = attributes2.src;
      }
      delete attributes2.src;
    }
    let isCustomElement;
    try {
      if (customElements.get(tagName)) isCustomElement = true;
    } catch (e2) {
    }
    return {
      type: NodeType$3.Element,
      tagName,
      attributes: attributes2,
      childNodes: [],
      isSVG: isSVGElement(n2) || void 0,
      needBlock,
      rootId,
      isCustom: isCustomElement
    };
  }
  function lowerIfExists(maybeAttr) {
    if (maybeAttr === void 0 || maybeAttr === null) {
      return "";
    } else {
      return maybeAttr.toLowerCase();
    }
  }
  function slimDOMDefaults(_slimDOMOptions) {
    if (_slimDOMOptions === true || _slimDOMOptions === "all") {
      return {
        script: true,
        comment: true,
        headFavicon: true,
        headWhitespace: true,
        headMetaSocial: true,
        headMetaRobots: true,
        headMetaHttpEquiv: true,
        headMetaVerification: true,
        // the following are off for slimDOMOptions === true,
        // as they destroy some (hidden) info:
        headMetaAuthorship: _slimDOMOptions === "all",
        headMetaDescKeywords: _slimDOMOptions === "all",
        headTitleMutations: _slimDOMOptions === "all"
      };
    } else if (_slimDOMOptions) {
      return _slimDOMOptions;
    }
    return {};
  }
  function slimDOMExcluded(sn, slimDOMOptions) {
    if (slimDOMOptions.comment && sn.type === NodeType$3.Comment) {
      return true;
    } else if (sn.type === NodeType$3.Element) {
      if (slimDOMOptions.script && // script tag
      (sn.tagName === "script" || // (module)preload link
      sn.tagName === "link" && (sn.attributes.rel === "preload" && sn.attributes.as === "script" || sn.attributes.rel === "modulepreload") || // prefetch link
      sn.tagName === "link" && sn.attributes.rel === "prefetch" && typeof sn.attributes.href === "string" && extractFileExtension(sn.attributes.href) === "js")) {
        return true;
      } else if (slimDOMOptions.headFavicon && (sn.tagName === "link" && sn.attributes.rel === "shortcut icon" || sn.tagName === "meta" && (lowerIfExists(sn.attributes.name).match(
        /^msapplication-tile(image|color)$/
      ) || lowerIfExists(sn.attributes.name) === "application-name" || lowerIfExists(sn.attributes.rel) === "icon" || lowerIfExists(sn.attributes.rel) === "apple-touch-icon" || lowerIfExists(sn.attributes.rel) === "shortcut icon"))) {
        return true;
      } else if (sn.tagName === "meta") {
        if (slimDOMOptions.headMetaDescKeywords && lowerIfExists(sn.attributes.name).match(/^description|keywords$/)) {
          return true;
        } else if (slimDOMOptions.headMetaSocial && (lowerIfExists(sn.attributes.property).match(/^(og|twitter|fb):/) || // og = opengraph (facebook)
        lowerIfExists(sn.attributes.name).match(/^(og|twitter):/) || lowerIfExists(sn.attributes.name) === "pinterest")) {
          return true;
        } else if (slimDOMOptions.headMetaRobots && (lowerIfExists(sn.attributes.name) === "robots" || lowerIfExists(sn.attributes.name) === "googlebot" || lowerIfExists(sn.attributes.name) === "bingbot")) {
          return true;
        } else if (slimDOMOptions.headMetaHttpEquiv && sn.attributes["http-equiv"] !== void 0) {
          return true;
        } else if (slimDOMOptions.headMetaAuthorship && (lowerIfExists(sn.attributes.name) === "author" || lowerIfExists(sn.attributes.name) === "generator" || lowerIfExists(sn.attributes.name) === "framework" || lowerIfExists(sn.attributes.name) === "publisher" || lowerIfExists(sn.attributes.name) === "progid" || lowerIfExists(sn.attributes.property).match(/^article:/) || lowerIfExists(sn.attributes.property).match(/^product:/))) {
          return true;
        } else if (slimDOMOptions.headMetaVerification && (lowerIfExists(sn.attributes.name) === "google-site-verification" || lowerIfExists(sn.attributes.name) === "yandex-verification" || lowerIfExists(sn.attributes.name) === "csrf-token" || lowerIfExists(sn.attributes.name) === "p:domain_verify" || lowerIfExists(sn.attributes.name) === "verify-v1" || lowerIfExists(sn.attributes.name) === "verification" || lowerIfExists(sn.attributes.name) === "shopify-checkout-api-token")) {
          return true;
        }
      }
    }
    return false;
  }
  function serializeNodeWithId(n2, options) {
    const {
      doc,
      mirror: mirror2,
      blockClass,
      blockSelector,
      maskTextClass,
      maskTextSelector,
      skipChild = false,
      inlineStylesheet = true,
      maskInputOptions = {},
      maskTextFn,
      maskInputFn,
      slimDOMOptions,
      dataURLOptions = {},
      inlineImages = false,
      recordCanvas = false,
      onSerialize,
      onIframeLoad,
      iframeLoadTimeout = 5e3,
      onStylesheetLoad,
      stylesheetLoadTimeout = 5e3,
      keepIframeSrcFn = () => false,
      newlyAddedElement = false,
      cssCaptured = false
    } = options;
    let { needsMask } = options;
    let { preserveWhiteSpace = true } = options;
    if (!needsMask) {
      const checkAncestors = needsMask === void 0;
      needsMask = needMaskingText(
        n2,
        maskTextClass,
        maskTextSelector,
        checkAncestors
      );
    }
    const _serializedNode = serializeNode(n2, {
      doc,
      mirror: mirror2,
      blockClass,
      blockSelector,
      needsMask,
      inlineStylesheet,
      maskInputOptions,
      maskTextFn,
      maskInputFn,
      dataURLOptions,
      inlineImages,
      recordCanvas,
      keepIframeSrcFn,
      newlyAddedElement,
      cssCaptured
    });
    if (!_serializedNode) {
      console.warn(n2, "not serialized");
      return null;
    }
    let id;
    if (mirror2.hasNode(n2)) {
      id = mirror2.getId(n2);
    } else if (slimDOMExcluded(_serializedNode, slimDOMOptions) || !preserveWhiteSpace && _serializedNode.type === NodeType$3.Text && !_serializedNode.textContent.replace(/^\s+|\s+$/gm, "").length) {
      id = IGNORED_NODE;
    } else {
      id = genId();
    }
    const serializedNode = Object.assign(_serializedNode, { id });
    mirror2.add(n2, serializedNode);
    if (id === IGNORED_NODE) {
      return null;
    }
    if (onSerialize) {
      onSerialize(n2);
    }
    let recordChild = !skipChild;
    if (serializedNode.type === NodeType$3.Element) {
      recordChild = recordChild && !serializedNode.needBlock;
      delete serializedNode.needBlock;
      const shadowRootEl = index$1.shadowRoot(n2);
      if (shadowRootEl && isNativeShadowDom(shadowRootEl))
        serializedNode.isShadowHost = true;
    }
    if ((serializedNode.type === NodeType$3.Document || serializedNode.type === NodeType$3.Element) && recordChild) {
      if (slimDOMOptions.headWhitespace && serializedNode.type === NodeType$3.Element && serializedNode.tagName === "head") {
        preserveWhiteSpace = false;
      }
      const bypassOptions = {
        doc,
        mirror: mirror2,
        blockClass,
        blockSelector,
        needsMask,
        maskTextClass,
        maskTextSelector,
        skipChild,
        inlineStylesheet,
        maskInputOptions,
        maskTextFn,
        maskInputFn,
        slimDOMOptions,
        dataURLOptions,
        inlineImages,
        recordCanvas,
        preserveWhiteSpace,
        onSerialize,
        onIframeLoad,
        iframeLoadTimeout,
        onStylesheetLoad,
        stylesheetLoadTimeout,
        keepIframeSrcFn,
        cssCaptured: false
      };
      if (serializedNode.type === NodeType$3.Element && serializedNode.tagName === "textarea" && serializedNode.attributes.value !== void 0) ;
      else {
        if (serializedNode.type === NodeType$3.Element && serializedNode.attributes._cssText !== void 0 && typeof serializedNode.attributes._cssText === "string") {
          bypassOptions.cssCaptured = true;
        }
        for (const childN of Array.from(index$1.childNodes(n2))) {
          const serializedChildNode = serializeNodeWithId(childN, bypassOptions);
          if (serializedChildNode) {
            serializedNode.childNodes.push(serializedChildNode);
          }
        }
      }
      let shadowRootEl = null;
      if (isElement(n2) && (shadowRootEl = index$1.shadowRoot(n2))) {
        for (const childN of Array.from(index$1.childNodes(shadowRootEl))) {
          const serializedChildNode = serializeNodeWithId(childN, bypassOptions);
          if (serializedChildNode) {
            isNativeShadowDom(shadowRootEl) && (serializedChildNode.isShadow = true);
            serializedNode.childNodes.push(serializedChildNode);
          }
        }
      }
    }
    const parent = index$1.parentNode(n2);
    if (parent && isShadowRoot(parent) && isNativeShadowDom(parent)) {
      serializedNode.isShadow = true;
    }
    if (serializedNode.type === NodeType$3.Element && serializedNode.tagName === "iframe") {
      onceIframeLoaded(
        n2,
        () => {
          const iframeDoc = n2.contentDocument;
          if (iframeDoc && onIframeLoad) {
            const serializedIframeNode = serializeNodeWithId(iframeDoc, {
              doc: iframeDoc,
              mirror: mirror2,
              blockClass,
              blockSelector,
              needsMask,
              maskTextClass,
              maskTextSelector,
              skipChild: false,
              inlineStylesheet,
              maskInputOptions,
              maskTextFn,
              maskInputFn,
              slimDOMOptions,
              dataURLOptions,
              inlineImages,
              recordCanvas,
              preserveWhiteSpace,
              onSerialize,
              onIframeLoad,
              iframeLoadTimeout,
              onStylesheetLoad,
              stylesheetLoadTimeout,
              keepIframeSrcFn
            });
            if (serializedIframeNode) {
              onIframeLoad(
                n2,
                serializedIframeNode
              );
            }
          }
        },
        iframeLoadTimeout
      );
    }
    if (serializedNode.type === NodeType$3.Element && serializedNode.tagName === "link" && typeof serializedNode.attributes.rel === "string" && (serializedNode.attributes.rel === "stylesheet" || serializedNode.attributes.rel === "preload" && typeof serializedNode.attributes.href === "string" && extractFileExtension(serializedNode.attributes.href) === "css")) {
      onceStylesheetLoaded(
        n2,
        () => {
          if (onStylesheetLoad) {
            const serializedLinkNode = serializeNodeWithId(n2, {
              doc,
              mirror: mirror2,
              blockClass,
              blockSelector,
              needsMask,
              maskTextClass,
              maskTextSelector,
              skipChild: false,
              inlineStylesheet,
              maskInputOptions,
              maskTextFn,
              maskInputFn,
              slimDOMOptions,
              dataURLOptions,
              inlineImages,
              recordCanvas,
              preserveWhiteSpace,
              onSerialize,
              onIframeLoad,
              iframeLoadTimeout,
              onStylesheetLoad,
              stylesheetLoadTimeout,
              keepIframeSrcFn
            });
            if (serializedLinkNode) {
              onStylesheetLoad(
                n2,
                serializedLinkNode
              );
            }
          }
        },
        stylesheetLoadTimeout
      );
    }
    return serializedNode;
  }
  function snapshot(n2, options) {
    const {
      mirror: mirror2 = new Mirror(),
      blockClass = "rr-block",
      blockSelector = null,
      maskTextClass = "rr-mask",
      maskTextSelector = null,
      inlineStylesheet = true,
      inlineImages = false,
      recordCanvas = false,
      maskAllInputs = false,
      maskTextFn,
      maskInputFn,
      slimDOM = false,
      dataURLOptions,
      preserveWhiteSpace,
      onSerialize,
      onIframeLoad,
      iframeLoadTimeout,
      onStylesheetLoad,
      stylesheetLoadTimeout,
      keepIframeSrcFn = () => false
    } = options || {};
    const maskInputOptions = maskAllInputs === true ? {
      color: true,
      date: true,
      "datetime-local": true,
      email: true,
      month: true,
      number: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true,
      textarea: true,
      select: true,
      password: true
    } : maskAllInputs === false ? {
      password: true
    } : maskAllInputs;
    const slimDOMOptions = slimDOMDefaults(slimDOM);
    return serializeNodeWithId(n2, {
      doc: n2,
      mirror: mirror2,
      blockClass,
      blockSelector,
      maskTextClass,
      maskTextSelector,
      skipChild: false,
      inlineStylesheet,
      maskInputOptions,
      maskTextFn,
      maskInputFn,
      slimDOMOptions,
      dataURLOptions,
      inlineImages,
      recordCanvas,
      preserveWhiteSpace,
      onSerialize,
      onIframeLoad,
      iframeLoadTimeout,
      onStylesheetLoad,
      stylesheetLoadTimeout,
      keepIframeSrcFn,
      newlyAddedElement: false
    });
  }
  function getDefaultExportFromCjs$1(x2) {
    return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
  }
  function getAugmentedNamespace$1(n2) {
    if (n2.__esModule) return n2;
    var f2 = n2.default;
    if (typeof f2 == "function") {
      var a2 = function a22() {
        if (this instanceof a22) {
          return Reflect.construct(f2, arguments, this.constructor);
        }
        return f2.apply(this, arguments);
      };
      a2.prototype = f2.prototype;
    } else a2 = {};
    Object.defineProperty(a2, "__esModule", { value: true });
    Object.keys(n2).forEach(function(k) {
      var d = Object.getOwnPropertyDescriptor(n2, k);
      Object.defineProperty(a2, k, d.get ? d : {
        enumerable: true,
        get: function() {
          return n2[k];
        }
      });
    });
    return a2;
  }
  var picocolors_browser$1 = { exports: {} };
  var x$1 = String;
  var create$1 = function() {
    return { isColorSupported: false, reset: x$1, bold: x$1, dim: x$1, italic: x$1, underline: x$1, inverse: x$1, hidden: x$1, strikethrough: x$1, black: x$1, red: x$1, green: x$1, yellow: x$1, blue: x$1, magenta: x$1, cyan: x$1, white: x$1, gray: x$1, bgBlack: x$1, bgRed: x$1, bgGreen: x$1, bgYellow: x$1, bgBlue: x$1, bgMagenta: x$1, bgCyan: x$1, bgWhite: x$1 };
  };
  picocolors_browser$1.exports = create$1();
  picocolors_browser$1.exports.createColors = create$1;
  var picocolors_browserExports$1 = picocolors_browser$1.exports;
  var __viteBrowserExternal$2 = {};
  var __viteBrowserExternal$1$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: __viteBrowserExternal$2
  }, Symbol.toStringTag, { value: "Module" }));
  var require$$2$1 = /* @__PURE__ */ getAugmentedNamespace$1(__viteBrowserExternal$1$1);
  var pico$1 = picocolors_browserExports$1;
  var terminalHighlight$1$1 = require$$2$1;
  var CssSyntaxError$3$1 = class CssSyntaxError extends Error {
    constructor(message, line, column, source, file, plugin22) {
      super(message);
      this.name = "CssSyntaxError";
      this.reason = message;
      if (file) {
        this.file = file;
      }
      if (source) {
        this.source = source;
      }
      if (plugin22) {
        this.plugin = plugin22;
      }
      if (typeof line !== "undefined" && typeof column !== "undefined") {
        if (typeof line === "number") {
          this.line = line;
          this.column = column;
        } else {
          this.line = line.line;
          this.column = line.column;
          this.endLine = column.line;
          this.endColumn = column.column;
        }
      }
      this.setMessage();
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CssSyntaxError);
      }
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "";
      this.message += this.file ? this.file : "<css input>";
      if (typeof this.line !== "undefined") {
        this.message += ":" + this.line + ":" + this.column;
      }
      this.message += ": " + this.reason;
    }
    showSourceCode(color) {
      if (!this.source) return "";
      let css = this.source;
      if (color == null) color = pico$1.isColorSupported;
      if (terminalHighlight$1$1) {
        if (color) css = terminalHighlight$1$1(css);
      }
      let lines = css.split(/\r?\n/);
      let start = Math.max(this.line - 3, 0);
      let end = Math.min(this.line + 2, lines.length);
      let maxWidth = String(end).length;
      let mark, aside;
      if (color) {
        let { bold, gray, red } = pico$1.createColors(true);
        mark = (text) => bold(red(text));
        aside = (text) => gray(text);
      } else {
        mark = aside = (str) => str;
      }
      return lines.slice(start, end).map((line, index2) => {
        let number = start + 1 + index2;
        let gutter = " " + (" " + number).slice(-maxWidth) + " | ";
        if (number === this.line) {
          let spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return mark(">") + aside(gutter) + line + "\n " + spacing + mark("^");
        }
        return " " + aside(gutter) + line;
      }).join("\n");
    }
    toString() {
      let code = this.showSourceCode();
      if (code) {
        code = "\n\n" + code + "\n";
      }
      return this.name + ": " + this.message + code;
    }
  };
  var cssSyntaxError$1 = CssSyntaxError$3$1;
  CssSyntaxError$3$1.default = CssSyntaxError$3$1;
  var symbols$1 = {};
  symbols$1.isClean = Symbol("isClean");
  symbols$1.my = Symbol("my");
  var DEFAULT_RAW$1 = {
    after: "\n",
    beforeClose: "\n",
    beforeComment: "\n",
    beforeDecl: "\n",
    beforeOpen: " ",
    beforeRule: "\n",
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: false
  };
  function capitalize$1(str) {
    return str[0].toUpperCase() + str.slice(1);
  }
  var Stringifier$2$1 = class Stringifier {
    constructor(builder) {
      this.builder = builder;
    }
    atrule(node2, semicolon) {
      let name = "@" + node2.name;
      let params = node2.params ? this.rawValue(node2, "params") : "";
      if (typeof node2.raws.afterName !== "undefined") {
        name += node2.raws.afterName;
      } else if (params) {
        name += " ";
      }
      if (node2.nodes) {
        this.block(node2, name + params);
      } else {
        let end = (node2.raws.between || "") + (semicolon ? ";" : "");
        this.builder(name + params + end, node2);
      }
    }
    beforeAfter(node2, detect) {
      let value;
      if (node2.type === "decl") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (node2.type === "comment") {
        value = this.raw(node2, null, "beforeComment");
      } else if (detect === "before") {
        value = this.raw(node2, null, "beforeRule");
      } else {
        value = this.raw(node2, null, "beforeClose");
      }
      let buf = node2.parent;
      let depth = 0;
      while (buf && buf.type !== "root") {
        depth += 1;
        buf = buf.parent;
      }
      if (value.includes("\n")) {
        let indent = this.raw(node2, null, "indent");
        if (indent.length) {
          for (let step = 0; step < depth; step++) value += indent;
        }
      }
      return value;
    }
    block(node2, start) {
      let between = this.raw(node2, "between", "beforeOpen");
      this.builder(start + between + "{", node2, "start");
      let after;
      if (node2.nodes && node2.nodes.length) {
        this.body(node2);
        after = this.raw(node2, "after");
      } else {
        after = this.raw(node2, "after", "emptyBody");
      }
      if (after) this.builder(after);
      this.builder("}", node2, "end");
    }
    body(node2) {
      let last = node2.nodes.length - 1;
      while (last > 0) {
        if (node2.nodes[last].type !== "comment") break;
        last -= 1;
      }
      let semicolon = this.raw(node2, "semicolon");
      for (let i2 = 0; i2 < node2.nodes.length; i2++) {
        let child = node2.nodes[i2];
        let before = this.raw(child, "before");
        if (before) this.builder(before);
        this.stringify(child, last !== i2 || semicolon);
      }
    }
    comment(node2) {
      let left = this.raw(node2, "left", "commentLeft");
      let right = this.raw(node2, "right", "commentRight");
      this.builder("/*" + left + node2.text + right + "*/", node2);
    }
    decl(node2, semicolon) {
      let between = this.raw(node2, "between", "colon");
      let string = node2.prop + between + this.rawValue(node2, "value");
      if (node2.important) {
        string += node2.raws.important || " !important";
      }
      if (semicolon) string += ";";
      this.builder(string, node2);
    }
    document(node2) {
      this.body(node2);
    }
    raw(node2, own, detect) {
      let value;
      if (!detect) detect = own;
      if (own) {
        value = node2.raws[own];
        if (typeof value !== "undefined") return value;
      }
      let parent = node2.parent;
      if (detect === "before") {
        if (!parent || parent.type === "root" && parent.first === node2) {
          return "";
        }
        if (parent && parent.type === "document") {
          return "";
        }
      }
      if (!parent) return DEFAULT_RAW$1[detect];
      let root2 = node2.root();
      if (!root2.rawCache) root2.rawCache = {};
      if (typeof root2.rawCache[detect] !== "undefined") {
        return root2.rawCache[detect];
      }
      if (detect === "before" || detect === "after") {
        return this.beforeAfter(node2, detect);
      } else {
        let method = "raw" + capitalize$1(detect);
        if (this[method]) {
          value = this[method](root2, node2);
        } else {
          root2.walk((i2) => {
            value = i2.raws[own];
            if (typeof value !== "undefined") return false;
          });
        }
      }
      if (typeof value === "undefined") value = DEFAULT_RAW$1[detect];
      root2.rawCache[detect] = value;
      return value;
    }
    rawBeforeClose(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length > 0) {
          if (typeof i2.raws.after !== "undefined") {
            value = i2.raws.after;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawBeforeComment(root2, node2) {
      let value;
      root2.walkComments((i2) => {
        if (typeof i2.raws.before !== "undefined") {
          value = i2.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeDecl(root2, node2) {
      let value;
      root2.walkDecls((i2) => {
        if (typeof i2.raws.before !== "undefined") {
          value = i2.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeRule");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeOpen(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.type !== "decl") {
          value = i2.raws.between;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawBeforeRule(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && (i2.parent !== root2 || root2.first !== i2)) {
          if (typeof i2.raws.before !== "undefined") {
            value = i2.raws.before;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawColon(root2) {
      let value;
      root2.walkDecls((i2) => {
        if (typeof i2.raws.between !== "undefined") {
          value = i2.raws.between.replace(/[^\s:]/g, "");
          return false;
        }
      });
      return value;
    }
    rawEmptyBody(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length === 0) {
          value = i2.raws.after;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawIndent(root2) {
      if (root2.raws.indent) return root2.raws.indent;
      let value;
      root2.walk((i2) => {
        let p = i2.parent;
        if (p && p !== root2 && p.parent && p.parent === root2) {
          if (typeof i2.raws.before !== "undefined") {
            let parts = i2.raws.before.split("\n");
            value = parts[parts.length - 1];
            value = value.replace(/\S/g, "");
            return false;
          }
        }
      });
      return value;
    }
    rawSemicolon(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length && i2.last.type === "decl") {
          value = i2.raws.semicolon;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawValue(node2, prop) {
      let value = node2[prop];
      let raw = node2.raws[prop];
      if (raw && raw.value === value) {
        return raw.raw;
      }
      return value;
    }
    root(node2) {
      this.body(node2);
      if (node2.raws.after) this.builder(node2.raws.after);
    }
    rule(node2) {
      this.block(node2, this.rawValue(node2, "selector"));
      if (node2.raws.ownSemicolon) {
        this.builder(node2.raws.ownSemicolon, node2, "end");
      }
    }
    stringify(node2, semicolon) {
      if (!this[node2.type]) {
        throw new Error(
          "Unknown AST node type " + node2.type + ". Maybe you need to change PostCSS stringifier."
        );
      }
      this[node2.type](node2, semicolon);
    }
  };
  var stringifier$1 = Stringifier$2$1;
  Stringifier$2$1.default = Stringifier$2$1;
  var Stringifier$1$1 = stringifier$1;
  function stringify$4$1(node2, builder) {
    let str = new Stringifier$1$1(builder);
    str.stringify(node2);
  }
  var stringify_1$1 = stringify$4$1;
  stringify$4$1.default = stringify$4$1;
  var { isClean: isClean$2$1, my: my$2$1 } = symbols$1;
  var CssSyntaxError$2$1 = cssSyntaxError$1;
  var Stringifier2$1 = stringifier$1;
  var stringify$3$1 = stringify_1$1;
  function cloneNode$1(obj, parent) {
    let cloned = new obj.constructor();
    for (let i2 in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, i2)) {
        continue;
      }
      if (i2 === "proxyCache") continue;
      let value = obj[i2];
      let type = typeof value;
      if (i2 === "parent" && type === "object") {
        if (parent) cloned[i2] = parent;
      } else if (i2 === "source") {
        cloned[i2] = value;
      } else if (Array.isArray(value)) {
        cloned[i2] = value.map((j) => cloneNode$1(j, cloned));
      } else {
        if (type === "object" && value !== null) value = cloneNode$1(value);
        cloned[i2] = value;
      }
    }
    return cloned;
  }
  var Node$4$1 = class Node2 {
    constructor(defaults = {}) {
      this.raws = {};
      this[isClean$2$1] = false;
      this[my$2$1] = true;
      for (let name in defaults) {
        if (name === "nodes") {
          this.nodes = [];
          for (let node2 of defaults[name]) {
            if (typeof node2.clone === "function") {
              this.append(node2.clone());
            } else {
              this.append(node2);
            }
          }
        } else {
          this[name] = defaults[name];
        }
      }
    }
    addToError(error) {
      error.postcssNode = this;
      if (error.stack && this.source && /\n\s{4}at /.test(error.stack)) {
        let s2 = this.source;
        error.stack = error.stack.replace(
          /\n\s{4}at /,
          `$&${s2.input.from}:${s2.start.line}:${s2.start.column}$&`
        );
      }
      return error;
    }
    after(add) {
      this.parent.insertAfter(this, add);
      return this;
    }
    assign(overrides = {}) {
      for (let name in overrides) {
        this[name] = overrides[name];
      }
      return this;
    }
    before(add) {
      this.parent.insertBefore(this, add);
      return this;
    }
    cleanRaws(keepBetween) {
      delete this.raws.before;
      delete this.raws.after;
      if (!keepBetween) delete this.raws.between;
    }
    clone(overrides = {}) {
      let cloned = cloneNode$1(this);
      for (let name in overrides) {
        cloned[name] = overrides[name];
      }
      return cloned;
    }
    cloneAfter(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertAfter(this, cloned);
      return cloned;
    }
    cloneBefore(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertBefore(this, cloned);
      return cloned;
    }
    error(message, opts = {}) {
      if (this.source) {
        let { end, start } = this.rangeBy(opts);
        return this.source.input.error(
          message,
          { column: start.column, line: start.line },
          { column: end.column, line: end.line },
          opts
        );
      }
      return new CssSyntaxError$2$1(message);
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "prop" || prop === "value" || prop === "name" || prop === "params" || prop === "important" || /* c8 ignore next */
          prop === "text") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    markDirty() {
      if (this[isClean$2$1]) {
        this[isClean$2$1] = false;
        let next = this;
        while (next = next.parent) {
          next[isClean$2$1] = false;
        }
      }
    }
    next() {
      if (!this.parent) return void 0;
      let index2 = this.parent.index(this);
      return this.parent.nodes[index2 + 1];
    }
    positionBy(opts, stringRepresentation) {
      let pos = this.source.start;
      if (opts.index) {
        pos = this.positionInside(opts.index, stringRepresentation);
      } else if (opts.word) {
        stringRepresentation = this.toString();
        let index2 = stringRepresentation.indexOf(opts.word);
        if (index2 !== -1) pos = this.positionInside(index2, stringRepresentation);
      }
      return pos;
    }
    positionInside(index2, stringRepresentation) {
      let string = stringRepresentation || this.toString();
      let column = this.source.start.column;
      let line = this.source.start.line;
      for (let i2 = 0; i2 < index2; i2++) {
        if (string[i2] === "\n") {
          column = 1;
          line += 1;
        } else {
          column += 1;
        }
      }
      return { column, line };
    }
    prev() {
      if (!this.parent) return void 0;
      let index2 = this.parent.index(this);
      return this.parent.nodes[index2 - 1];
    }
    rangeBy(opts) {
      let start = {
        column: this.source.start.column,
        line: this.source.start.line
      };
      let end = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line
      } : {
        column: start.column + 1,
        line: start.line
      };
      if (opts.word) {
        let stringRepresentation = this.toString();
        let index2 = stringRepresentation.indexOf(opts.word);
        if (index2 !== -1) {
          start = this.positionInside(index2, stringRepresentation);
          end = this.positionInside(index2 + opts.word.length, stringRepresentation);
        }
      } else {
        if (opts.start) {
          start = {
            column: opts.start.column,
            line: opts.start.line
          };
        } else if (opts.index) {
          start = this.positionInside(opts.index);
        }
        if (opts.end) {
          end = {
            column: opts.end.column,
            line: opts.end.line
          };
        } else if (typeof opts.endIndex === "number") {
          end = this.positionInside(opts.endIndex);
        } else if (opts.index) {
          end = this.positionInside(opts.index + 1);
        }
      }
      if (end.line < start.line || end.line === start.line && end.column <= start.column) {
        end = { column: start.column + 1, line: start.line };
      }
      return { end, start };
    }
    raw(prop, defaultType) {
      let str = new Stringifier2$1();
      return str.raw(this, prop, defaultType);
    }
    remove() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
      this.parent = void 0;
      return this;
    }
    replaceWith(...nodes) {
      if (this.parent) {
        let bookmark = this;
        let foundSelf = false;
        for (let node2 of nodes) {
          if (node2 === this) {
            foundSelf = true;
          } else if (foundSelf) {
            this.parent.insertAfter(bookmark, node2);
            bookmark = node2;
          } else {
            this.parent.insertBefore(bookmark, node2);
          }
        }
        if (!foundSelf) {
          this.remove();
        }
      }
      return this;
    }
    root() {
      let result2 = this;
      while (result2.parent && result2.parent.type !== "document") {
        result2 = result2.parent;
      }
      return result2;
    }
    toJSON(_, inputs) {
      let fixed = {};
      let emitInputs = inputs == null;
      inputs = inputs || /* @__PURE__ */ new Map();
      let inputsNextIndex = 0;
      for (let name in this) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
          continue;
        }
        if (name === "parent" || name === "proxyCache") continue;
        let value = this[name];
        if (Array.isArray(value)) {
          fixed[name] = value.map((i2) => {
            if (typeof i2 === "object" && i2.toJSON) {
              return i2.toJSON(null, inputs);
            } else {
              return i2;
            }
          });
        } else if (typeof value === "object" && value.toJSON) {
          fixed[name] = value.toJSON(null, inputs);
        } else if (name === "source") {
          let inputId = inputs.get(value.input);
          if (inputId == null) {
            inputId = inputsNextIndex;
            inputs.set(value.input, inputsNextIndex);
            inputsNextIndex++;
          }
          fixed[name] = {
            end: value.end,
            inputId,
            start: value.start
          };
        } else {
          fixed[name] = value;
        }
      }
      if (emitInputs) {
        fixed.inputs = [...inputs.keys()].map((input2) => input2.toJSON());
      }
      return fixed;
    }
    toProxy() {
      if (!this.proxyCache) {
        this.proxyCache = new Proxy(this, this.getProxyProcessor());
      }
      return this.proxyCache;
    }
    toString(stringifier2 = stringify$3$1) {
      if (stringifier2.stringify) stringifier2 = stringifier2.stringify;
      let result2 = "";
      stringifier2(this, (i2) => {
        result2 += i2;
      });
      return result2;
    }
    warn(result2, text, opts) {
      let data = { node: this };
      for (let i2 in opts) data[i2] = opts[i2];
      return result2.warn(text, data);
    }
    get proxyOf() {
      return this;
    }
  };
  var node$1 = Node$4$1;
  Node$4$1.default = Node$4$1;
  var Node$3$1 = node$1;
  var Declaration$4$1 = class Declaration extends Node$3$1 {
    constructor(defaults) {
      if (defaults && typeof defaults.value !== "undefined" && typeof defaults.value !== "string") {
        defaults = { ...defaults, value: String(defaults.value) };
      }
      super(defaults);
      this.type = "decl";
    }
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
  };
  var declaration$1 = Declaration$4$1;
  Declaration$4$1.default = Declaration$4$1;
  var urlAlphabet$1 = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  var customAlphabet$1 = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
      let id = "";
      let i2 = size;
      while (i2--) {
        id += alphabet[Math.random() * alphabet.length | 0];
      }
      return id;
    };
  };
  var nanoid$1$1 = (size = 21) => {
    let id = "";
    let i2 = size;
    while (i2--) {
      id += urlAlphabet$1[Math.random() * 64 | 0];
    }
    return id;
  };
  var nonSecure$1 = { nanoid: nanoid$1$1, customAlphabet: customAlphabet$1 };
  var { SourceMapConsumer: SourceMapConsumer$2$1, SourceMapGenerator: SourceMapGenerator$2$1 } = require$$2$1;
  var { existsSync: existsSync$1, readFileSync: readFileSync$1 } = require$$2$1;
  var { dirname: dirname$1$1, join: join$1 } = require$$2$1;
  function fromBase64$1(str) {
    if (Buffer) {
      return Buffer.from(str, "base64").toString();
    } else {
      return window.atob(str);
    }
  }
  var PreviousMap$2$1 = class PreviousMap {
    constructor(css, opts) {
      if (opts.map === false) return;
      this.loadAnnotation(css);
      this.inline = this.startWith(this.annotation, "data:");
      let prev = opts.map ? opts.map.prev : void 0;
      let text = this.loadMap(opts.from, prev);
      if (!this.mapFile && opts.from) {
        this.mapFile = opts.from;
      }
      if (this.mapFile) this.root = dirname$1$1(this.mapFile);
      if (text) this.text = text;
    }
    consumer() {
      if (!this.consumerCache) {
        this.consumerCache = new SourceMapConsumer$2$1(this.text);
      }
      return this.consumerCache;
    }
    decodeInline(text) {
      let baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
      let baseUri = /^data:application\/json;base64,/;
      let charsetUri = /^data:application\/json;charset=utf-?8,/;
      let uri = /^data:application\/json,/;
      if (charsetUri.test(text) || uri.test(text)) {
        return decodeURIComponent(text.substr(RegExp.lastMatch.length));
      }
      if (baseCharsetUri.test(text) || baseUri.test(text)) {
        return fromBase64$1(text.substr(RegExp.lastMatch.length));
      }
      let encoding = text.match(/data:application\/json;([^,]+),/)[1];
      throw new Error("Unsupported source map encoding " + encoding);
    }
    getAnnotationURL(sourceMapString) {
      return sourceMapString.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(map) {
      if (typeof map !== "object") return false;
      return typeof map.mappings === "string" || typeof map._mappings === "string" || Array.isArray(map.sections);
    }
    loadAnnotation(css) {
      let comments = css.match(/\/\*\s*# sourceMappingURL=/gm);
      if (!comments) return;
      let start = css.lastIndexOf(comments.pop());
      let end = css.indexOf("*/", start);
      if (start > -1 && end > -1) {
        this.annotation = this.getAnnotationURL(css.substring(start, end));
      }
    }
    loadFile(path) {
      this.root = dirname$1$1(path);
      if (existsSync$1(path)) {
        this.mapFile = path;
        return readFileSync$1(path, "utf-8").toString().trim();
      }
    }
    loadMap(file, prev) {
      if (prev === false) return false;
      if (prev) {
        if (typeof prev === "string") {
          return prev;
        } else if (typeof prev === "function") {
          let prevPath = prev(file);
          if (prevPath) {
            let map = this.loadFile(prevPath);
            if (!map) {
              throw new Error(
                "Unable to load previous source map: " + prevPath.toString()
              );
            }
            return map;
          }
        } else if (prev instanceof SourceMapConsumer$2$1) {
          return SourceMapGenerator$2$1.fromSourceMap(prev).toString();
        } else if (prev instanceof SourceMapGenerator$2$1) {
          return prev.toString();
        } else if (this.isMap(prev)) {
          return JSON.stringify(prev);
        } else {
          throw new Error(
            "Unsupported previous source map format: " + prev.toString()
          );
        }
      } else if (this.inline) {
        return this.decodeInline(this.annotation);
      } else if (this.annotation) {
        let map = this.annotation;
        if (file) map = join$1(dirname$1$1(file), map);
        return this.loadFile(map);
      }
    }
    startWith(string, start) {
      if (!string) return false;
      return string.substr(0, start.length) === start;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  };
  var previousMap$1 = PreviousMap$2$1;
  PreviousMap$2$1.default = PreviousMap$2$1;
  var { SourceMapConsumer: SourceMapConsumer$1$1, SourceMapGenerator: SourceMapGenerator$1$1 } = require$$2$1;
  var { fileURLToPath: fileURLToPath$1, pathToFileURL: pathToFileURL$1$1 } = require$$2$1;
  var { isAbsolute: isAbsolute$1, resolve: resolve$1$1 } = require$$2$1;
  var { nanoid: nanoid$2 } = nonSecure$1;
  var terminalHighlight$2 = require$$2$1;
  var CssSyntaxError$1$1 = cssSyntaxError$1;
  var PreviousMap$1$1 = previousMap$1;
  var fromOffsetCache$1 = Symbol("fromOffsetCache");
  var sourceMapAvailable$1$1 = Boolean(SourceMapConsumer$1$1 && SourceMapGenerator$1$1);
  var pathAvailable$1$1 = Boolean(resolve$1$1 && isAbsolute$1);
  var Input$4$1 = class Input {
    constructor(css, opts = {}) {
      if (css === null || typeof css === "undefined" || typeof css === "object" && !css.toString) {
        throw new Error(`PostCSS received ${css} instead of CSS string`);
      }
      this.css = css.toString();
      if (this.css[0] === "\uFEFF" || this.css[0] === "\uFFFE") {
        this.hasBOM = true;
        this.css = this.css.slice(1);
      } else {
        this.hasBOM = false;
      }
      if (opts.from) {
        if (!pathAvailable$1$1 || /^\w+:\/\//.test(opts.from) || isAbsolute$1(opts.from)) {
          this.file = opts.from;
        } else {
          this.file = resolve$1$1(opts.from);
        }
      }
      if (pathAvailable$1$1 && sourceMapAvailable$1$1) {
        let map = new PreviousMap$1$1(this.css, opts);
        if (map.text) {
          this.map = map;
          let file = map.consumer().file;
          if (!this.file && file) this.file = this.mapResolve(file);
        }
      }
      if (!this.file) {
        this.id = "<input css " + nanoid$2(6) + ">";
      }
      if (this.map) this.map.file = this.from;
    }
    error(message, line, column, opts = {}) {
      let result2, endLine, endColumn;
      if (line && typeof line === "object") {
        let start = line;
        let end = column;
        if (typeof start.offset === "number") {
          let pos = this.fromOffset(start.offset);
          line = pos.line;
          column = pos.col;
        } else {
          line = start.line;
          column = start.column;
        }
        if (typeof end.offset === "number") {
          let pos = this.fromOffset(end.offset);
          endLine = pos.line;
          endColumn = pos.col;
        } else {
          endLine = end.line;
          endColumn = end.column;
        }
      } else if (!column) {
        let pos = this.fromOffset(line);
        line = pos.line;
        column = pos.col;
      }
      let origin = this.origin(line, column, endLine, endColumn);
      if (origin) {
        result2 = new CssSyntaxError$1$1(
          message,
          origin.endLine === void 0 ? origin.line : { column: origin.column, line: origin.line },
          origin.endLine === void 0 ? origin.column : { column: origin.endColumn, line: origin.endLine },
          origin.source,
          origin.file,
          opts.plugin
        );
      } else {
        result2 = new CssSyntaxError$1$1(
          message,
          endLine === void 0 ? line : { column, line },
          endLine === void 0 ? column : { column: endColumn, line: endLine },
          this.css,
          this.file,
          opts.plugin
        );
      }
      result2.input = { column, endColumn, endLine, line, source: this.css };
      if (this.file) {
        if (pathToFileURL$1$1) {
          result2.input.url = pathToFileURL$1$1(this.file).toString();
        }
        result2.input.file = this.file;
      }
      return result2;
    }
    fromOffset(offset) {
      let lastLine, lineToIndex;
      if (!this[fromOffsetCache$1]) {
        let lines = this.css.split("\n");
        lineToIndex = new Array(lines.length);
        let prevIndex = 0;
        for (let i2 = 0, l2 = lines.length; i2 < l2; i2++) {
          lineToIndex[i2] = prevIndex;
          prevIndex += lines[i2].length + 1;
        }
        this[fromOffsetCache$1] = lineToIndex;
      } else {
        lineToIndex = this[fromOffsetCache$1];
      }
      lastLine = lineToIndex[lineToIndex.length - 1];
      let min = 0;
      if (offset >= lastLine) {
        min = lineToIndex.length - 1;
      } else {
        let max = lineToIndex.length - 2;
        let mid;
        while (min < max) {
          mid = min + (max - min >> 1);
          if (offset < lineToIndex[mid]) {
            max = mid - 1;
          } else if (offset >= lineToIndex[mid + 1]) {
            min = mid + 1;
          } else {
            min = mid;
            break;
          }
        }
      }
      return {
        col: offset - lineToIndex[min] + 1,
        line: min + 1
      };
    }
    mapResolve(file) {
      if (/^\w+:\/\//.test(file)) {
        return file;
      }
      return resolve$1$1(this.map.consumer().sourceRoot || this.map.root || ".", file);
    }
    origin(line, column, endLine, endColumn) {
      if (!this.map) return false;
      let consumer = this.map.consumer();
      let from = consumer.originalPositionFor({ column, line });
      if (!from.source) return false;
      let to;
      if (typeof endLine === "number") {
        to = consumer.originalPositionFor({ column: endColumn, line: endLine });
      }
      let fromUrl;
      if (isAbsolute$1(from.source)) {
        fromUrl = pathToFileURL$1$1(from.source);
      } else {
        fromUrl = new URL(
          from.source,
          this.map.consumer().sourceRoot || pathToFileURL$1$1(this.map.mapFile)
        );
      }
      let result2 = {
        column: from.column,
        endColumn: to && to.column,
        endLine: to && to.line,
        line: from.line,
        url: fromUrl.toString()
      };
      if (fromUrl.protocol === "file:") {
        if (fileURLToPath$1) {
          result2.file = fileURLToPath$1(fromUrl);
        } else {
          throw new Error(`file: protocol is not available in this PostCSS build`);
        }
      }
      let source = consumer.sourceContentFor(from.source);
      if (source) result2.source = source;
      return result2;
    }
    toJSON() {
      let json = {};
      for (let name of ["hasBOM", "css", "file", "id"]) {
        if (this[name] != null) {
          json[name] = this[name];
        }
      }
      if (this.map) {
        json.map = { ...this.map };
        if (json.map.consumerCache) {
          json.map.consumerCache = void 0;
        }
      }
      return json;
    }
    get from() {
      return this.file || this.id;
    }
  };
  var input$1 = Input$4$1;
  Input$4$1.default = Input$4$1;
  if (terminalHighlight$2 && terminalHighlight$2.registerInput) {
    terminalHighlight$2.registerInput(Input$4$1);
  }
  var { SourceMapConsumer: SourceMapConsumer$3, SourceMapGenerator: SourceMapGenerator$3 } = require$$2$1;
  var { dirname: dirname$2, relative: relative$1, resolve: resolve$2, sep: sep$1 } = require$$2$1;
  var { pathToFileURL: pathToFileURL$2 } = require$$2$1;
  var Input$3$1 = input$1;
  var sourceMapAvailable$2 = Boolean(SourceMapConsumer$3 && SourceMapGenerator$3);
  var pathAvailable$2 = Boolean(dirname$2 && resolve$2 && relative$1 && sep$1);
  var MapGenerator$2$1 = class MapGenerator {
    constructor(stringify2, root2, opts, cssString) {
      this.stringify = stringify2;
      this.mapOpts = opts.map || {};
      this.root = root2;
      this.opts = opts;
      this.css = cssString;
      this.originalCSS = cssString;
      this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute;
      this.memoizedFileURLs = /* @__PURE__ */ new Map();
      this.memoizedPaths = /* @__PURE__ */ new Map();
      this.memoizedURLs = /* @__PURE__ */ new Map();
    }
    addAnnotation() {
      let content;
      if (this.isInline()) {
        content = "data:application/json;base64," + this.toBase64(this.map.toString());
      } else if (typeof this.mapOpts.annotation === "string") {
        content = this.mapOpts.annotation;
      } else if (typeof this.mapOpts.annotation === "function") {
        content = this.mapOpts.annotation(this.opts.to, this.root);
      } else {
        content = this.outputFile() + ".map";
      }
      let eol = "\n";
      if (this.css.includes("\r\n")) eol = "\r\n";
      this.css += eol + "/*# sourceMappingURL=" + content + " */";
    }
    applyPrevMaps() {
      for (let prev of this.previous()) {
        let from = this.toUrl(this.path(prev.file));
        let root2 = prev.root || dirname$2(prev.file);
        let map;
        if (this.mapOpts.sourcesContent === false) {
          map = new SourceMapConsumer$3(prev.text);
          if (map.sourcesContent) {
            map.sourcesContent = null;
          }
        } else {
          map = prev.consumer();
        }
        this.map.applySourceMap(map, from, this.toUrl(this.path(root2)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation === false) return;
      if (this.root) {
        let node2;
        for (let i2 = this.root.nodes.length - 1; i2 >= 0; i2--) {
          node2 = this.root.nodes[i2];
          if (node2.type !== "comment") continue;
          if (node2.text.indexOf("# sourceMappingURL=") === 0) {
            this.root.removeChild(i2);
          }
        }
      } else if (this.css) {
        this.css = this.css.replace(/\n*?\/\*#[\S\s]*?\*\/$/gm, "");
      }
    }
    generate() {
      this.clearAnnotation();
      if (pathAvailable$2 && sourceMapAvailable$2 && this.isMap()) {
        return this.generateMap();
      } else {
        let result2 = "";
        this.stringify(this.root, (i2) => {
          result2 += i2;
        });
        return [result2];
      }
    }
    generateMap() {
      if (this.root) {
        this.generateString();
      } else if (this.previous().length === 1) {
        let prev = this.previous()[0].consumer();
        prev.file = this.outputFile();
        this.map = SourceMapGenerator$3.fromSourceMap(prev, {
          ignoreInvalidMapping: true
        });
      } else {
        this.map = new SourceMapGenerator$3({
          file: this.outputFile(),
          ignoreInvalidMapping: true
        });
        this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      }
      if (this.isSourcesContent()) this.setSourcesContent();
      if (this.root && this.previous().length > 0) this.applyPrevMaps();
      if (this.isAnnotation()) this.addAnnotation();
      if (this.isInline()) {
        return [this.css];
      } else {
        return [this.css, this.map];
      }
    }
    generateString() {
      this.css = "";
      this.map = new SourceMapGenerator$3({
        file: this.outputFile(),
        ignoreInvalidMapping: true
      });
      let line = 1;
      let column = 1;
      let noSource = "<no source>";
      let mapping = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      };
      let lines, last;
      this.stringify(this.root, (str, node2, type) => {
        this.css += str;
        if (node2 && type !== "end") {
          mapping.generated.line = line;
          mapping.generated.column = column - 1;
          if (node2.source && node2.source.start) {
            mapping.source = this.sourcePath(node2);
            mapping.original.line = node2.source.start.line;
            mapping.original.column = node2.source.start.column - 1;
            this.map.addMapping(mapping);
          } else {
            mapping.source = noSource;
            mapping.original.line = 1;
            mapping.original.column = 0;
            this.map.addMapping(mapping);
          }
        }
        lines = str.match(/\n/g);
        if (lines) {
          line += lines.length;
          last = str.lastIndexOf("\n");
          column = str.length - last;
        } else {
          column += str.length;
        }
        if (node2 && type !== "start") {
          let p = node2.parent || { raws: {} };
          let childless = node2.type === "decl" || node2.type === "atrule" && !node2.nodes;
          if (!childless || node2 !== p.last || p.raws.semicolon) {
            if (node2.source && node2.source.end) {
              mapping.source = this.sourcePath(node2);
              mapping.original.line = node2.source.end.line;
              mapping.original.column = node2.source.end.column - 1;
              mapping.generated.line = line;
              mapping.generated.column = column - 2;
              this.map.addMapping(mapping);
            } else {
              mapping.source = noSource;
              mapping.original.line = 1;
              mapping.original.column = 0;
              mapping.generated.line = line;
              mapping.generated.column = column - 1;
              this.map.addMapping(mapping);
            }
          }
        }
      });
    }
    isAnnotation() {
      if (this.isInline()) {
        return true;
      }
      if (typeof this.mapOpts.annotation !== "undefined") {
        return this.mapOpts.annotation;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.annotation);
      }
      return true;
    }
    isInline() {
      if (typeof this.mapOpts.inline !== "undefined") {
        return this.mapOpts.inline;
      }
      let annotation = this.mapOpts.annotation;
      if (typeof annotation !== "undefined" && annotation !== true) {
        return false;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.inline);
      }
      return true;
    }
    isMap() {
      if (typeof this.opts.map !== "undefined") {
        return !!this.opts.map;
      }
      return this.previous().length > 0;
    }
    isSourcesContent() {
      if (typeof this.mapOpts.sourcesContent !== "undefined") {
        return this.mapOpts.sourcesContent;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.withContent());
      }
      return true;
    }
    outputFile() {
      if (this.opts.to) {
        return this.path(this.opts.to);
      } else if (this.opts.from) {
        return this.path(this.opts.from);
      } else {
        return "to.css";
      }
    }
    path(file) {
      if (this.mapOpts.absolute) return file;
      if (file.charCodeAt(0) === 60) return file;
      if (/^\w+:\/\//.test(file)) return file;
      let cached = this.memoizedPaths.get(file);
      if (cached) return cached;
      let from = this.opts.to ? dirname$2(this.opts.to) : ".";
      if (typeof this.mapOpts.annotation === "string") {
        from = dirname$2(resolve$2(from, this.mapOpts.annotation));
      }
      let path = relative$1(from, file);
      this.memoizedPaths.set(file, path);
      return path;
    }
    previous() {
      if (!this.previousMaps) {
        this.previousMaps = [];
        if (this.root) {
          this.root.walk((node2) => {
            if (node2.source && node2.source.input.map) {
              let map = node2.source.input.map;
              if (!this.previousMaps.includes(map)) {
                this.previousMaps.push(map);
              }
            }
          });
        } else {
          let input2 = new Input$3$1(this.originalCSS, this.opts);
          if (input2.map) this.previousMaps.push(input2.map);
        }
      }
      return this.previousMaps;
    }
    setSourcesContent() {
      let already = {};
      if (this.root) {
        this.root.walk((node2) => {
          if (node2.source) {
            let from = node2.source.input.from;
            if (from && !already[from]) {
              already[from] = true;
              let fromUrl = this.usesFileUrls ? this.toFileUrl(from) : this.toUrl(this.path(from));
              this.map.setSourceContent(fromUrl, node2.source.input.css);
            }
          }
        });
      } else if (this.css) {
        let from = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(from, this.css);
      }
    }
    sourcePath(node2) {
      if (this.mapOpts.from) {
        return this.toUrl(this.mapOpts.from);
      } else if (this.usesFileUrls) {
        return this.toFileUrl(node2.source.input.from);
      } else {
        return this.toUrl(this.path(node2.source.input.from));
      }
    }
    toBase64(str) {
      if (Buffer) {
        return Buffer.from(str).toString("base64");
      } else {
        return window.btoa(unescape(encodeURIComponent(str)));
      }
    }
    toFileUrl(path) {
      let cached = this.memoizedFileURLs.get(path);
      if (cached) return cached;
      if (pathToFileURL$2) {
        let fileURL = pathToFileURL$2(path).toString();
        this.memoizedFileURLs.set(path, fileURL);
        return fileURL;
      } else {
        throw new Error(
          "`map.absolute` option is not available in this PostCSS build"
        );
      }
    }
    toUrl(path) {
      let cached = this.memoizedURLs.get(path);
      if (cached) return cached;
      if (sep$1 === "\\") {
        path = path.replace(/\\/g, "/");
      }
      let url = encodeURI(path).replace(/[#?]/g, encodeURIComponent);
      this.memoizedURLs.set(path, url);
      return url;
    }
  };
  var mapGenerator$1 = MapGenerator$2$1;
  var Node$2$1 = node$1;
  var Comment$4$1 = class Comment extends Node$2$1 {
    constructor(defaults) {
      super(defaults);
      this.type = "comment";
    }
  };
  var comment$1 = Comment$4$1;
  Comment$4$1.default = Comment$4$1;
  var { isClean: isClean$1$1, my: my$1$1 } = symbols$1;
  var Declaration$3$1 = declaration$1;
  var Comment$3$1 = comment$1;
  var Node$1$1 = node$1;
  var parse$4$1;
  var Rule$4$1;
  var AtRule$4$1;
  var Root$6$1;
  function cleanSource$1(nodes) {
    return nodes.map((i2) => {
      if (i2.nodes) i2.nodes = cleanSource$1(i2.nodes);
      delete i2.source;
      return i2;
    });
  }
  function markDirtyUp$1(node2) {
    node2[isClean$1$1] = false;
    if (node2.proxyOf.nodes) {
      for (let i2 of node2.proxyOf.nodes) {
        markDirtyUp$1(i2);
      }
    }
  }
  var Container$7$1 = class Container extends Node$1$1 {
    append(...children) {
      for (let child of children) {
        let nodes = this.normalize(child, this.last);
        for (let node2 of nodes) this.proxyOf.nodes.push(node2);
      }
      this.markDirty();
      return this;
    }
    cleanRaws(keepBetween) {
      super.cleanRaws(keepBetween);
      if (this.nodes) {
        for (let node2 of this.nodes) node2.cleanRaws(keepBetween);
      }
    }
    each(callback) {
      if (!this.proxyOf.nodes) return void 0;
      let iterator = this.getIterator();
      let index2, result2;
      while (this.indexes[iterator] < this.proxyOf.nodes.length) {
        index2 = this.indexes[iterator];
        result2 = callback(this.proxyOf.nodes[index2], index2);
        if (result2 === false) break;
        this.indexes[iterator] += 1;
      }
      delete this.indexes[iterator];
      return result2;
    }
    every(condition) {
      return this.nodes.every(condition);
    }
    getIterator() {
      if (!this.lastEach) this.lastEach = 0;
      if (!this.indexes) this.indexes = {};
      this.lastEach += 1;
      let iterator = this.lastEach;
      this.indexes[iterator] = 0;
      return iterator;
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (!node2[prop]) {
            return node2[prop];
          } else if (prop === "each" || typeof prop === "string" && prop.startsWith("walk")) {
            return (...args) => {
              return node2[prop](
                ...args.map((i2) => {
                  if (typeof i2 === "function") {
                    return (child, index2) => i2(child.toProxy(), index2);
                  } else {
                    return i2;
                  }
                })
              );
            };
          } else if (prop === "every" || prop === "some") {
            return (cb) => {
              return node2[prop](
                (child, ...other) => cb(child.toProxy(), ...other)
              );
            };
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else if (prop === "nodes") {
            return node2.nodes.map((i2) => i2.toProxy());
          } else if (prop === "first" || prop === "last") {
            return node2[prop].toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "name" || prop === "params" || prop === "selector") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    index(child) {
      if (typeof child === "number") return child;
      if (child.proxyOf) child = child.proxyOf;
      return this.proxyOf.nodes.indexOf(child);
    }
    insertAfter(exist, add) {
      let existIndex = this.index(exist);
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex]).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex + 1, 0, node2);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (existIndex < index2) {
          this.indexes[id] = index2 + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    insertBefore(exist, add) {
      let existIndex = this.index(exist);
      let type = existIndex === 0 ? "prepend" : false;
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex], type).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex, 0, node2);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (existIndex <= index2) {
          this.indexes[id] = index2 + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    normalize(nodes, sample) {
      if (typeof nodes === "string") {
        nodes = cleanSource$1(parse$4$1(nodes).nodes);
      } else if (typeof nodes === "undefined") {
        nodes = [];
      } else if (Array.isArray(nodes)) {
        nodes = nodes.slice(0);
        for (let i2 of nodes) {
          if (i2.parent) i2.parent.removeChild(i2, "ignore");
        }
      } else if (nodes.type === "root" && this.type !== "document") {
        nodes = nodes.nodes.slice(0);
        for (let i2 of nodes) {
          if (i2.parent) i2.parent.removeChild(i2, "ignore");
        }
      } else if (nodes.type) {
        nodes = [nodes];
      } else if (nodes.prop) {
        if (typeof nodes.value === "undefined") {
          throw new Error("Value field is missed in node creation");
        } else if (typeof nodes.value !== "string") {
          nodes.value = String(nodes.value);
        }
        nodes = [new Declaration$3$1(nodes)];
      } else if (nodes.selector) {
        nodes = [new Rule$4$1(nodes)];
      } else if (nodes.name) {
        nodes = [new AtRule$4$1(nodes)];
      } else if (nodes.text) {
        nodes = [new Comment$3$1(nodes)];
      } else {
        throw new Error("Unknown node type in node creation");
      }
      let processed = nodes.map((i2) => {
        if (!i2[my$1$1]) Container.rebuild(i2);
        i2 = i2.proxyOf;
        if (i2.parent) i2.parent.removeChild(i2);
        if (i2[isClean$1$1]) markDirtyUp$1(i2);
        if (typeof i2.raws.before === "undefined") {
          if (sample && typeof sample.raws.before !== "undefined") {
            i2.raws.before = sample.raws.before.replace(/\S/g, "");
          }
        }
        i2.parent = this.proxyOf;
        return i2;
      });
      return processed;
    }
    prepend(...children) {
      children = children.reverse();
      for (let child of children) {
        let nodes = this.normalize(child, this.first, "prepend").reverse();
        for (let node2 of nodes) this.proxyOf.nodes.unshift(node2);
        for (let id in this.indexes) {
          this.indexes[id] = this.indexes[id] + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    push(child) {
      child.parent = this;
      this.proxyOf.nodes.push(child);
      return this;
    }
    removeAll() {
      for (let node2 of this.proxyOf.nodes) node2.parent = void 0;
      this.proxyOf.nodes = [];
      this.markDirty();
      return this;
    }
    removeChild(child) {
      child = this.index(child);
      this.proxyOf.nodes[child].parent = void 0;
      this.proxyOf.nodes.splice(child, 1);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (index2 >= child) {
          this.indexes[id] = index2 - 1;
        }
      }
      this.markDirty();
      return this;
    }
    replaceValues(pattern, opts, callback) {
      if (!callback) {
        callback = opts;
        opts = {};
      }
      this.walkDecls((decl) => {
        if (opts.props && !opts.props.includes(decl.prop)) return;
        if (opts.fast && !decl.value.includes(opts.fast)) return;
        decl.value = decl.value.replace(pattern, callback);
      });
      this.markDirty();
      return this;
    }
    some(condition) {
      return this.nodes.some(condition);
    }
    walk(callback) {
      return this.each((child, i2) => {
        let result2;
        try {
          result2 = callback(child, i2);
        } catch (e2) {
          throw child.addToError(e2);
        }
        if (result2 !== false && child.walk) {
          result2 = child.walk(callback);
        }
        return result2;
      });
    }
    walkAtRules(name, callback) {
      if (!callback) {
        callback = name;
        return this.walk((child, i2) => {
          if (child.type === "atrule") {
            return callback(child, i2);
          }
        });
      }
      if (name instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "atrule" && name.test(child.name)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "atrule" && child.name === name) {
          return callback(child, i2);
        }
      });
    }
    walkComments(callback) {
      return this.walk((child, i2) => {
        if (child.type === "comment") {
          return callback(child, i2);
        }
      });
    }
    walkDecls(prop, callback) {
      if (!callback) {
        callback = prop;
        return this.walk((child, i2) => {
          if (child.type === "decl") {
            return callback(child, i2);
          }
        });
      }
      if (prop instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "decl" && prop.test(child.prop)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "decl" && child.prop === prop) {
          return callback(child, i2);
        }
      });
    }
    walkRules(selector, callback) {
      if (!callback) {
        callback = selector;
        return this.walk((child, i2) => {
          if (child.type === "rule") {
            return callback(child, i2);
          }
        });
      }
      if (selector instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "rule" && selector.test(child.selector)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "rule" && child.selector === selector) {
          return callback(child, i2);
        }
      });
    }
    get first() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[0];
    }
    get last() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
  };
  Container$7$1.registerParse = (dependant) => {
    parse$4$1 = dependant;
  };
  Container$7$1.registerRule = (dependant) => {
    Rule$4$1 = dependant;
  };
  Container$7$1.registerAtRule = (dependant) => {
    AtRule$4$1 = dependant;
  };
  Container$7$1.registerRoot = (dependant) => {
    Root$6$1 = dependant;
  };
  var container$1 = Container$7$1;
  Container$7$1.default = Container$7$1;
  Container$7$1.rebuild = (node2) => {
    if (node2.type === "atrule") {
      Object.setPrototypeOf(node2, AtRule$4$1.prototype);
    } else if (node2.type === "rule") {
      Object.setPrototypeOf(node2, Rule$4$1.prototype);
    } else if (node2.type === "decl") {
      Object.setPrototypeOf(node2, Declaration$3$1.prototype);
    } else if (node2.type === "comment") {
      Object.setPrototypeOf(node2, Comment$3$1.prototype);
    } else if (node2.type === "root") {
      Object.setPrototypeOf(node2, Root$6$1.prototype);
    }
    node2[my$1$1] = true;
    if (node2.nodes) {
      node2.nodes.forEach((child) => {
        Container$7$1.rebuild(child);
      });
    }
  };
  var Container$6$1 = container$1;
  var LazyResult$4$1;
  var Processor$3$1;
  var Document$3$1 = class Document2 extends Container$6$1 {
    constructor(defaults) {
      super({ type: "document", ...defaults });
      if (!this.nodes) {
        this.nodes = [];
      }
    }
    toResult(opts = {}) {
      let lazy = new LazyResult$4$1(new Processor$3$1(), this, opts);
      return lazy.stringify();
    }
  };
  Document$3$1.registerLazyResult = (dependant) => {
    LazyResult$4$1 = dependant;
  };
  Document$3$1.registerProcessor = (dependant) => {
    Processor$3$1 = dependant;
  };
  var document$1$1 = Document$3$1;
  Document$3$1.default = Document$3$1;
  var Warning$2$1 = class Warning {
    constructor(text, opts = {}) {
      this.type = "warning";
      this.text = text;
      if (opts.node && opts.node.source) {
        let range = opts.node.rangeBy(opts);
        this.line = range.start.line;
        this.column = range.start.column;
        this.endLine = range.end.line;
        this.endColumn = range.end.column;
      }
      for (let opt in opts) this[opt] = opts[opt];
    }
    toString() {
      if (this.node) {
        return this.node.error(this.text, {
          index: this.index,
          plugin: this.plugin,
          word: this.word
        }).message;
      }
      if (this.plugin) {
        return this.plugin + ": " + this.text;
      }
      return this.text;
    }
  };
  var warning$1 = Warning$2$1;
  Warning$2$1.default = Warning$2$1;
  var Warning$1$1 = warning$1;
  var Result$3$1 = class Result {
    constructor(processor2, root2, opts) {
      this.processor = processor2;
      this.messages = [];
      this.root = root2;
      this.opts = opts;
      this.css = void 0;
      this.map = void 0;
    }
    toString() {
      return this.css;
    }
    warn(text, opts = {}) {
      if (!opts.plugin) {
        if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
          opts.plugin = this.lastPlugin.postcssPlugin;
        }
      }
      let warning2 = new Warning$1$1(text, opts);
      this.messages.push(warning2);
      return warning2;
    }
    warnings() {
      return this.messages.filter((i2) => i2.type === "warning");
    }
    get content() {
      return this.css;
    }
  };
  var result$1 = Result$3$1;
  Result$3$1.default = Result$3$1;
  var SINGLE_QUOTE$1 = "'".charCodeAt(0);
  var DOUBLE_QUOTE$1 = '"'.charCodeAt(0);
  var BACKSLASH$1 = "\\".charCodeAt(0);
  var SLASH$1 = "/".charCodeAt(0);
  var NEWLINE$1 = "\n".charCodeAt(0);
  var SPACE$1 = " ".charCodeAt(0);
  var FEED$1 = "\f".charCodeAt(0);
  var TAB$1 = "	".charCodeAt(0);
  var CR$1 = "\r".charCodeAt(0);
  var OPEN_SQUARE$1 = "[".charCodeAt(0);
  var CLOSE_SQUARE$1 = "]".charCodeAt(0);
  var OPEN_PARENTHESES$1 = "(".charCodeAt(0);
  var CLOSE_PARENTHESES$1 = ")".charCodeAt(0);
  var OPEN_CURLY$1 = "{".charCodeAt(0);
  var CLOSE_CURLY$1 = "}".charCodeAt(0);
  var SEMICOLON$1 = ";".charCodeAt(0);
  var ASTERISK$1 = "*".charCodeAt(0);
  var COLON$1 = ":".charCodeAt(0);
  var AT$1 = "@".charCodeAt(0);
  var RE_AT_END$1 = /[\t\n\f\r "#'()/;[\\\]{}]/g;
  var RE_WORD_END$1 = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g;
  var RE_BAD_BRACKET$1 = /.[\r\n"'(/\\]/;
  var RE_HEX_ESCAPE$1 = /[\da-f]/i;
  var tokenize$1 = function tokenizer(input2, options = {}) {
    let css = input2.css.valueOf();
    let ignore = options.ignoreErrors;
    let code, next, quote, content, escape;
    let escaped, escapePos, prev, n2, currentToken;
    let length = css.length;
    let pos = 0;
    let buffer = [];
    let returned = [];
    function position() {
      return pos;
    }
    function unclosed(what) {
      throw input2.error("Unclosed " + what, pos);
    }
    function endOfFile() {
      return returned.length === 0 && pos >= length;
    }
    function nextToken(opts) {
      if (returned.length) return returned.pop();
      if (pos >= length) return;
      let ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
      code = css.charCodeAt(pos);
      switch (code) {
        case NEWLINE$1:
        case SPACE$1:
        case TAB$1:
        case CR$1:
        case FEED$1: {
          next = pos;
          do {
            next += 1;
            code = css.charCodeAt(next);
          } while (code === SPACE$1 || code === NEWLINE$1 || code === TAB$1 || code === CR$1 || code === FEED$1);
          currentToken = ["space", css.slice(pos, next)];
          pos = next - 1;
          break;
        }
        case OPEN_SQUARE$1:
        case CLOSE_SQUARE$1:
        case OPEN_CURLY$1:
        case CLOSE_CURLY$1:
        case COLON$1:
        case SEMICOLON$1:
        case CLOSE_PARENTHESES$1: {
          let controlChar = String.fromCharCode(code);
          currentToken = [controlChar, controlChar, pos];
          break;
        }
        case OPEN_PARENTHESES$1: {
          prev = buffer.length ? buffer.pop()[1] : "";
          n2 = css.charCodeAt(pos + 1);
          if (prev === "url" && n2 !== SINGLE_QUOTE$1 && n2 !== DOUBLE_QUOTE$1 && n2 !== SPACE$1 && n2 !== NEWLINE$1 && n2 !== TAB$1 && n2 !== FEED$1 && n2 !== CR$1) {
            next = pos;
            do {
              escaped = false;
              next = css.indexOf(")", next + 1);
              if (next === -1) {
                if (ignore || ignoreUnclosed) {
                  next = pos;
                  break;
                } else {
                  unclosed("bracket");
                }
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === BACKSLASH$1) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped);
            currentToken = ["brackets", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            next = css.indexOf(")", pos + 1);
            content = css.slice(pos, next + 1);
            if (next === -1 || RE_BAD_BRACKET$1.test(content)) {
              currentToken = ["(", "(", pos];
            } else {
              currentToken = ["brackets", content, pos, next];
              pos = next;
            }
          }
          break;
        }
        case SINGLE_QUOTE$1:
        case DOUBLE_QUOTE$1: {
          quote = code === SINGLE_QUOTE$1 ? "'" : '"';
          next = pos;
          do {
            escaped = false;
            next = css.indexOf(quote, next + 1);
            if (next === -1) {
              if (ignore || ignoreUnclosed) {
                next = pos + 1;
                break;
              } else {
                unclosed("string");
              }
            }
            escapePos = next;
            while (css.charCodeAt(escapePos - 1) === BACKSLASH$1) {
              escapePos -= 1;
              escaped = !escaped;
            }
          } while (escaped);
          currentToken = ["string", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case AT$1: {
          RE_AT_END$1.lastIndex = pos + 1;
          RE_AT_END$1.test(css);
          if (RE_AT_END$1.lastIndex === 0) {
            next = css.length - 1;
          } else {
            next = RE_AT_END$1.lastIndex - 2;
          }
          currentToken = ["at-word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case BACKSLASH$1: {
          next = pos;
          escape = true;
          while (css.charCodeAt(next + 1) === BACKSLASH$1) {
            next += 1;
            escape = !escape;
          }
          code = css.charCodeAt(next + 1);
          if (escape && code !== SLASH$1 && code !== SPACE$1 && code !== NEWLINE$1 && code !== TAB$1 && code !== CR$1 && code !== FEED$1) {
            next += 1;
            if (RE_HEX_ESCAPE$1.test(css.charAt(next))) {
              while (RE_HEX_ESCAPE$1.test(css.charAt(next + 1))) {
                next += 1;
              }
              if (css.charCodeAt(next + 1) === SPACE$1) {
                next += 1;
              }
            }
          }
          currentToken = ["word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        default: {
          if (code === SLASH$1 && css.charCodeAt(pos + 1) === ASTERISK$1) {
            next = css.indexOf("*/", pos + 2) + 1;
            if (next === 0) {
              if (ignore || ignoreUnclosed) {
                next = css.length;
              } else {
                unclosed("comment");
              }
            }
            currentToken = ["comment", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            RE_WORD_END$1.lastIndex = pos + 1;
            RE_WORD_END$1.test(css);
            if (RE_WORD_END$1.lastIndex === 0) {
              next = css.length - 1;
            } else {
              next = RE_WORD_END$1.lastIndex - 2;
            }
            currentToken = ["word", css.slice(pos, next + 1), pos, next];
            buffer.push(currentToken);
            pos = next;
          }
          break;
        }
      }
      pos++;
      return currentToken;
    }
    function back(token) {
      returned.push(token);
    }
    return {
      back,
      endOfFile,
      nextToken,
      position
    };
  };
  var Container$5$1 = container$1;
  var AtRule$3$1 = class AtRule extends Container$5$1 {
    constructor(defaults) {
      super(defaults);
      this.type = "atrule";
    }
    append(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.append(...children);
    }
    prepend(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.prepend(...children);
    }
  };
  var atRule$1 = AtRule$3$1;
  AtRule$3$1.default = AtRule$3$1;
  Container$5$1.registerAtRule(AtRule$3$1);
  var Container$4$1 = container$1;
  var LazyResult$3$1;
  var Processor$2$1;
  var Root$5$1 = class Root extends Container$4$1 {
    constructor(defaults) {
      super(defaults);
      this.type = "root";
      if (!this.nodes) this.nodes = [];
    }
    normalize(child, sample, type) {
      let nodes = super.normalize(child);
      if (sample) {
        if (type === "prepend") {
          if (this.nodes.length > 1) {
            sample.raws.before = this.nodes[1].raws.before;
          } else {
            delete sample.raws.before;
          }
        } else if (this.first !== sample) {
          for (let node2 of nodes) {
            node2.raws.before = sample.raws.before;
          }
        }
      }
      return nodes;
    }
    removeChild(child, ignore) {
      let index2 = this.index(child);
      if (!ignore && index2 === 0 && this.nodes.length > 1) {
        this.nodes[1].raws.before = this.nodes[index2].raws.before;
      }
      return super.removeChild(child);
    }
    toResult(opts = {}) {
      let lazy = new LazyResult$3$1(new Processor$2$1(), this, opts);
      return lazy.stringify();
    }
  };
  Root$5$1.registerLazyResult = (dependant) => {
    LazyResult$3$1 = dependant;
  };
  Root$5$1.registerProcessor = (dependant) => {
    Processor$2$1 = dependant;
  };
  var root$1 = Root$5$1;
  Root$5$1.default = Root$5$1;
  Container$4$1.registerRoot(Root$5$1);
  var list$2$1 = {
    comma(string) {
      return list$2$1.split(string, [","], true);
    },
    space(string) {
      let spaces = [" ", "\n", "	"];
      return list$2$1.split(string, spaces);
    },
    split(string, separators, last) {
      let array = [];
      let current = "";
      let split = false;
      let func = 0;
      let inQuote = false;
      let prevQuote = "";
      let escape = false;
      for (let letter of string) {
        if (escape) {
          escape = false;
        } else if (letter === "\\") {
          escape = true;
        } else if (inQuote) {
          if (letter === prevQuote) {
            inQuote = false;
          }
        } else if (letter === '"' || letter === "'") {
          inQuote = true;
          prevQuote = letter;
        } else if (letter === "(") {
          func += 1;
        } else if (letter === ")") {
          if (func > 0) func -= 1;
        } else if (func === 0) {
          if (separators.includes(letter)) split = true;
        }
        if (split) {
          if (current !== "") array.push(current.trim());
          current = "";
          split = false;
        } else {
          current += letter;
        }
      }
      if (last || current !== "") array.push(current.trim());
      return array;
    }
  };
  var list_1$1 = list$2$1;
  list$2$1.default = list$2$1;
  var Container$3$1 = container$1;
  var list$1$1 = list_1$1;
  var Rule$3$1 = class Rule extends Container$3$1 {
    constructor(defaults) {
      super(defaults);
      this.type = "rule";
      if (!this.nodes) this.nodes = [];
    }
    get selectors() {
      return list$1$1.comma(this.selector);
    }
    set selectors(values) {
      let match = this.selector ? this.selector.match(/,\s*/) : null;
      let sep2 = match ? match[0] : "," + this.raw("between", "beforeOpen");
      this.selector = values.join(sep2);
    }
  };
  var rule$1 = Rule$3$1;
  Rule$3$1.default = Rule$3$1;
  Container$3$1.registerRule(Rule$3$1);
  var Declaration$2$1 = declaration$1;
  var tokenizer2$1 = tokenize$1;
  var Comment$2$1 = comment$1;
  var AtRule$2$1 = atRule$1;
  var Root$4$1 = root$1;
  var Rule$2$1 = rule$1;
  var SAFE_COMMENT_NEIGHBOR$1 = {
    empty: true,
    space: true
  };
  function findLastWithPosition$1(tokens) {
    for (let i2 = tokens.length - 1; i2 >= 0; i2--) {
      let token = tokens[i2];
      let pos = token[3] || token[2];
      if (pos) return pos;
    }
  }
  var Parser$1$1 = class Parser {
    constructor(input2) {
      this.input = input2;
      this.root = new Root$4$1();
      this.current = this.root;
      this.spaces = "";
      this.semicolon = false;
      this.createTokenizer();
      this.root.source = { input: input2, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(token) {
      let node2 = new AtRule$2$1();
      node2.name = token[1].slice(1);
      if (node2.name === "") {
        this.unnamedAtrule(node2, token);
      }
      this.init(node2, token[2]);
      let type;
      let prev;
      let shift;
      let last = false;
      let open = false;
      let params = [];
      let brackets = [];
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        type = token[0];
        if (type === "(" || type === "[") {
          brackets.push(type === "(" ? ")" : "]");
        } else if (type === "{" && brackets.length > 0) {
          brackets.push("}");
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
        }
        if (brackets.length === 0) {
          if (type === ";") {
            node2.source.end = this.getPosition(token[2]);
            node2.source.end.offset++;
            this.semicolon = true;
            break;
          } else if (type === "{") {
            open = true;
            break;
          } else if (type === "}") {
            if (params.length > 0) {
              shift = params.length - 1;
              prev = params[shift];
              while (prev && prev[0] === "space") {
                prev = params[--shift];
              }
              if (prev) {
                node2.source.end = this.getPosition(prev[3] || prev[2]);
                node2.source.end.offset++;
              }
            }
            this.end(token);
            break;
          } else {
            params.push(token);
          }
        } else {
          params.push(token);
        }
        if (this.tokenizer.endOfFile()) {
          last = true;
          break;
        }
      }
      node2.raws.between = this.spacesAndCommentsFromEnd(params);
      if (params.length) {
        node2.raws.afterName = this.spacesAndCommentsFromStart(params);
        this.raw(node2, "params", params);
        if (last) {
          token = params[params.length - 1];
          node2.source.end = this.getPosition(token[3] || token[2]);
          node2.source.end.offset++;
          this.spaces = node2.raws.between;
          node2.raws.between = "";
        }
      } else {
        node2.raws.afterName = "";
        node2.params = "";
      }
      if (open) {
        node2.nodes = [];
        this.current = node2;
      }
    }
    checkMissedSemicolon(tokens) {
      let colon = this.colon(tokens);
      if (colon === false) return;
      let founded = 0;
      let token;
      for (let j = colon - 1; j >= 0; j--) {
        token = tokens[j];
        if (token[0] !== "space") {
          founded += 1;
          if (founded === 2) break;
        }
      }
      throw this.input.error(
        "Missed semicolon",
        token[0] === "word" ? token[3] + 1 : token[2]
      );
    }
    colon(tokens) {
      let brackets = 0;
      let token, type, prev;
      for (let [i2, element] of tokens.entries()) {
        token = element;
        type = token[0];
        if (type === "(") {
          brackets += 1;
        }
        if (type === ")") {
          brackets -= 1;
        }
        if (brackets === 0 && type === ":") {
          if (!prev) {
            this.doubleColon(token);
          } else if (prev[0] === "word" && prev[1] === "progid") {
            continue;
          } else {
            return i2;
          }
        }
        prev = token;
      }
      return false;
    }
    comment(token) {
      let node2 = new Comment$2$1();
      this.init(node2, token[2]);
      node2.source.end = this.getPosition(token[3] || token[2]);
      node2.source.end.offset++;
      let text = token[1].slice(2, -2);
      if (/^\s*$/.test(text)) {
        node2.text = "";
        node2.raws.left = text;
        node2.raws.right = "";
      } else {
        let match = text.match(/^(\s*)([^]*\S)(\s*)$/);
        node2.text = match[2];
        node2.raws.left = match[1];
        node2.raws.right = match[3];
      }
    }
    createTokenizer() {
      this.tokenizer = tokenizer2$1(this.input);
    }
    decl(tokens, customProperty) {
      let node2 = new Declaration$2$1();
      this.init(node2, tokens[0][2]);
      let last = tokens[tokens.length - 1];
      if (last[0] === ";") {
        this.semicolon = true;
        tokens.pop();
      }
      node2.source.end = this.getPosition(
        last[3] || last[2] || findLastWithPosition$1(tokens)
      );
      node2.source.end.offset++;
      while (tokens[0][0] !== "word") {
        if (tokens.length === 1) this.unknownWord(tokens);
        node2.raws.before += tokens.shift()[1];
      }
      node2.source.start = this.getPosition(tokens[0][2]);
      node2.prop = "";
      while (tokens.length) {
        let type = tokens[0][0];
        if (type === ":" || type === "space" || type === "comment") {
          break;
        }
        node2.prop += tokens.shift()[1];
      }
      node2.raws.between = "";
      let token;
      while (tokens.length) {
        token = tokens.shift();
        if (token[0] === ":") {
          node2.raws.between += token[1];
          break;
        } else {
          if (token[0] === "word" && /\w/.test(token[1])) {
            this.unknownWord([token]);
          }
          node2.raws.between += token[1];
        }
      }
      if (node2.prop[0] === "_" || node2.prop[0] === "*") {
        node2.raws.before += node2.prop[0];
        node2.prop = node2.prop.slice(1);
      }
      let firstSpaces = [];
      let next;
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        firstSpaces.push(tokens.shift());
      }
      this.precheckMissedSemicolon(tokens);
      for (let i2 = tokens.length - 1; i2 >= 0; i2--) {
        token = tokens[i2];
        if (token[1].toLowerCase() === "!important") {
          node2.important = true;
          let string = this.stringFrom(tokens, i2);
          string = this.spacesFromEnd(tokens) + string;
          if (string !== " !important") node2.raws.important = string;
          break;
        } else if (token[1].toLowerCase() === "important") {
          let cache = tokens.slice(0);
          let str = "";
          for (let j = i2; j > 0; j--) {
            let type = cache[j][0];
            if (str.trim().indexOf("!") === 0 && type !== "space") {
              break;
            }
            str = cache.pop()[1] + str;
          }
          if (str.trim().indexOf("!") === 0) {
            node2.important = true;
            node2.raws.important = str;
            tokens = cache;
          }
        }
        if (token[0] !== "space" && token[0] !== "comment") {
          break;
        }
      }
      let hasWord = tokens.some((i2) => i2[0] !== "space" && i2[0] !== "comment");
      if (hasWord) {
        node2.raws.between += firstSpaces.map((i2) => i2[1]).join("");
        firstSpaces = [];
      }
      this.raw(node2, "value", firstSpaces.concat(tokens), customProperty);
      if (node2.value.includes(":") && !customProperty) {
        this.checkMissedSemicolon(tokens);
      }
    }
    doubleColon(token) {
      throw this.input.error(
        "Double colon",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
    emptyRule(token) {
      let node2 = new Rule$2$1();
      this.init(node2, token[2]);
      node2.selector = "";
      node2.raws.between = "";
      this.current = node2;
    }
    end(token) {
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.semicolon = false;
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.spaces = "";
      if (this.current.parent) {
        this.current.source.end = this.getPosition(token[2]);
        this.current.source.end.offset++;
        this.current = this.current.parent;
      } else {
        this.unexpectedClose(token);
      }
    }
    endFile() {
      if (this.current.parent) this.unclosedBlock();
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(token) {
      this.spaces += token[1];
      if (this.current.nodes) {
        let prev = this.current.nodes[this.current.nodes.length - 1];
        if (prev && prev.type === "rule" && !prev.raws.ownSemicolon) {
          prev.raws.ownSemicolon = this.spaces;
          this.spaces = "";
        }
      }
    }
    // Helpers
    getPosition(offset) {
      let pos = this.input.fromOffset(offset);
      return {
        column: pos.col,
        line: pos.line,
        offset
      };
    }
    init(node2, offset) {
      this.current.push(node2);
      node2.source = {
        input: this.input,
        start: this.getPosition(offset)
      };
      node2.raws.before = this.spaces;
      this.spaces = "";
      if (node2.type !== "comment") this.semicolon = false;
    }
    other(start) {
      let end = false;
      let type = null;
      let colon = false;
      let bracket = null;
      let brackets = [];
      let customProperty = start[1].startsWith("--");
      let tokens = [];
      let token = start;
      while (token) {
        type = token[0];
        tokens.push(token);
        if (type === "(" || type === "[") {
          if (!bracket) bracket = token;
          brackets.push(type === "(" ? ")" : "]");
        } else if (customProperty && colon && type === "{") {
          if (!bracket) bracket = token;
          brackets.push("}");
        } else if (brackets.length === 0) {
          if (type === ";") {
            if (colon) {
              this.decl(tokens, customProperty);
              return;
            } else {
              break;
            }
          } else if (type === "{") {
            this.rule(tokens);
            return;
          } else if (type === "}") {
            this.tokenizer.back(tokens.pop());
            end = true;
            break;
          } else if (type === ":") {
            colon = true;
          }
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
          if (brackets.length === 0) bracket = null;
        }
        token = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile()) end = true;
      if (brackets.length > 0) this.unclosedBracket(bracket);
      if (end && colon) {
        if (!customProperty) {
          while (tokens.length) {
            token = tokens[tokens.length - 1][0];
            if (token !== "space" && token !== "comment") break;
            this.tokenizer.back(tokens.pop());
          }
        }
        this.decl(tokens, customProperty);
      } else {
        this.unknownWord(tokens);
      }
    }
    parse() {
      let token;
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        switch (token[0]) {
          case "space":
            this.spaces += token[1];
            break;
          case ";":
            this.freeSemicolon(token);
            break;
          case "}":
            this.end(token);
            break;
          case "comment":
            this.comment(token);
            break;
          case "at-word":
            this.atrule(token);
            break;
          case "{":
            this.emptyRule(token);
            break;
          default:
            this.other(token);
            break;
        }
      }
      this.endFile();
    }
    precheckMissedSemicolon() {
    }
    raw(node2, prop, tokens, customProperty) {
      let token, type;
      let length = tokens.length;
      let value = "";
      let clean = true;
      let next, prev;
      for (let i2 = 0; i2 < length; i2 += 1) {
        token = tokens[i2];
        type = token[0];
        if (type === "space" && i2 === length - 1 && !customProperty) {
          clean = false;
        } else if (type === "comment") {
          prev = tokens[i2 - 1] ? tokens[i2 - 1][0] : "empty";
          next = tokens[i2 + 1] ? tokens[i2 + 1][0] : "empty";
          if (!SAFE_COMMENT_NEIGHBOR$1[prev] && !SAFE_COMMENT_NEIGHBOR$1[next]) {
            if (value.slice(-1) === ",") {
              clean = false;
            } else {
              value += token[1];
            }
          } else {
            clean = false;
          }
        } else {
          value += token[1];
        }
      }
      if (!clean) {
        let raw = tokens.reduce((all, i2) => all + i2[1], "");
        node2.raws[prop] = { raw, value };
      }
      node2[prop] = value;
    }
    rule(tokens) {
      tokens.pop();
      let node2 = new Rule$2$1();
      this.init(node2, tokens[0][2]);
      node2.raws.between = this.spacesAndCommentsFromEnd(tokens);
      this.raw(node2, "selector", tokens);
      this.current = node2;
    }
    spacesAndCommentsFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space" && lastTokenType !== "comment") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    // Errors
    spacesAndCommentsFromStart(tokens) {
      let next;
      let spaces = "";
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        spaces += tokens.shift()[1];
      }
      return spaces;
    }
    spacesFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    stringFrom(tokens, from) {
      let result2 = "";
      for (let i2 = from; i2 < tokens.length; i2++) {
        result2 += tokens[i2][1];
      }
      tokens.splice(from, tokens.length - from);
      return result2;
    }
    unclosedBlock() {
      let pos = this.current.source.start;
      throw this.input.error("Unclosed block", pos.line, pos.column);
    }
    unclosedBracket(bracket) {
      throw this.input.error(
        "Unclosed bracket",
        { offset: bracket[2] },
        { offset: bracket[2] + 1 }
      );
    }
    unexpectedClose(token) {
      throw this.input.error(
        "Unexpected }",
        { offset: token[2] },
        { offset: token[2] + 1 }
      );
    }
    unknownWord(tokens) {
      throw this.input.error(
        "Unknown word",
        { offset: tokens[0][2] },
        { offset: tokens[0][2] + tokens[0][1].length }
      );
    }
    unnamedAtrule(node2, token) {
      throw this.input.error(
        "At-rule without name",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
  };
  var parser$1 = Parser$1$1;
  var Container$2$1 = container$1;
  var Parser2$1 = parser$1;
  var Input$2$1 = input$1;
  function parse$3$1(css, opts) {
    let input2 = new Input$2$1(css, opts);
    let parser2 = new Parser2$1(input2);
    try {
      parser2.parse();
    } catch (e2) {
      if (false) {
        if (e2.name === "CssSyntaxError" && opts && opts.from) {
          if (/\.scss$/i.test(opts.from)) {
            e2.message += "\nYou tried to parse SCSS with the standard CSS parser; try again with the postcss-scss parser";
          } else if (/\.sass/i.test(opts.from)) {
            e2.message += "\nYou tried to parse Sass with the standard CSS parser; try again with the postcss-sass parser";
          } else if (/\.less$/i.test(opts.from)) {
            e2.message += "\nYou tried to parse Less with the standard CSS parser; try again with the postcss-less parser";
          }
        }
      }
      throw e2;
    }
    return parser2.root;
  }
  var parse_1$1 = parse$3$1;
  parse$3$1.default = parse$3$1;
  Container$2$1.registerParse(parse$3$1);
  var { isClean: isClean$3, my: my$3 } = symbols$1;
  var MapGenerator$1$1 = mapGenerator$1;
  var stringify$2$1 = stringify_1$1;
  var Container$1$1 = container$1;
  var Document$2$1 = document$1$1;
  var Result$2$1 = result$1;
  var parse$2$1 = parse_1$1;
  var Root$3$1 = root$1;
  var TYPE_TO_CLASS_NAME$1 = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  };
  var PLUGIN_PROPS$1 = {
    AtRule: true,
    AtRuleExit: true,
    Comment: true,
    CommentExit: true,
    Declaration: true,
    DeclarationExit: true,
    Document: true,
    DocumentExit: true,
    Once: true,
    OnceExit: true,
    postcssPlugin: true,
    prepare: true,
    Root: true,
    RootExit: true,
    Rule: true,
    RuleExit: true
  };
  var NOT_VISITORS$1 = {
    Once: true,
    postcssPlugin: true,
    prepare: true
  };
  var CHILDREN$1 = 0;
  function isPromise$1(obj) {
    return typeof obj === "object" && typeof obj.then === "function";
  }
  function getEvents$1(node2) {
    let key = false;
    let type = TYPE_TO_CLASS_NAME$1[node2.type];
    if (node2.type === "decl") {
      key = node2.prop.toLowerCase();
    } else if (node2.type === "atrule") {
      key = node2.name.toLowerCase();
    }
    if (key && node2.append) {
      return [
        type,
        type + "-" + key,
        CHILDREN$1,
        type + "Exit",
        type + "Exit-" + key
      ];
    } else if (key) {
      return [type, type + "-" + key, type + "Exit", type + "Exit-" + key];
    } else if (node2.append) {
      return [type, CHILDREN$1, type + "Exit"];
    } else {
      return [type, type + "Exit"];
    }
  }
  function toStack$1(node2) {
    let events;
    if (node2.type === "document") {
      events = ["Document", CHILDREN$1, "DocumentExit"];
    } else if (node2.type === "root") {
      events = ["Root", CHILDREN$1, "RootExit"];
    } else {
      events = getEvents$1(node2);
    }
    return {
      eventIndex: 0,
      events,
      iterator: 0,
      node: node2,
      visitorIndex: 0,
      visitors: []
    };
  }
  function cleanMarks$1(node2) {
    node2[isClean$3] = false;
    if (node2.nodes) node2.nodes.forEach((i2) => cleanMarks$1(i2));
    return node2;
  }
  var postcss$2$1 = {};
  var LazyResult$2$1 = class LazyResult {
    constructor(processor2, css, opts) {
      this.stringified = false;
      this.processed = false;
      let root2;
      if (typeof css === "object" && css !== null && (css.type === "root" || css.type === "document")) {
        root2 = cleanMarks$1(css);
      } else if (css instanceof LazyResult || css instanceof Result$2$1) {
        root2 = cleanMarks$1(css.root);
        if (css.map) {
          if (typeof opts.map === "undefined") opts.map = {};
          if (!opts.map.inline) opts.map.inline = false;
          opts.map.prev = css.map;
        }
      } else {
        let parser2 = parse$2$1;
        if (opts.syntax) parser2 = opts.syntax.parse;
        if (opts.parser) parser2 = opts.parser;
        if (parser2.parse) parser2 = parser2.parse;
        try {
          root2 = parser2(css, opts);
        } catch (error) {
          this.processed = true;
          this.error = error;
        }
        if (root2 && !root2[my$3]) {
          Container$1$1.rebuild(root2);
        }
      }
      this.result = new Result$2$1(processor2, root2, opts);
      this.helpers = { ...postcss$2$1, postcss: postcss$2$1, result: this.result };
      this.plugins = this.processor.plugins.map((plugin22) => {
        if (typeof plugin22 === "object" && plugin22.prepare) {
          return { ...plugin22, ...plugin22.prepare(this.result) };
        } else {
          return plugin22;
        }
      });
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      if (this.processed) return Promise.resolve(this.result);
      if (!this.processing) {
        this.processing = this.runAsync();
      }
      return this.processing;
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(error, node2) {
      let plugin22 = this.result.lastPlugin;
      try {
        if (node2) node2.addToError(error);
        this.error = error;
        if (error.name === "CssSyntaxError" && !error.plugin) {
          error.plugin = plugin22.postcssPlugin;
          error.setMessage();
        } else if (plugin22.postcssVersion) {
          if (false) {
            let pluginName = plugin22.postcssPlugin;
            let pluginVer = plugin22.postcssVersion;
            let runtimeVer = this.result.processor.version;
            let a2 = pluginVer.split(".");
            let b = runtimeVer.split(".");
            if (a2[0] !== b[0] || parseInt(a2[1]) > parseInt(b[1])) {
              console.error(
                "Unknown error from PostCSS plugin. Your current PostCSS version is " + runtimeVer + ", but " + pluginName + " uses " + pluginVer + ". Perhaps this is the source of the error below."
              );
            }
          }
        }
      } catch (err2) {
        if (console && console.error) console.error(err2);
      }
      return error;
    }
    prepareVisitors() {
      this.listeners = {};
      let add = (plugin22, type, cb) => {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push([plugin22, cb]);
      };
      for (let plugin22 of this.plugins) {
        if (typeof plugin22 === "object") {
          for (let event in plugin22) {
            if (!PLUGIN_PROPS$1[event] && /^[A-Z]/.test(event)) {
              throw new Error(
                `Unknown event ${event} in ${plugin22.postcssPlugin}. Try to update PostCSS (${this.processor.version} now).`
              );
            }
            if (!NOT_VISITORS$1[event]) {
              if (typeof plugin22[event] === "object") {
                for (let filter in plugin22[event]) {
                  if (filter === "*") {
                    add(plugin22, event, plugin22[event][filter]);
                  } else {
                    add(
                      plugin22,
                      event + "-" + filter.toLowerCase(),
                      plugin22[event][filter]
                    );
                  }
                }
              } else if (typeof plugin22[event] === "function") {
                add(plugin22, event, plugin22[event]);
              }
            }
          }
        }
      }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let i2 = 0; i2 < this.plugins.length; i2++) {
        let plugin22 = this.plugins[i2];
        let promise = this.runOnRoot(plugin22);
        if (isPromise$1(promise)) {
          try {
            await promise;
          } catch (error) {
            throw this.handleError(error);
          }
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean$3]) {
          root2[isClean$3] = true;
          let stack = [toStack$1(root2)];
          while (stack.length > 0) {
            let promise = this.visitTick(stack);
            if (isPromise$1(promise)) {
              try {
                await promise;
              } catch (e2) {
                let node2 = stack[stack.length - 1].node;
                throw this.handleError(e2, node2);
              }
            }
          }
        }
        if (this.listeners.OnceExit) {
          for (let [plugin22, visitor] of this.listeners.OnceExit) {
            this.result.lastPlugin = plugin22;
            try {
              if (root2.type === "document") {
                let roots = root2.nodes.map(
                  (subRoot) => visitor(subRoot, this.helpers)
                );
                await Promise.all(roots);
              } else {
                await visitor(root2, this.helpers);
              }
            } catch (e2) {
              throw this.handleError(e2);
            }
          }
        }
      }
      this.processed = true;
      return this.stringify();
    }
    runOnRoot(plugin22) {
      this.result.lastPlugin = plugin22;
      try {
        if (typeof plugin22 === "object" && plugin22.Once) {
          if (this.result.root.type === "document") {
            let roots = this.result.root.nodes.map(
              (root2) => plugin22.Once(root2, this.helpers)
            );
            if (isPromise$1(roots[0])) {
              return Promise.all(roots);
            }
            return roots;
          }
          return plugin22.Once(this.result.root, this.helpers);
        } else if (typeof plugin22 === "function") {
          return plugin22(this.result.root, this.result);
        }
      } catch (error) {
        throw this.handleError(error);
      }
    }
    stringify() {
      if (this.error) throw this.error;
      if (this.stringified) return this.result;
      this.stringified = true;
      this.sync();
      let opts = this.result.opts;
      let str = stringify$2$1;
      if (opts.syntax) str = opts.syntax.stringify;
      if (opts.stringifier) str = opts.stringifier;
      if (str.stringify) str = str.stringify;
      let map = new MapGenerator$1$1(str, this.result.root, this.result.opts);
      let data = map.generate();
      this.result.css = data[0];
      this.result.map = data[1];
      return this.result;
    }
    sync() {
      if (this.error) throw this.error;
      if (this.processed) return this.result;
      this.processed = true;
      if (this.processing) {
        throw this.getAsyncError();
      }
      for (let plugin22 of this.plugins) {
        let promise = this.runOnRoot(plugin22);
        if (isPromise$1(promise)) {
          throw this.getAsyncError();
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean$3]) {
          root2[isClean$3] = true;
          this.walkSync(root2);
        }
        if (this.listeners.OnceExit) {
          if (root2.type === "document") {
            for (let subRoot of root2.nodes) {
              this.visitSync(this.listeners.OnceExit, subRoot);
            }
          } else {
            this.visitSync(this.listeners.OnceExit, root2);
          }
        }
      }
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (false) {
        if (!("from" in this.opts)) {
          warnOnce$1$1(
            "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
          );
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this.css;
    }
    visitSync(visitors, node2) {
      for (let [plugin22, visitor] of visitors) {
        this.result.lastPlugin = plugin22;
        let promise;
        try {
          promise = visitor(node2, this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2.proxyOf);
        }
        if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
          return true;
        }
        if (isPromise$1(promise)) {
          throw this.getAsyncError();
        }
      }
    }
    visitTick(stack) {
      let visit2 = stack[stack.length - 1];
      let { node: node2, visitors } = visit2;
      if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
        stack.pop();
        return;
      }
      if (visitors.length > 0 && visit2.visitorIndex < visitors.length) {
        let [plugin22, visitor] = visitors[visit2.visitorIndex];
        visit2.visitorIndex += 1;
        if (visit2.visitorIndex === visitors.length) {
          visit2.visitors = [];
          visit2.visitorIndex = 0;
        }
        this.result.lastPlugin = plugin22;
        try {
          return visitor(node2.toProxy(), this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2);
        }
      }
      if (visit2.iterator !== 0) {
        let iterator = visit2.iterator;
        let child;
        while (child = node2.nodes[node2.indexes[iterator]]) {
          node2.indexes[iterator] += 1;
          if (!child[isClean$3]) {
            child[isClean$3] = true;
            stack.push(toStack$1(child));
            return;
          }
        }
        visit2.iterator = 0;
        delete node2.indexes[iterator];
      }
      let events = visit2.events;
      while (visit2.eventIndex < events.length) {
        let event = events[visit2.eventIndex];
        visit2.eventIndex += 1;
        if (event === CHILDREN$1) {
          if (node2.nodes && node2.nodes.length) {
            node2[isClean$3] = true;
            visit2.iterator = node2.getIterator();
          }
          return;
        } else if (this.listeners[event]) {
          visit2.visitors = this.listeners[event];
          return;
        }
      }
      stack.pop();
    }
    walkSync(node2) {
      node2[isClean$3] = true;
      let events = getEvents$1(node2);
      for (let event of events) {
        if (event === CHILDREN$1) {
          if (node2.nodes) {
            node2.each((child) => {
              if (!child[isClean$3]) this.walkSync(child);
            });
          }
        } else {
          let visitors = this.listeners[event];
          if (visitors) {
            if (this.visitSync(visitors, node2.toProxy())) return;
          }
        }
      }
    }
    warnings() {
      return this.sync().warnings();
    }
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
  };
  LazyResult$2$1.registerPostcss = (dependant) => {
    postcss$2$1 = dependant;
  };
  var lazyResult$1 = LazyResult$2$1;
  LazyResult$2$1.default = LazyResult$2$1;
  Root$3$1.registerLazyResult(LazyResult$2$1);
  Document$2$1.registerLazyResult(LazyResult$2$1);
  var MapGenerator2$1 = mapGenerator$1;
  var stringify$1$1 = stringify_1$1;
  var parse$1$1 = parse_1$1;
  var Result$1$1 = result$1;
  var NoWorkResult$1$1 = class NoWorkResult {
    constructor(processor2, css, opts) {
      css = css.toString();
      this.stringified = false;
      this._processor = processor2;
      this._css = css;
      this._opts = opts;
      this._map = void 0;
      let root2;
      let str = stringify$1$1;
      this.result = new Result$1$1(this._processor, root2, this._opts);
      this.result.css = css;
      let self = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return self.root;
        }
      });
      let map = new MapGenerator2$1(str, root2, this._opts, css);
      if (map.isMap()) {
        let [generatedCSS, generatedMap] = map.generate();
        if (generatedCSS) {
          this.result.css = generatedCSS;
        }
        if (generatedMap) {
          this.result.map = generatedMap;
        }
      } else {
        map.clearAnnotation();
        this.result.css = map.css;
      }
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      return Promise.resolve(this.result);
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    sync() {
      if (this.error) throw this.error;
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (false) {
        if (!("from" in this._opts)) {
          warnOnce2$1(
            "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
          );
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root) {
        return this._root;
      }
      let root2;
      let parser2 = parse$1$1;
      try {
        root2 = parser2(this._css, this._opts);
      } catch (error) {
        this.error = error;
      }
      if (this.error) {
        throw this.error;
      } else {
        this._root = root2;
        return root2;
      }
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
  };
  var noWorkResult$1 = NoWorkResult$1$1;
  NoWorkResult$1$1.default = NoWorkResult$1$1;
  var NoWorkResult2$1 = noWorkResult$1;
  var LazyResult$1$1 = lazyResult$1;
  var Document$1$1 = document$1$1;
  var Root$2$1 = root$1;
  var Processor$1$1 = class Processor {
    constructor(plugins = []) {
      this.version = "8.4.38";
      this.plugins = this.normalize(plugins);
    }
    normalize(plugins) {
      let normalized = [];
      for (let i2 of plugins) {
        if (i2.postcss === true) {
          i2 = i2();
        } else if (i2.postcss) {
          i2 = i2.postcss;
        }
        if (typeof i2 === "object" && Array.isArray(i2.plugins)) {
          normalized = normalized.concat(i2.plugins);
        } else if (typeof i2 === "object" && i2.postcssPlugin) {
          normalized.push(i2);
        } else if (typeof i2 === "function") {
          normalized.push(i2);
        } else if (typeof i2 === "object" && (i2.parse || i2.stringify)) {
          if (false) {
            throw new Error(
              "PostCSS syntaxes cannot be used as plugins. Instead, please use one of the syntax/parser/stringifier options as outlined in your PostCSS runner documentation."
            );
          }
        } else {
          throw new Error(i2 + " is not a PostCSS plugin");
        }
      }
      return normalized;
    }
    process(css, opts = {}) {
      if (!this.plugins.length && !opts.parser && !opts.stringifier && !opts.syntax) {
        return new NoWorkResult2$1(this, css, opts);
      } else {
        return new LazyResult$1$1(this, css, opts);
      }
    }
    use(plugin22) {
      this.plugins = this.plugins.concat(this.normalize([plugin22]));
      return this;
    }
  };
  var processor$1 = Processor$1$1;
  Processor$1$1.default = Processor$1$1;
  Root$2$1.registerProcessor(Processor$1$1);
  Document$1$1.registerProcessor(Processor$1$1);
  var Declaration$1$1 = declaration$1;
  var PreviousMap2$1 = previousMap$1;
  var Comment$1$1 = comment$1;
  var AtRule$1$1 = atRule$1;
  var Input$1$1 = input$1;
  var Root$1$1 = root$1;
  var Rule$1$1 = rule$1;
  function fromJSON$1$1(json, inputs) {
    if (Array.isArray(json)) return json.map((n2) => fromJSON$1$1(n2));
    let { inputs: ownInputs, ...defaults } = json;
    if (ownInputs) {
      inputs = [];
      for (let input2 of ownInputs) {
        let inputHydrated = { ...input2, __proto__: Input$1$1.prototype };
        if (inputHydrated.map) {
          inputHydrated.map = {
            ...inputHydrated.map,
            __proto__: PreviousMap2$1.prototype
          };
        }
        inputs.push(inputHydrated);
      }
    }
    if (defaults.nodes) {
      defaults.nodes = json.nodes.map((n2) => fromJSON$1$1(n2, inputs));
    }
    if (defaults.source) {
      let { inputId, ...source } = defaults.source;
      defaults.source = source;
      if (inputId != null) {
        defaults.source.input = inputs[inputId];
      }
    }
    if (defaults.type === "root") {
      return new Root$1$1(defaults);
    } else if (defaults.type === "decl") {
      return new Declaration$1$1(defaults);
    } else if (defaults.type === "rule") {
      return new Rule$1$1(defaults);
    } else if (defaults.type === "comment") {
      return new Comment$1$1(defaults);
    } else if (defaults.type === "atrule") {
      return new AtRule$1$1(defaults);
    } else {
      throw new Error("Unknown node type: " + json.type);
    }
  }
  var fromJSON_1$1 = fromJSON$1$1;
  fromJSON$1$1.default = fromJSON$1$1;
  var CssSyntaxError2$1 = cssSyntaxError$1;
  var Declaration2$1 = declaration$1;
  var LazyResult2$1 = lazyResult$1;
  var Container2$1 = container$1;
  var Processor2$1 = processor$1;
  var stringify$5 = stringify_1$1;
  var fromJSON$2 = fromJSON_1$1;
  var Document22 = document$1$1;
  var Warning2$1 = warning$1;
  var Comment2$1 = comment$1;
  var AtRule2$1 = atRule$1;
  var Result2$1 = result$1;
  var Input2$1 = input$1;
  var parse$5 = parse_1$1;
  var list$3 = list_1$1;
  var Rule2$1 = rule$1;
  var Root2$1 = root$1;
  var Node2$1 = node$1;
  function postcss$3(...plugins) {
    if (plugins.length === 1 && Array.isArray(plugins[0])) {
      plugins = plugins[0];
    }
    return new Processor2$1(plugins);
  }
  postcss$3.plugin = function plugin(name, initializer) {
    let warningPrinted = false;
    function creator(...args) {
      if (console && console.warn && !warningPrinted) {
        warningPrinted = true;
        console.warn(
          name + ": postcss.plugin was deprecated. Migration guide:\nhttps://evilmartians.com/chronicles/postcss-8-plugin-migration"
        );
        if (process.env.LANG && process.env.LANG.startsWith("cn")) {
          console.warn(
            name + ": \u91CC\u9762 postcss.plugin \u88AB\u5F03\u7528. \u8FC1\u79FB\u6307\u5357:\nhttps://www.w3ctech.com/topic/2226"
          );
        }
      }
      let transformer = initializer(...args);
      transformer.postcssPlugin = name;
      transformer.postcssVersion = new Processor2$1().version;
      return transformer;
    }
    let cache;
    Object.defineProperty(creator, "postcss", {
      get() {
        if (!cache) cache = creator();
        return cache;
      }
    });
    creator.process = function(css, processOpts, pluginOpts) {
      return postcss$3([creator(pluginOpts)]).process(css, processOpts);
    };
    return creator;
  };
  postcss$3.stringify = stringify$5;
  postcss$3.parse = parse$5;
  postcss$3.fromJSON = fromJSON$2;
  postcss$3.list = list$3;
  postcss$3.comment = (defaults) => new Comment2$1(defaults);
  postcss$3.atRule = (defaults) => new AtRule2$1(defaults);
  postcss$3.decl = (defaults) => new Declaration2$1(defaults);
  postcss$3.rule = (defaults) => new Rule2$1(defaults);
  postcss$3.root = (defaults) => new Root2$1(defaults);
  postcss$3.document = (defaults) => new Document22(defaults);
  postcss$3.CssSyntaxError = CssSyntaxError2$1;
  postcss$3.Declaration = Declaration2$1;
  postcss$3.Container = Container2$1;
  postcss$3.Processor = Processor2$1;
  postcss$3.Document = Document22;
  postcss$3.Comment = Comment2$1;
  postcss$3.Warning = Warning2$1;
  postcss$3.AtRule = AtRule2$1;
  postcss$3.Result = Result2$1;
  postcss$3.Input = Input2$1;
  postcss$3.Rule = Rule2$1;
  postcss$3.Root = Root2$1;
  postcss$3.Node = Node2$1;
  LazyResult2$1.registerPostcss(postcss$3);
  var postcss_1$1 = postcss$3;
  postcss$3.default = postcss$3;
  var postcss$1$1 = /* @__PURE__ */ getDefaultExportFromCjs$1(postcss_1$1);
  postcss$1$1.stringify;
  postcss$1$1.fromJSON;
  postcss$1$1.plugin;
  postcss$1$1.parse;
  postcss$1$1.list;
  postcss$1$1.document;
  postcss$1$1.comment;
  postcss$1$1.atRule;
  postcss$1$1.rule;
  postcss$1$1.decl;
  postcss$1$1.root;
  postcss$1$1.CssSyntaxError;
  postcss$1$1.Declaration;
  postcss$1$1.Container;
  postcss$1$1.Processor;
  postcss$1$1.Document;
  postcss$1$1.Comment;
  postcss$1$1.Warning;
  postcss$1$1.AtRule;
  postcss$1$1.Result;
  postcss$1$1.Input;
  postcss$1$1.Rule;
  postcss$1$1.Root;
  postcss$1$1.Node;
  var __defProp2 = Object.defineProperty;
  var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
  function getDefaultExportFromCjs(x2) {
    return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
  }
  function getAugmentedNamespace(n2) {
    if (n2.__esModule) return n2;
    var f2 = n2.default;
    if (typeof f2 == "function") {
      var a2 = function a22() {
        if (this instanceof a22) {
          return Reflect.construct(f2, arguments, this.constructor);
        }
        return f2.apply(this, arguments);
      };
      a2.prototype = f2.prototype;
    } else a2 = {};
    Object.defineProperty(a2, "__esModule", { value: true });
    Object.keys(n2).forEach(function(k) {
      var d = Object.getOwnPropertyDescriptor(n2, k);
      Object.defineProperty(a2, k, d.get ? d : {
        enumerable: true,
        get: function() {
          return n2[k];
        }
      });
    });
    return a2;
  }
  var picocolors_browser = { exports: {} };
  var x = String;
  var create = function() {
    return { isColorSupported: false, reset: x, bold: x, dim: x, italic: x, underline: x, inverse: x, hidden: x, strikethrough: x, black: x, red: x, green: x, yellow: x, blue: x, magenta: x, cyan: x, white: x, gray: x, bgBlack: x, bgRed: x, bgGreen: x, bgYellow: x, bgBlue: x, bgMagenta: x, bgCyan: x, bgWhite: x };
  };
  picocolors_browser.exports = create();
  picocolors_browser.exports.createColors = create;
  var picocolors_browserExports = picocolors_browser.exports;
  var __viteBrowserExternal = {};
  var __viteBrowserExternal$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: __viteBrowserExternal
  }, Symbol.toStringTag, { value: "Module" }));
  var require$$2 = /* @__PURE__ */ getAugmentedNamespace(__viteBrowserExternal$1);
  var pico = picocolors_browserExports;
  var terminalHighlight$1 = require$$2;
  var CssSyntaxError$3 = class CssSyntaxError2 extends Error {
    constructor(message, line, column, source, file, plugin22) {
      super(message);
      this.name = "CssSyntaxError";
      this.reason = message;
      if (file) {
        this.file = file;
      }
      if (source) {
        this.source = source;
      }
      if (plugin22) {
        this.plugin = plugin22;
      }
      if (typeof line !== "undefined" && typeof column !== "undefined") {
        if (typeof line === "number") {
          this.line = line;
          this.column = column;
        } else {
          this.line = line.line;
          this.column = line.column;
          this.endLine = column.line;
          this.endColumn = column.column;
        }
      }
      this.setMessage();
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, CssSyntaxError2);
      }
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "";
      this.message += this.file ? this.file : "<css input>";
      if (typeof this.line !== "undefined") {
        this.message += ":" + this.line + ":" + this.column;
      }
      this.message += ": " + this.reason;
    }
    showSourceCode(color) {
      if (!this.source) return "";
      let css = this.source;
      if (color == null) color = pico.isColorSupported;
      if (terminalHighlight$1) {
        if (color) css = terminalHighlight$1(css);
      }
      let lines = css.split(/\r?\n/);
      let start = Math.max(this.line - 3, 0);
      let end = Math.min(this.line + 2, lines.length);
      let maxWidth = String(end).length;
      let mark, aside;
      if (color) {
        let { bold, gray, red } = pico.createColors(true);
        mark = (text) => bold(red(text));
        aside = (text) => gray(text);
      } else {
        mark = aside = (str) => str;
      }
      return lines.slice(start, end).map((line, index2) => {
        let number = start + 1 + index2;
        let gutter = " " + (" " + number).slice(-maxWidth) + " | ";
        if (number === this.line) {
          let spacing = aside(gutter.replace(/\d/g, " ")) + line.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return mark(">") + aside(gutter) + line + "\n " + spacing + mark("^");
        }
        return " " + aside(gutter) + line;
      }).join("\n");
    }
    toString() {
      let code = this.showSourceCode();
      if (code) {
        code = "\n\n" + code + "\n";
      }
      return this.name + ": " + this.message + code;
    }
  };
  var cssSyntaxError = CssSyntaxError$3;
  CssSyntaxError$3.default = CssSyntaxError$3;
  var symbols = {};
  symbols.isClean = Symbol("isClean");
  symbols.my = Symbol("my");
  var DEFAULT_RAW = {
    after: "\n",
    beforeClose: "\n",
    beforeComment: "\n",
    beforeDecl: "\n",
    beforeOpen: " ",
    beforeRule: "\n",
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: false
  };
  function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
  }
  var Stringifier$2 = class Stringifier2 {
    constructor(builder) {
      this.builder = builder;
    }
    atrule(node2, semicolon) {
      let name = "@" + node2.name;
      let params = node2.params ? this.rawValue(node2, "params") : "";
      if (typeof node2.raws.afterName !== "undefined") {
        name += node2.raws.afterName;
      } else if (params) {
        name += " ";
      }
      if (node2.nodes) {
        this.block(node2, name + params);
      } else {
        let end = (node2.raws.between || "") + (semicolon ? ";" : "");
        this.builder(name + params + end, node2);
      }
    }
    beforeAfter(node2, detect) {
      let value;
      if (node2.type === "decl") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (node2.type === "comment") {
        value = this.raw(node2, null, "beforeComment");
      } else if (detect === "before") {
        value = this.raw(node2, null, "beforeRule");
      } else {
        value = this.raw(node2, null, "beforeClose");
      }
      let buf = node2.parent;
      let depth = 0;
      while (buf && buf.type !== "root") {
        depth += 1;
        buf = buf.parent;
      }
      if (value.includes("\n")) {
        let indent = this.raw(node2, null, "indent");
        if (indent.length) {
          for (let step = 0; step < depth; step++) value += indent;
        }
      }
      return value;
    }
    block(node2, start) {
      let between = this.raw(node2, "between", "beforeOpen");
      this.builder(start + between + "{", node2, "start");
      let after;
      if (node2.nodes && node2.nodes.length) {
        this.body(node2);
        after = this.raw(node2, "after");
      } else {
        after = this.raw(node2, "after", "emptyBody");
      }
      if (after) this.builder(after);
      this.builder("}", node2, "end");
    }
    body(node2) {
      let last = node2.nodes.length - 1;
      while (last > 0) {
        if (node2.nodes[last].type !== "comment") break;
        last -= 1;
      }
      let semicolon = this.raw(node2, "semicolon");
      for (let i2 = 0; i2 < node2.nodes.length; i2++) {
        let child = node2.nodes[i2];
        let before = this.raw(child, "before");
        if (before) this.builder(before);
        this.stringify(child, last !== i2 || semicolon);
      }
    }
    comment(node2) {
      let left = this.raw(node2, "left", "commentLeft");
      let right = this.raw(node2, "right", "commentRight");
      this.builder("/*" + left + node2.text + right + "*/", node2);
    }
    decl(node2, semicolon) {
      let between = this.raw(node2, "between", "colon");
      let string = node2.prop + between + this.rawValue(node2, "value");
      if (node2.important) {
        string += node2.raws.important || " !important";
      }
      if (semicolon) string += ";";
      this.builder(string, node2);
    }
    document(node2) {
      this.body(node2);
    }
    raw(node2, own, detect) {
      let value;
      if (!detect) detect = own;
      if (own) {
        value = node2.raws[own];
        if (typeof value !== "undefined") return value;
      }
      let parent = node2.parent;
      if (detect === "before") {
        if (!parent || parent.type === "root" && parent.first === node2) {
          return "";
        }
        if (parent && parent.type === "document") {
          return "";
        }
      }
      if (!parent) return DEFAULT_RAW[detect];
      let root2 = node2.root();
      if (!root2.rawCache) root2.rawCache = {};
      if (typeof root2.rawCache[detect] !== "undefined") {
        return root2.rawCache[detect];
      }
      if (detect === "before" || detect === "after") {
        return this.beforeAfter(node2, detect);
      } else {
        let method = "raw" + capitalize(detect);
        if (this[method]) {
          value = this[method](root2, node2);
        } else {
          root2.walk((i2) => {
            value = i2.raws[own];
            if (typeof value !== "undefined") return false;
          });
        }
      }
      if (typeof value === "undefined") value = DEFAULT_RAW[detect];
      root2.rawCache[detect] = value;
      return value;
    }
    rawBeforeClose(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length > 0) {
          if (typeof i2.raws.after !== "undefined") {
            value = i2.raws.after;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawBeforeComment(root2, node2) {
      let value;
      root2.walkComments((i2) => {
        if (typeof i2.raws.before !== "undefined") {
          value = i2.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeDecl");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeDecl(root2, node2) {
      let value;
      root2.walkDecls((i2) => {
        if (typeof i2.raws.before !== "undefined") {
          value = i2.raws.before;
          if (value.includes("\n")) {
            value = value.replace(/[^\n]+$/, "");
          }
          return false;
        }
      });
      if (typeof value === "undefined") {
        value = this.raw(node2, null, "beforeRule");
      } else if (value) {
        value = value.replace(/\S/g, "");
      }
      return value;
    }
    rawBeforeOpen(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.type !== "decl") {
          value = i2.raws.between;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawBeforeRule(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && (i2.parent !== root2 || root2.first !== i2)) {
          if (typeof i2.raws.before !== "undefined") {
            value = i2.raws.before;
            if (value.includes("\n")) {
              value = value.replace(/[^\n]+$/, "");
            }
            return false;
          }
        }
      });
      if (value) value = value.replace(/\S/g, "");
      return value;
    }
    rawColon(root2) {
      let value;
      root2.walkDecls((i2) => {
        if (typeof i2.raws.between !== "undefined") {
          value = i2.raws.between.replace(/[^\s:]/g, "");
          return false;
        }
      });
      return value;
    }
    rawEmptyBody(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length === 0) {
          value = i2.raws.after;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawIndent(root2) {
      if (root2.raws.indent) return root2.raws.indent;
      let value;
      root2.walk((i2) => {
        let p = i2.parent;
        if (p && p !== root2 && p.parent && p.parent === root2) {
          if (typeof i2.raws.before !== "undefined") {
            let parts = i2.raws.before.split("\n");
            value = parts[parts.length - 1];
            value = value.replace(/\S/g, "");
            return false;
          }
        }
      });
      return value;
    }
    rawSemicolon(root2) {
      let value;
      root2.walk((i2) => {
        if (i2.nodes && i2.nodes.length && i2.last.type === "decl") {
          value = i2.raws.semicolon;
          if (typeof value !== "undefined") return false;
        }
      });
      return value;
    }
    rawValue(node2, prop) {
      let value = node2[prop];
      let raw = node2.raws[prop];
      if (raw && raw.value === value) {
        return raw.raw;
      }
      return value;
    }
    root(node2) {
      this.body(node2);
      if (node2.raws.after) this.builder(node2.raws.after);
    }
    rule(node2) {
      this.block(node2, this.rawValue(node2, "selector"));
      if (node2.raws.ownSemicolon) {
        this.builder(node2.raws.ownSemicolon, node2, "end");
      }
    }
    stringify(node2, semicolon) {
      if (!this[node2.type]) {
        throw new Error(
          "Unknown AST node type " + node2.type + ". Maybe you need to change PostCSS stringifier."
        );
      }
      this[node2.type](node2, semicolon);
    }
  };
  var stringifier = Stringifier$2;
  Stringifier$2.default = Stringifier$2;
  var Stringifier$1 = stringifier;
  function stringify$4(node2, builder) {
    let str = new Stringifier$1(builder);
    str.stringify(node2);
  }
  var stringify_1 = stringify$4;
  stringify$4.default = stringify$4;
  var { isClean: isClean$2, my: my$2 } = symbols;
  var CssSyntaxError$2 = cssSyntaxError;
  var Stringifier22 = stringifier;
  var stringify$3 = stringify_1;
  function cloneNode(obj, parent) {
    let cloned = new obj.constructor();
    for (let i2 in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, i2)) {
        continue;
      }
      if (i2 === "proxyCache") continue;
      let value = obj[i2];
      let type = typeof value;
      if (i2 === "parent" && type === "object") {
        if (parent) cloned[i2] = parent;
      } else if (i2 === "source") {
        cloned[i2] = value;
      } else if (Array.isArray(value)) {
        cloned[i2] = value.map((j) => cloneNode(j, cloned));
      } else {
        if (type === "object" && value !== null) value = cloneNode(value);
        cloned[i2] = value;
      }
    }
    return cloned;
  }
  var Node$4 = class Node3 {
    constructor(defaults = {}) {
      this.raws = {};
      this[isClean$2] = false;
      this[my$2] = true;
      for (let name in defaults) {
        if (name === "nodes") {
          this.nodes = [];
          for (let node2 of defaults[name]) {
            if (typeof node2.clone === "function") {
              this.append(node2.clone());
            } else {
              this.append(node2);
            }
          }
        } else {
          this[name] = defaults[name];
        }
      }
    }
    addToError(error) {
      error.postcssNode = this;
      if (error.stack && this.source && /\n\s{4}at /.test(error.stack)) {
        let s2 = this.source;
        error.stack = error.stack.replace(
          /\n\s{4}at /,
          `$&${s2.input.from}:${s2.start.line}:${s2.start.column}$&`
        );
      }
      return error;
    }
    after(add) {
      this.parent.insertAfter(this, add);
      return this;
    }
    assign(overrides = {}) {
      for (let name in overrides) {
        this[name] = overrides[name];
      }
      return this;
    }
    before(add) {
      this.parent.insertBefore(this, add);
      return this;
    }
    cleanRaws(keepBetween) {
      delete this.raws.before;
      delete this.raws.after;
      if (!keepBetween) delete this.raws.between;
    }
    clone(overrides = {}) {
      let cloned = cloneNode(this);
      for (let name in overrides) {
        cloned[name] = overrides[name];
      }
      return cloned;
    }
    cloneAfter(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertAfter(this, cloned);
      return cloned;
    }
    cloneBefore(overrides = {}) {
      let cloned = this.clone(overrides);
      this.parent.insertBefore(this, cloned);
      return cloned;
    }
    error(message, opts = {}) {
      if (this.source) {
        let { end, start } = this.rangeBy(opts);
        return this.source.input.error(
          message,
          { column: start.column, line: start.line },
          { column: end.column, line: end.line },
          opts
        );
      }
      return new CssSyntaxError$2(message);
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "prop" || prop === "value" || prop === "name" || prop === "params" || prop === "important" || /* c8 ignore next */
          prop === "text") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    markDirty() {
      if (this[isClean$2]) {
        this[isClean$2] = false;
        let next = this;
        while (next = next.parent) {
          next[isClean$2] = false;
        }
      }
    }
    next() {
      if (!this.parent) return void 0;
      let index2 = this.parent.index(this);
      return this.parent.nodes[index2 + 1];
    }
    positionBy(opts, stringRepresentation) {
      let pos = this.source.start;
      if (opts.index) {
        pos = this.positionInside(opts.index, stringRepresentation);
      } else if (opts.word) {
        stringRepresentation = this.toString();
        let index2 = stringRepresentation.indexOf(opts.word);
        if (index2 !== -1) pos = this.positionInside(index2, stringRepresentation);
      }
      return pos;
    }
    positionInside(index2, stringRepresentation) {
      let string = stringRepresentation || this.toString();
      let column = this.source.start.column;
      let line = this.source.start.line;
      for (let i2 = 0; i2 < index2; i2++) {
        if (string[i2] === "\n") {
          column = 1;
          line += 1;
        } else {
          column += 1;
        }
      }
      return { column, line };
    }
    prev() {
      if (!this.parent) return void 0;
      let index2 = this.parent.index(this);
      return this.parent.nodes[index2 - 1];
    }
    rangeBy(opts) {
      let start = {
        column: this.source.start.column,
        line: this.source.start.line
      };
      let end = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line
      } : {
        column: start.column + 1,
        line: start.line
      };
      if (opts.word) {
        let stringRepresentation = this.toString();
        let index2 = stringRepresentation.indexOf(opts.word);
        if (index2 !== -1) {
          start = this.positionInside(index2, stringRepresentation);
          end = this.positionInside(index2 + opts.word.length, stringRepresentation);
        }
      } else {
        if (opts.start) {
          start = {
            column: opts.start.column,
            line: opts.start.line
          };
        } else if (opts.index) {
          start = this.positionInside(opts.index);
        }
        if (opts.end) {
          end = {
            column: opts.end.column,
            line: opts.end.line
          };
        } else if (typeof opts.endIndex === "number") {
          end = this.positionInside(opts.endIndex);
        } else if (opts.index) {
          end = this.positionInside(opts.index + 1);
        }
      }
      if (end.line < start.line || end.line === start.line && end.column <= start.column) {
        end = { column: start.column + 1, line: start.line };
      }
      return { end, start };
    }
    raw(prop, defaultType) {
      let str = new Stringifier22();
      return str.raw(this, prop, defaultType);
    }
    remove() {
      if (this.parent) {
        this.parent.removeChild(this);
      }
      this.parent = void 0;
      return this;
    }
    replaceWith(...nodes) {
      if (this.parent) {
        let bookmark = this;
        let foundSelf = false;
        for (let node2 of nodes) {
          if (node2 === this) {
            foundSelf = true;
          } else if (foundSelf) {
            this.parent.insertAfter(bookmark, node2);
            bookmark = node2;
          } else {
            this.parent.insertBefore(bookmark, node2);
          }
        }
        if (!foundSelf) {
          this.remove();
        }
      }
      return this;
    }
    root() {
      let result2 = this;
      while (result2.parent && result2.parent.type !== "document") {
        result2 = result2.parent;
      }
      return result2;
    }
    toJSON(_, inputs) {
      let fixed = {};
      let emitInputs = inputs == null;
      inputs = inputs || /* @__PURE__ */ new Map();
      let inputsNextIndex = 0;
      for (let name in this) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) {
          continue;
        }
        if (name === "parent" || name === "proxyCache") continue;
        let value = this[name];
        if (Array.isArray(value)) {
          fixed[name] = value.map((i2) => {
            if (typeof i2 === "object" && i2.toJSON) {
              return i2.toJSON(null, inputs);
            } else {
              return i2;
            }
          });
        } else if (typeof value === "object" && value.toJSON) {
          fixed[name] = value.toJSON(null, inputs);
        } else if (name === "source") {
          let inputId = inputs.get(value.input);
          if (inputId == null) {
            inputId = inputsNextIndex;
            inputs.set(value.input, inputsNextIndex);
            inputsNextIndex++;
          }
          fixed[name] = {
            end: value.end,
            inputId,
            start: value.start
          };
        } else {
          fixed[name] = value;
        }
      }
      if (emitInputs) {
        fixed.inputs = [...inputs.keys()].map((input2) => input2.toJSON());
      }
      return fixed;
    }
    toProxy() {
      if (!this.proxyCache) {
        this.proxyCache = new Proxy(this, this.getProxyProcessor());
      }
      return this.proxyCache;
    }
    toString(stringifier2 = stringify$3) {
      if (stringifier2.stringify) stringifier2 = stringifier2.stringify;
      let result2 = "";
      stringifier2(this, (i2) => {
        result2 += i2;
      });
      return result2;
    }
    warn(result2, text, opts) {
      let data = { node: this };
      for (let i2 in opts) data[i2] = opts[i2];
      return result2.warn(text, data);
    }
    get proxyOf() {
      return this;
    }
  };
  var node = Node$4;
  Node$4.default = Node$4;
  var Node$3 = node;
  var Declaration$4 = class Declaration2 extends Node$3 {
    constructor(defaults) {
      if (defaults && typeof defaults.value !== "undefined" && typeof defaults.value !== "string") {
        defaults = { ...defaults, value: String(defaults.value) };
      }
      super(defaults);
      this.type = "decl";
    }
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
  };
  var declaration = Declaration$4;
  Declaration$4.default = Declaration$4;
  var urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  var customAlphabet = (alphabet, defaultSize = 21) => {
    return (size = defaultSize) => {
      let id = "";
      let i2 = size;
      while (i2--) {
        id += alphabet[Math.random() * alphabet.length | 0];
      }
      return id;
    };
  };
  var nanoid$1 = (size = 21) => {
    let id = "";
    let i2 = size;
    while (i2--) {
      id += urlAlphabet[Math.random() * 64 | 0];
    }
    return id;
  };
  var nonSecure = { nanoid: nanoid$1, customAlphabet };
  var { SourceMapConsumer: SourceMapConsumer$2, SourceMapGenerator: SourceMapGenerator$2 } = require$$2;
  var { existsSync, readFileSync } = require$$2;
  var { dirname: dirname$1, join } = require$$2;
  function fromBase64(str) {
    if (Buffer) {
      return Buffer.from(str, "base64").toString();
    } else {
      return window.atob(str);
    }
  }
  var PreviousMap$2 = class PreviousMap2 {
    constructor(css, opts) {
      if (opts.map === false) return;
      this.loadAnnotation(css);
      this.inline = this.startWith(this.annotation, "data:");
      let prev = opts.map ? opts.map.prev : void 0;
      let text = this.loadMap(opts.from, prev);
      if (!this.mapFile && opts.from) {
        this.mapFile = opts.from;
      }
      if (this.mapFile) this.root = dirname$1(this.mapFile);
      if (text) this.text = text;
    }
    consumer() {
      if (!this.consumerCache) {
        this.consumerCache = new SourceMapConsumer$2(this.text);
      }
      return this.consumerCache;
    }
    decodeInline(text) {
      let baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
      let baseUri = /^data:application\/json;base64,/;
      let charsetUri = /^data:application\/json;charset=utf-?8,/;
      let uri = /^data:application\/json,/;
      if (charsetUri.test(text) || uri.test(text)) {
        return decodeURIComponent(text.substr(RegExp.lastMatch.length));
      }
      if (baseCharsetUri.test(text) || baseUri.test(text)) {
        return fromBase64(text.substr(RegExp.lastMatch.length));
      }
      let encoding = text.match(/data:application\/json;([^,]+),/)[1];
      throw new Error("Unsupported source map encoding " + encoding);
    }
    getAnnotationURL(sourceMapString) {
      return sourceMapString.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(map) {
      if (typeof map !== "object") return false;
      return typeof map.mappings === "string" || typeof map._mappings === "string" || Array.isArray(map.sections);
    }
    loadAnnotation(css) {
      let comments = css.match(/\/\*\s*# sourceMappingURL=/gm);
      if (!comments) return;
      let start = css.lastIndexOf(comments.pop());
      let end = css.indexOf("*/", start);
      if (start > -1 && end > -1) {
        this.annotation = this.getAnnotationURL(css.substring(start, end));
      }
    }
    loadFile(path) {
      this.root = dirname$1(path);
      if (existsSync(path)) {
        this.mapFile = path;
        return readFileSync(path, "utf-8").toString().trim();
      }
    }
    loadMap(file, prev) {
      if (prev === false) return false;
      if (prev) {
        if (typeof prev === "string") {
          return prev;
        } else if (typeof prev === "function") {
          let prevPath = prev(file);
          if (prevPath) {
            let map = this.loadFile(prevPath);
            if (!map) {
              throw new Error(
                "Unable to load previous source map: " + prevPath.toString()
              );
            }
            return map;
          }
        } else if (prev instanceof SourceMapConsumer$2) {
          return SourceMapGenerator$2.fromSourceMap(prev).toString();
        } else if (prev instanceof SourceMapGenerator$2) {
          return prev.toString();
        } else if (this.isMap(prev)) {
          return JSON.stringify(prev);
        } else {
          throw new Error(
            "Unsupported previous source map format: " + prev.toString()
          );
        }
      } else if (this.inline) {
        return this.decodeInline(this.annotation);
      } else if (this.annotation) {
        let map = this.annotation;
        if (file) map = join(dirname$1(file), map);
        return this.loadFile(map);
      }
    }
    startWith(string, start) {
      if (!string) return false;
      return string.substr(0, start.length) === start;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  };
  var previousMap = PreviousMap$2;
  PreviousMap$2.default = PreviousMap$2;
  var { SourceMapConsumer: SourceMapConsumer$1, SourceMapGenerator: SourceMapGenerator$1 } = require$$2;
  var { fileURLToPath, pathToFileURL: pathToFileURL$1 } = require$$2;
  var { isAbsolute, resolve: resolve$1 } = require$$2;
  var { nanoid } = nonSecure;
  var terminalHighlight = require$$2;
  var CssSyntaxError$1 = cssSyntaxError;
  var PreviousMap$1 = previousMap;
  var fromOffsetCache = Symbol("fromOffsetCache");
  var sourceMapAvailable$1 = Boolean(SourceMapConsumer$1 && SourceMapGenerator$1);
  var pathAvailable$1 = Boolean(resolve$1 && isAbsolute);
  var Input$4 = class Input2 {
    constructor(css, opts = {}) {
      if (css === null || typeof css === "undefined" || typeof css === "object" && !css.toString) {
        throw new Error(`PostCSS received ${css} instead of CSS string`);
      }
      this.css = css.toString();
      if (this.css[0] === "\uFEFF" || this.css[0] === "\uFFFE") {
        this.hasBOM = true;
        this.css = this.css.slice(1);
      } else {
        this.hasBOM = false;
      }
      if (opts.from) {
        if (!pathAvailable$1 || /^\w+:\/\//.test(opts.from) || isAbsolute(opts.from)) {
          this.file = opts.from;
        } else {
          this.file = resolve$1(opts.from);
        }
      }
      if (pathAvailable$1 && sourceMapAvailable$1) {
        let map = new PreviousMap$1(this.css, opts);
        if (map.text) {
          this.map = map;
          let file = map.consumer().file;
          if (!this.file && file) this.file = this.mapResolve(file);
        }
      }
      if (!this.file) {
        this.id = "<input css " + nanoid(6) + ">";
      }
      if (this.map) this.map.file = this.from;
    }
    error(message, line, column, opts = {}) {
      let result2, endLine, endColumn;
      if (line && typeof line === "object") {
        let start = line;
        let end = column;
        if (typeof start.offset === "number") {
          let pos = this.fromOffset(start.offset);
          line = pos.line;
          column = pos.col;
        } else {
          line = start.line;
          column = start.column;
        }
        if (typeof end.offset === "number") {
          let pos = this.fromOffset(end.offset);
          endLine = pos.line;
          endColumn = pos.col;
        } else {
          endLine = end.line;
          endColumn = end.column;
        }
      } else if (!column) {
        let pos = this.fromOffset(line);
        line = pos.line;
        column = pos.col;
      }
      let origin = this.origin(line, column, endLine, endColumn);
      if (origin) {
        result2 = new CssSyntaxError$1(
          message,
          origin.endLine === void 0 ? origin.line : { column: origin.column, line: origin.line },
          origin.endLine === void 0 ? origin.column : { column: origin.endColumn, line: origin.endLine },
          origin.source,
          origin.file,
          opts.plugin
        );
      } else {
        result2 = new CssSyntaxError$1(
          message,
          endLine === void 0 ? line : { column, line },
          endLine === void 0 ? column : { column: endColumn, line: endLine },
          this.css,
          this.file,
          opts.plugin
        );
      }
      result2.input = { column, endColumn, endLine, line, source: this.css };
      if (this.file) {
        if (pathToFileURL$1) {
          result2.input.url = pathToFileURL$1(this.file).toString();
        }
        result2.input.file = this.file;
      }
      return result2;
    }
    fromOffset(offset) {
      let lastLine, lineToIndex;
      if (!this[fromOffsetCache]) {
        let lines = this.css.split("\n");
        lineToIndex = new Array(lines.length);
        let prevIndex = 0;
        for (let i2 = 0, l2 = lines.length; i2 < l2; i2++) {
          lineToIndex[i2] = prevIndex;
          prevIndex += lines[i2].length + 1;
        }
        this[fromOffsetCache] = lineToIndex;
      } else {
        lineToIndex = this[fromOffsetCache];
      }
      lastLine = lineToIndex[lineToIndex.length - 1];
      let min = 0;
      if (offset >= lastLine) {
        min = lineToIndex.length - 1;
      } else {
        let max = lineToIndex.length - 2;
        let mid;
        while (min < max) {
          mid = min + (max - min >> 1);
          if (offset < lineToIndex[mid]) {
            max = mid - 1;
          } else if (offset >= lineToIndex[mid + 1]) {
            min = mid + 1;
          } else {
            min = mid;
            break;
          }
        }
      }
      return {
        col: offset - lineToIndex[min] + 1,
        line: min + 1
      };
    }
    mapResolve(file) {
      if (/^\w+:\/\//.test(file)) {
        return file;
      }
      return resolve$1(this.map.consumer().sourceRoot || this.map.root || ".", file);
    }
    origin(line, column, endLine, endColumn) {
      if (!this.map) return false;
      let consumer = this.map.consumer();
      let from = consumer.originalPositionFor({ column, line });
      if (!from.source) return false;
      let to;
      if (typeof endLine === "number") {
        to = consumer.originalPositionFor({ column: endColumn, line: endLine });
      }
      let fromUrl;
      if (isAbsolute(from.source)) {
        fromUrl = pathToFileURL$1(from.source);
      } else {
        fromUrl = new URL(
          from.source,
          this.map.consumer().sourceRoot || pathToFileURL$1(this.map.mapFile)
        );
      }
      let result2 = {
        column: from.column,
        endColumn: to && to.column,
        endLine: to && to.line,
        line: from.line,
        url: fromUrl.toString()
      };
      if (fromUrl.protocol === "file:") {
        if (fileURLToPath) {
          result2.file = fileURLToPath(fromUrl);
        } else {
          throw new Error(`file: protocol is not available in this PostCSS build`);
        }
      }
      let source = consumer.sourceContentFor(from.source);
      if (source) result2.source = source;
      return result2;
    }
    toJSON() {
      let json = {};
      for (let name of ["hasBOM", "css", "file", "id"]) {
        if (this[name] != null) {
          json[name] = this[name];
        }
      }
      if (this.map) {
        json.map = { ...this.map };
        if (json.map.consumerCache) {
          json.map.consumerCache = void 0;
        }
      }
      return json;
    }
    get from() {
      return this.file || this.id;
    }
  };
  var input = Input$4;
  Input$4.default = Input$4;
  if (terminalHighlight && terminalHighlight.registerInput) {
    terminalHighlight.registerInput(Input$4);
  }
  var { SourceMapConsumer, SourceMapGenerator } = require$$2;
  var { dirname, relative, resolve, sep } = require$$2;
  var { pathToFileURL } = require$$2;
  var Input$3 = input;
  var sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
  var pathAvailable = Boolean(dirname && resolve && relative && sep);
  var MapGenerator$2 = class MapGenerator2 {
    constructor(stringify2, root2, opts, cssString) {
      this.stringify = stringify2;
      this.mapOpts = opts.map || {};
      this.root = root2;
      this.opts = opts;
      this.css = cssString;
      this.originalCSS = cssString;
      this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute;
      this.memoizedFileURLs = /* @__PURE__ */ new Map();
      this.memoizedPaths = /* @__PURE__ */ new Map();
      this.memoizedURLs = /* @__PURE__ */ new Map();
    }
    addAnnotation() {
      let content;
      if (this.isInline()) {
        content = "data:application/json;base64," + this.toBase64(this.map.toString());
      } else if (typeof this.mapOpts.annotation === "string") {
        content = this.mapOpts.annotation;
      } else if (typeof this.mapOpts.annotation === "function") {
        content = this.mapOpts.annotation(this.opts.to, this.root);
      } else {
        content = this.outputFile() + ".map";
      }
      let eol = "\n";
      if (this.css.includes("\r\n")) eol = "\r\n";
      this.css += eol + "/*# sourceMappingURL=" + content + " */";
    }
    applyPrevMaps() {
      for (let prev of this.previous()) {
        let from = this.toUrl(this.path(prev.file));
        let root2 = prev.root || dirname(prev.file);
        let map;
        if (this.mapOpts.sourcesContent === false) {
          map = new SourceMapConsumer(prev.text);
          if (map.sourcesContent) {
            map.sourcesContent = null;
          }
        } else {
          map = prev.consumer();
        }
        this.map.applySourceMap(map, from, this.toUrl(this.path(root2)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation === false) return;
      if (this.root) {
        let node2;
        for (let i2 = this.root.nodes.length - 1; i2 >= 0; i2--) {
          node2 = this.root.nodes[i2];
          if (node2.type !== "comment") continue;
          if (node2.text.indexOf("# sourceMappingURL=") === 0) {
            this.root.removeChild(i2);
          }
        }
      } else if (this.css) {
        this.css = this.css.replace(/\n*?\/\*#[\S\s]*?\*\/$/gm, "");
      }
    }
    generate() {
      this.clearAnnotation();
      if (pathAvailable && sourceMapAvailable && this.isMap()) {
        return this.generateMap();
      } else {
        let result2 = "";
        this.stringify(this.root, (i2) => {
          result2 += i2;
        });
        return [result2];
      }
    }
    generateMap() {
      if (this.root) {
        this.generateString();
      } else if (this.previous().length === 1) {
        let prev = this.previous()[0].consumer();
        prev.file = this.outputFile();
        this.map = SourceMapGenerator.fromSourceMap(prev, {
          ignoreInvalidMapping: true
        });
      } else {
        this.map = new SourceMapGenerator({
          file: this.outputFile(),
          ignoreInvalidMapping: true
        });
        this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      }
      if (this.isSourcesContent()) this.setSourcesContent();
      if (this.root && this.previous().length > 0) this.applyPrevMaps();
      if (this.isAnnotation()) this.addAnnotation();
      if (this.isInline()) {
        return [this.css];
      } else {
        return [this.css, this.map];
      }
    }
    generateString() {
      this.css = "";
      this.map = new SourceMapGenerator({
        file: this.outputFile(),
        ignoreInvalidMapping: true
      });
      let line = 1;
      let column = 1;
      let noSource = "<no source>";
      let mapping = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      };
      let lines, last;
      this.stringify(this.root, (str, node2, type) => {
        this.css += str;
        if (node2 && type !== "end") {
          mapping.generated.line = line;
          mapping.generated.column = column - 1;
          if (node2.source && node2.source.start) {
            mapping.source = this.sourcePath(node2);
            mapping.original.line = node2.source.start.line;
            mapping.original.column = node2.source.start.column - 1;
            this.map.addMapping(mapping);
          } else {
            mapping.source = noSource;
            mapping.original.line = 1;
            mapping.original.column = 0;
            this.map.addMapping(mapping);
          }
        }
        lines = str.match(/\n/g);
        if (lines) {
          line += lines.length;
          last = str.lastIndexOf("\n");
          column = str.length - last;
        } else {
          column += str.length;
        }
        if (node2 && type !== "start") {
          let p = node2.parent || { raws: {} };
          let childless = node2.type === "decl" || node2.type === "atrule" && !node2.nodes;
          if (!childless || node2 !== p.last || p.raws.semicolon) {
            if (node2.source && node2.source.end) {
              mapping.source = this.sourcePath(node2);
              mapping.original.line = node2.source.end.line;
              mapping.original.column = node2.source.end.column - 1;
              mapping.generated.line = line;
              mapping.generated.column = column - 2;
              this.map.addMapping(mapping);
            } else {
              mapping.source = noSource;
              mapping.original.line = 1;
              mapping.original.column = 0;
              mapping.generated.line = line;
              mapping.generated.column = column - 1;
              this.map.addMapping(mapping);
            }
          }
        }
      });
    }
    isAnnotation() {
      if (this.isInline()) {
        return true;
      }
      if (typeof this.mapOpts.annotation !== "undefined") {
        return this.mapOpts.annotation;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.annotation);
      }
      return true;
    }
    isInline() {
      if (typeof this.mapOpts.inline !== "undefined") {
        return this.mapOpts.inline;
      }
      let annotation = this.mapOpts.annotation;
      if (typeof annotation !== "undefined" && annotation !== true) {
        return false;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.inline);
      }
      return true;
    }
    isMap() {
      if (typeof this.opts.map !== "undefined") {
        return !!this.opts.map;
      }
      return this.previous().length > 0;
    }
    isSourcesContent() {
      if (typeof this.mapOpts.sourcesContent !== "undefined") {
        return this.mapOpts.sourcesContent;
      }
      if (this.previous().length) {
        return this.previous().some((i2) => i2.withContent());
      }
      return true;
    }
    outputFile() {
      if (this.opts.to) {
        return this.path(this.opts.to);
      } else if (this.opts.from) {
        return this.path(this.opts.from);
      } else {
        return "to.css";
      }
    }
    path(file) {
      if (this.mapOpts.absolute) return file;
      if (file.charCodeAt(0) === 60) return file;
      if (/^\w+:\/\//.test(file)) return file;
      let cached = this.memoizedPaths.get(file);
      if (cached) return cached;
      let from = this.opts.to ? dirname(this.opts.to) : ".";
      if (typeof this.mapOpts.annotation === "string") {
        from = dirname(resolve(from, this.mapOpts.annotation));
      }
      let path = relative(from, file);
      this.memoizedPaths.set(file, path);
      return path;
    }
    previous() {
      if (!this.previousMaps) {
        this.previousMaps = [];
        if (this.root) {
          this.root.walk((node2) => {
            if (node2.source && node2.source.input.map) {
              let map = node2.source.input.map;
              if (!this.previousMaps.includes(map)) {
                this.previousMaps.push(map);
              }
            }
          });
        } else {
          let input2 = new Input$3(this.originalCSS, this.opts);
          if (input2.map) this.previousMaps.push(input2.map);
        }
      }
      return this.previousMaps;
    }
    setSourcesContent() {
      let already = {};
      if (this.root) {
        this.root.walk((node2) => {
          if (node2.source) {
            let from = node2.source.input.from;
            if (from && !already[from]) {
              already[from] = true;
              let fromUrl = this.usesFileUrls ? this.toFileUrl(from) : this.toUrl(this.path(from));
              this.map.setSourceContent(fromUrl, node2.source.input.css);
            }
          }
        });
      } else if (this.css) {
        let from = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(from, this.css);
      }
    }
    sourcePath(node2) {
      if (this.mapOpts.from) {
        return this.toUrl(this.mapOpts.from);
      } else if (this.usesFileUrls) {
        return this.toFileUrl(node2.source.input.from);
      } else {
        return this.toUrl(this.path(node2.source.input.from));
      }
    }
    toBase64(str) {
      if (Buffer) {
        return Buffer.from(str).toString("base64");
      } else {
        return window.btoa(unescape(encodeURIComponent(str)));
      }
    }
    toFileUrl(path) {
      let cached = this.memoizedFileURLs.get(path);
      if (cached) return cached;
      if (pathToFileURL) {
        let fileURL = pathToFileURL(path).toString();
        this.memoizedFileURLs.set(path, fileURL);
        return fileURL;
      } else {
        throw new Error(
          "`map.absolute` option is not available in this PostCSS build"
        );
      }
    }
    toUrl(path) {
      let cached = this.memoizedURLs.get(path);
      if (cached) return cached;
      if (sep === "\\") {
        path = path.replace(/\\/g, "/");
      }
      let url = encodeURI(path).replace(/[#?]/g, encodeURIComponent);
      this.memoizedURLs.set(path, url);
      return url;
    }
  };
  var mapGenerator = MapGenerator$2;
  var Node$2 = node;
  var Comment$4 = class Comment2 extends Node$2 {
    constructor(defaults) {
      super(defaults);
      this.type = "comment";
    }
  };
  var comment = Comment$4;
  Comment$4.default = Comment$4;
  var { isClean: isClean$1, my: my$1 } = symbols;
  var Declaration$3 = declaration;
  var Comment$3 = comment;
  var Node$1 = node;
  var parse$4;
  var Rule$4;
  var AtRule$4;
  var Root$6;
  function cleanSource(nodes) {
    return nodes.map((i2) => {
      if (i2.nodes) i2.nodes = cleanSource(i2.nodes);
      delete i2.source;
      return i2;
    });
  }
  function markDirtyUp(node2) {
    node2[isClean$1] = false;
    if (node2.proxyOf.nodes) {
      for (let i2 of node2.proxyOf.nodes) {
        markDirtyUp(i2);
      }
    }
  }
  var Container$7 = class Container2 extends Node$1 {
    append(...children) {
      for (let child of children) {
        let nodes = this.normalize(child, this.last);
        for (let node2 of nodes) this.proxyOf.nodes.push(node2);
      }
      this.markDirty();
      return this;
    }
    cleanRaws(keepBetween) {
      super.cleanRaws(keepBetween);
      if (this.nodes) {
        for (let node2 of this.nodes) node2.cleanRaws(keepBetween);
      }
    }
    each(callback) {
      if (!this.proxyOf.nodes) return void 0;
      let iterator = this.getIterator();
      let index2, result2;
      while (this.indexes[iterator] < this.proxyOf.nodes.length) {
        index2 = this.indexes[iterator];
        result2 = callback(this.proxyOf.nodes[index2], index2);
        if (result2 === false) break;
        this.indexes[iterator] += 1;
      }
      delete this.indexes[iterator];
      return result2;
    }
    every(condition) {
      return this.nodes.every(condition);
    }
    getIterator() {
      if (!this.lastEach) this.lastEach = 0;
      if (!this.indexes) this.indexes = {};
      this.lastEach += 1;
      let iterator = this.lastEach;
      this.indexes[iterator] = 0;
      return iterator;
    }
    getProxyProcessor() {
      return {
        get(node2, prop) {
          if (prop === "proxyOf") {
            return node2;
          } else if (!node2[prop]) {
            return node2[prop];
          } else if (prop === "each" || typeof prop === "string" && prop.startsWith("walk")) {
            return (...args) => {
              return node2[prop](
                ...args.map((i2) => {
                  if (typeof i2 === "function") {
                    return (child, index2) => i2(child.toProxy(), index2);
                  } else {
                    return i2;
                  }
                })
              );
            };
          } else if (prop === "every" || prop === "some") {
            return (cb) => {
              return node2[prop](
                (child, ...other) => cb(child.toProxy(), ...other)
              );
            };
          } else if (prop === "root") {
            return () => node2.root().toProxy();
          } else if (prop === "nodes") {
            return node2.nodes.map((i2) => i2.toProxy());
          } else if (prop === "first" || prop === "last") {
            return node2[prop].toProxy();
          } else {
            return node2[prop];
          }
        },
        set(node2, prop, value) {
          if (node2[prop] === value) return true;
          node2[prop] = value;
          if (prop === "name" || prop === "params" || prop === "selector") {
            node2.markDirty();
          }
          return true;
        }
      };
    }
    index(child) {
      if (typeof child === "number") return child;
      if (child.proxyOf) child = child.proxyOf;
      return this.proxyOf.nodes.indexOf(child);
    }
    insertAfter(exist, add) {
      let existIndex = this.index(exist);
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex]).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex + 1, 0, node2);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (existIndex < index2) {
          this.indexes[id] = index2 + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    insertBefore(exist, add) {
      let existIndex = this.index(exist);
      let type = existIndex === 0 ? "prepend" : false;
      let nodes = this.normalize(add, this.proxyOf.nodes[existIndex], type).reverse();
      existIndex = this.index(exist);
      for (let node2 of nodes) this.proxyOf.nodes.splice(existIndex, 0, node2);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (existIndex <= index2) {
          this.indexes[id] = index2 + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    normalize(nodes, sample) {
      if (typeof nodes === "string") {
        nodes = cleanSource(parse$4(nodes).nodes);
      } else if (typeof nodes === "undefined") {
        nodes = [];
      } else if (Array.isArray(nodes)) {
        nodes = nodes.slice(0);
        for (let i2 of nodes) {
          if (i2.parent) i2.parent.removeChild(i2, "ignore");
        }
      } else if (nodes.type === "root" && this.type !== "document") {
        nodes = nodes.nodes.slice(0);
        for (let i2 of nodes) {
          if (i2.parent) i2.parent.removeChild(i2, "ignore");
        }
      } else if (nodes.type) {
        nodes = [nodes];
      } else if (nodes.prop) {
        if (typeof nodes.value === "undefined") {
          throw new Error("Value field is missed in node creation");
        } else if (typeof nodes.value !== "string") {
          nodes.value = String(nodes.value);
        }
        nodes = [new Declaration$3(nodes)];
      } else if (nodes.selector) {
        nodes = [new Rule$4(nodes)];
      } else if (nodes.name) {
        nodes = [new AtRule$4(nodes)];
      } else if (nodes.text) {
        nodes = [new Comment$3(nodes)];
      } else {
        throw new Error("Unknown node type in node creation");
      }
      let processed = nodes.map((i2) => {
        if (!i2[my$1]) Container2.rebuild(i2);
        i2 = i2.proxyOf;
        if (i2.parent) i2.parent.removeChild(i2);
        if (i2[isClean$1]) markDirtyUp(i2);
        if (typeof i2.raws.before === "undefined") {
          if (sample && typeof sample.raws.before !== "undefined") {
            i2.raws.before = sample.raws.before.replace(/\S/g, "");
          }
        }
        i2.parent = this.proxyOf;
        return i2;
      });
      return processed;
    }
    prepend(...children) {
      children = children.reverse();
      for (let child of children) {
        let nodes = this.normalize(child, this.first, "prepend").reverse();
        for (let node2 of nodes) this.proxyOf.nodes.unshift(node2);
        for (let id in this.indexes) {
          this.indexes[id] = this.indexes[id] + nodes.length;
        }
      }
      this.markDirty();
      return this;
    }
    push(child) {
      child.parent = this;
      this.proxyOf.nodes.push(child);
      return this;
    }
    removeAll() {
      for (let node2 of this.proxyOf.nodes) node2.parent = void 0;
      this.proxyOf.nodes = [];
      this.markDirty();
      return this;
    }
    removeChild(child) {
      child = this.index(child);
      this.proxyOf.nodes[child].parent = void 0;
      this.proxyOf.nodes.splice(child, 1);
      let index2;
      for (let id in this.indexes) {
        index2 = this.indexes[id];
        if (index2 >= child) {
          this.indexes[id] = index2 - 1;
        }
      }
      this.markDirty();
      return this;
    }
    replaceValues(pattern, opts, callback) {
      if (!callback) {
        callback = opts;
        opts = {};
      }
      this.walkDecls((decl) => {
        if (opts.props && !opts.props.includes(decl.prop)) return;
        if (opts.fast && !decl.value.includes(opts.fast)) return;
        decl.value = decl.value.replace(pattern, callback);
      });
      this.markDirty();
      return this;
    }
    some(condition) {
      return this.nodes.some(condition);
    }
    walk(callback) {
      return this.each((child, i2) => {
        let result2;
        try {
          result2 = callback(child, i2);
        } catch (e2) {
          throw child.addToError(e2);
        }
        if (result2 !== false && child.walk) {
          result2 = child.walk(callback);
        }
        return result2;
      });
    }
    walkAtRules(name, callback) {
      if (!callback) {
        callback = name;
        return this.walk((child, i2) => {
          if (child.type === "atrule") {
            return callback(child, i2);
          }
        });
      }
      if (name instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "atrule" && name.test(child.name)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "atrule" && child.name === name) {
          return callback(child, i2);
        }
      });
    }
    walkComments(callback) {
      return this.walk((child, i2) => {
        if (child.type === "comment") {
          return callback(child, i2);
        }
      });
    }
    walkDecls(prop, callback) {
      if (!callback) {
        callback = prop;
        return this.walk((child, i2) => {
          if (child.type === "decl") {
            return callback(child, i2);
          }
        });
      }
      if (prop instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "decl" && prop.test(child.prop)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "decl" && child.prop === prop) {
          return callback(child, i2);
        }
      });
    }
    walkRules(selector, callback) {
      if (!callback) {
        callback = selector;
        return this.walk((child, i2) => {
          if (child.type === "rule") {
            return callback(child, i2);
          }
        });
      }
      if (selector instanceof RegExp) {
        return this.walk((child, i2) => {
          if (child.type === "rule" && selector.test(child.selector)) {
            return callback(child, i2);
          }
        });
      }
      return this.walk((child, i2) => {
        if (child.type === "rule" && child.selector === selector) {
          return callback(child, i2);
        }
      });
    }
    get first() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[0];
    }
    get last() {
      if (!this.proxyOf.nodes) return void 0;
      return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
  };
  Container$7.registerParse = (dependant) => {
    parse$4 = dependant;
  };
  Container$7.registerRule = (dependant) => {
    Rule$4 = dependant;
  };
  Container$7.registerAtRule = (dependant) => {
    AtRule$4 = dependant;
  };
  Container$7.registerRoot = (dependant) => {
    Root$6 = dependant;
  };
  var container = Container$7;
  Container$7.default = Container$7;
  Container$7.rebuild = (node2) => {
    if (node2.type === "atrule") {
      Object.setPrototypeOf(node2, AtRule$4.prototype);
    } else if (node2.type === "rule") {
      Object.setPrototypeOf(node2, Rule$4.prototype);
    } else if (node2.type === "decl") {
      Object.setPrototypeOf(node2, Declaration$3.prototype);
    } else if (node2.type === "comment") {
      Object.setPrototypeOf(node2, Comment$3.prototype);
    } else if (node2.type === "root") {
      Object.setPrototypeOf(node2, Root$6.prototype);
    }
    node2[my$1] = true;
    if (node2.nodes) {
      node2.nodes.forEach((child) => {
        Container$7.rebuild(child);
      });
    }
  };
  var Container$6 = container;
  var LazyResult$4;
  var Processor$3;
  var Document$3 = class Document23 extends Container$6 {
    constructor(defaults) {
      super({ type: "document", ...defaults });
      if (!this.nodes) {
        this.nodes = [];
      }
    }
    toResult(opts = {}) {
      let lazy = new LazyResult$4(new Processor$3(), this, opts);
      return lazy.stringify();
    }
  };
  Document$3.registerLazyResult = (dependant) => {
    LazyResult$4 = dependant;
  };
  Document$3.registerProcessor = (dependant) => {
    Processor$3 = dependant;
  };
  var document$1 = Document$3;
  Document$3.default = Document$3;
  var Warning$2 = class Warning2 {
    constructor(text, opts = {}) {
      this.type = "warning";
      this.text = text;
      if (opts.node && opts.node.source) {
        let range = opts.node.rangeBy(opts);
        this.line = range.start.line;
        this.column = range.start.column;
        this.endLine = range.end.line;
        this.endColumn = range.end.column;
      }
      for (let opt in opts) this[opt] = opts[opt];
    }
    toString() {
      if (this.node) {
        return this.node.error(this.text, {
          index: this.index,
          plugin: this.plugin,
          word: this.word
        }).message;
      }
      if (this.plugin) {
        return this.plugin + ": " + this.text;
      }
      return this.text;
    }
  };
  var warning = Warning$2;
  Warning$2.default = Warning$2;
  var Warning$1 = warning;
  var Result$3 = class Result2 {
    constructor(processor2, root2, opts) {
      this.processor = processor2;
      this.messages = [];
      this.root = root2;
      this.opts = opts;
      this.css = void 0;
      this.map = void 0;
    }
    toString() {
      return this.css;
    }
    warn(text, opts = {}) {
      if (!opts.plugin) {
        if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
          opts.plugin = this.lastPlugin.postcssPlugin;
        }
      }
      let warning2 = new Warning$1(text, opts);
      this.messages.push(warning2);
      return warning2;
    }
    warnings() {
      return this.messages.filter((i2) => i2.type === "warning");
    }
    get content() {
      return this.css;
    }
  };
  var result = Result$3;
  Result$3.default = Result$3;
  var SINGLE_QUOTE = "'".charCodeAt(0);
  var DOUBLE_QUOTE = '"'.charCodeAt(0);
  var BACKSLASH = "\\".charCodeAt(0);
  var SLASH = "/".charCodeAt(0);
  var NEWLINE = "\n".charCodeAt(0);
  var SPACE = " ".charCodeAt(0);
  var FEED = "\f".charCodeAt(0);
  var TAB = "	".charCodeAt(0);
  var CR = "\r".charCodeAt(0);
  var OPEN_SQUARE = "[".charCodeAt(0);
  var CLOSE_SQUARE = "]".charCodeAt(0);
  var OPEN_PARENTHESES = "(".charCodeAt(0);
  var CLOSE_PARENTHESES = ")".charCodeAt(0);
  var OPEN_CURLY = "{".charCodeAt(0);
  var CLOSE_CURLY = "}".charCodeAt(0);
  var SEMICOLON = ";".charCodeAt(0);
  var ASTERISK = "*".charCodeAt(0);
  var COLON = ":".charCodeAt(0);
  var AT = "@".charCodeAt(0);
  var RE_AT_END = /[\t\n\f\r "#'()/;[\\\]{}]/g;
  var RE_WORD_END = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g;
  var RE_BAD_BRACKET = /.[\r\n"'(/\\]/;
  var RE_HEX_ESCAPE = /[\da-f]/i;
  var tokenize = function tokenizer2(input2, options = {}) {
    let css = input2.css.valueOf();
    let ignore = options.ignoreErrors;
    let code, next, quote, content, escape;
    let escaped, escapePos, prev, n2, currentToken;
    let length = css.length;
    let pos = 0;
    let buffer = [];
    let returned = [];
    function position() {
      return pos;
    }
    function unclosed(what) {
      throw input2.error("Unclosed " + what, pos);
    }
    function endOfFile() {
      return returned.length === 0 && pos >= length;
    }
    function nextToken(opts) {
      if (returned.length) return returned.pop();
      if (pos >= length) return;
      let ignoreUnclosed = opts ? opts.ignoreUnclosed : false;
      code = css.charCodeAt(pos);
      switch (code) {
        case NEWLINE:
        case SPACE:
        case TAB:
        case CR:
        case FEED: {
          next = pos;
          do {
            next += 1;
            code = css.charCodeAt(next);
          } while (code === SPACE || code === NEWLINE || code === TAB || code === CR || code === FEED);
          currentToken = ["space", css.slice(pos, next)];
          pos = next - 1;
          break;
        }
        case OPEN_SQUARE:
        case CLOSE_SQUARE:
        case OPEN_CURLY:
        case CLOSE_CURLY:
        case COLON:
        case SEMICOLON:
        case CLOSE_PARENTHESES: {
          let controlChar = String.fromCharCode(code);
          currentToken = [controlChar, controlChar, pos];
          break;
        }
        case OPEN_PARENTHESES: {
          prev = buffer.length ? buffer.pop()[1] : "";
          n2 = css.charCodeAt(pos + 1);
          if (prev === "url" && n2 !== SINGLE_QUOTE && n2 !== DOUBLE_QUOTE && n2 !== SPACE && n2 !== NEWLINE && n2 !== TAB && n2 !== FEED && n2 !== CR) {
            next = pos;
            do {
              escaped = false;
              next = css.indexOf(")", next + 1);
              if (next === -1) {
                if (ignore || ignoreUnclosed) {
                  next = pos;
                  break;
                } else {
                  unclosed("bracket");
                }
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped);
            currentToken = ["brackets", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            next = css.indexOf(")", pos + 1);
            content = css.slice(pos, next + 1);
            if (next === -1 || RE_BAD_BRACKET.test(content)) {
              currentToken = ["(", "(", pos];
            } else {
              currentToken = ["brackets", content, pos, next];
              pos = next;
            }
          }
          break;
        }
        case SINGLE_QUOTE:
        case DOUBLE_QUOTE: {
          quote = code === SINGLE_QUOTE ? "'" : '"';
          next = pos;
          do {
            escaped = false;
            next = css.indexOf(quote, next + 1);
            if (next === -1) {
              if (ignore || ignoreUnclosed) {
                next = pos + 1;
                break;
              } else {
                unclosed("string");
              }
            }
            escapePos = next;
            while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
              escapePos -= 1;
              escaped = !escaped;
            }
          } while (escaped);
          currentToken = ["string", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case AT: {
          RE_AT_END.lastIndex = pos + 1;
          RE_AT_END.test(css);
          if (RE_AT_END.lastIndex === 0) {
            next = css.length - 1;
          } else {
            next = RE_AT_END.lastIndex - 2;
          }
          currentToken = ["at-word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        case BACKSLASH: {
          next = pos;
          escape = true;
          while (css.charCodeAt(next + 1) === BACKSLASH) {
            next += 1;
            escape = !escape;
          }
          code = css.charCodeAt(next + 1);
          if (escape && code !== SLASH && code !== SPACE && code !== NEWLINE && code !== TAB && code !== CR && code !== FEED) {
            next += 1;
            if (RE_HEX_ESCAPE.test(css.charAt(next))) {
              while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
                next += 1;
              }
              if (css.charCodeAt(next + 1) === SPACE) {
                next += 1;
              }
            }
          }
          currentToken = ["word", css.slice(pos, next + 1), pos, next];
          pos = next;
          break;
        }
        default: {
          if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
            next = css.indexOf("*/", pos + 2) + 1;
            if (next === 0) {
              if (ignore || ignoreUnclosed) {
                next = css.length;
              } else {
                unclosed("comment");
              }
            }
            currentToken = ["comment", css.slice(pos, next + 1), pos, next];
            pos = next;
          } else {
            RE_WORD_END.lastIndex = pos + 1;
            RE_WORD_END.test(css);
            if (RE_WORD_END.lastIndex === 0) {
              next = css.length - 1;
            } else {
              next = RE_WORD_END.lastIndex - 2;
            }
            currentToken = ["word", css.slice(pos, next + 1), pos, next];
            buffer.push(currentToken);
            pos = next;
          }
          break;
        }
      }
      pos++;
      return currentToken;
    }
    function back(token) {
      returned.push(token);
    }
    return {
      back,
      endOfFile,
      nextToken,
      position
    };
  };
  var Container$5 = container;
  var AtRule$3 = class AtRule2 extends Container$5 {
    constructor(defaults) {
      super(defaults);
      this.type = "atrule";
    }
    append(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.append(...children);
    }
    prepend(...children) {
      if (!this.proxyOf.nodes) this.nodes = [];
      return super.prepend(...children);
    }
  };
  var atRule = AtRule$3;
  AtRule$3.default = AtRule$3;
  Container$5.registerAtRule(AtRule$3);
  var Container$4 = container;
  var LazyResult$3;
  var Processor$2;
  var Root$5 = class Root2 extends Container$4 {
    constructor(defaults) {
      super(defaults);
      this.type = "root";
      if (!this.nodes) this.nodes = [];
    }
    normalize(child, sample, type) {
      let nodes = super.normalize(child);
      if (sample) {
        if (type === "prepend") {
          if (this.nodes.length > 1) {
            sample.raws.before = this.nodes[1].raws.before;
          } else {
            delete sample.raws.before;
          }
        } else if (this.first !== sample) {
          for (let node2 of nodes) {
            node2.raws.before = sample.raws.before;
          }
        }
      }
      return nodes;
    }
    removeChild(child, ignore) {
      let index2 = this.index(child);
      if (!ignore && index2 === 0 && this.nodes.length > 1) {
        this.nodes[1].raws.before = this.nodes[index2].raws.before;
      }
      return super.removeChild(child);
    }
    toResult(opts = {}) {
      let lazy = new LazyResult$3(new Processor$2(), this, opts);
      return lazy.stringify();
    }
  };
  Root$5.registerLazyResult = (dependant) => {
    LazyResult$3 = dependant;
  };
  Root$5.registerProcessor = (dependant) => {
    Processor$2 = dependant;
  };
  var root = Root$5;
  Root$5.default = Root$5;
  Container$4.registerRoot(Root$5);
  var list$2 = {
    comma(string) {
      return list$2.split(string, [","], true);
    },
    space(string) {
      let spaces = [" ", "\n", "	"];
      return list$2.split(string, spaces);
    },
    split(string, separators, last) {
      let array = [];
      let current = "";
      let split = false;
      let func = 0;
      let inQuote = false;
      let prevQuote = "";
      let escape = false;
      for (let letter of string) {
        if (escape) {
          escape = false;
        } else if (letter === "\\") {
          escape = true;
        } else if (inQuote) {
          if (letter === prevQuote) {
            inQuote = false;
          }
        } else if (letter === '"' || letter === "'") {
          inQuote = true;
          prevQuote = letter;
        } else if (letter === "(") {
          func += 1;
        } else if (letter === ")") {
          if (func > 0) func -= 1;
        } else if (func === 0) {
          if (separators.includes(letter)) split = true;
        }
        if (split) {
          if (current !== "") array.push(current.trim());
          current = "";
          split = false;
        } else {
          current += letter;
        }
      }
      if (last || current !== "") array.push(current.trim());
      return array;
    }
  };
  var list_1 = list$2;
  list$2.default = list$2;
  var Container$3 = container;
  var list$1 = list_1;
  var Rule$3 = class Rule2 extends Container$3 {
    constructor(defaults) {
      super(defaults);
      this.type = "rule";
      if (!this.nodes) this.nodes = [];
    }
    get selectors() {
      return list$1.comma(this.selector);
    }
    set selectors(values) {
      let match = this.selector ? this.selector.match(/,\s*/) : null;
      let sep2 = match ? match[0] : "," + this.raw("between", "beforeOpen");
      this.selector = values.join(sep2);
    }
  };
  var rule = Rule$3;
  Rule$3.default = Rule$3;
  Container$3.registerRule(Rule$3);
  var Declaration$2 = declaration;
  var tokenizer22 = tokenize;
  var Comment$2 = comment;
  var AtRule$2 = atRule;
  var Root$4 = root;
  var Rule$2 = rule;
  var SAFE_COMMENT_NEIGHBOR = {
    empty: true,
    space: true
  };
  function findLastWithPosition(tokens) {
    for (let i2 = tokens.length - 1; i2 >= 0; i2--) {
      let token = tokens[i2];
      let pos = token[3] || token[2];
      if (pos) return pos;
    }
  }
  var Parser$1 = class Parser2 {
    constructor(input2) {
      this.input = input2;
      this.root = new Root$4();
      this.current = this.root;
      this.spaces = "";
      this.semicolon = false;
      this.createTokenizer();
      this.root.source = { input: input2, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(token) {
      let node2 = new AtRule$2();
      node2.name = token[1].slice(1);
      if (node2.name === "") {
        this.unnamedAtrule(node2, token);
      }
      this.init(node2, token[2]);
      let type;
      let prev;
      let shift;
      let last = false;
      let open = false;
      let params = [];
      let brackets = [];
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        type = token[0];
        if (type === "(" || type === "[") {
          brackets.push(type === "(" ? ")" : "]");
        } else if (type === "{" && brackets.length > 0) {
          brackets.push("}");
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
        }
        if (brackets.length === 0) {
          if (type === ";") {
            node2.source.end = this.getPosition(token[2]);
            node2.source.end.offset++;
            this.semicolon = true;
            break;
          } else if (type === "{") {
            open = true;
            break;
          } else if (type === "}") {
            if (params.length > 0) {
              shift = params.length - 1;
              prev = params[shift];
              while (prev && prev[0] === "space") {
                prev = params[--shift];
              }
              if (prev) {
                node2.source.end = this.getPosition(prev[3] || prev[2]);
                node2.source.end.offset++;
              }
            }
            this.end(token);
            break;
          } else {
            params.push(token);
          }
        } else {
          params.push(token);
        }
        if (this.tokenizer.endOfFile()) {
          last = true;
          break;
        }
      }
      node2.raws.between = this.spacesAndCommentsFromEnd(params);
      if (params.length) {
        node2.raws.afterName = this.spacesAndCommentsFromStart(params);
        this.raw(node2, "params", params);
        if (last) {
          token = params[params.length - 1];
          node2.source.end = this.getPosition(token[3] || token[2]);
          node2.source.end.offset++;
          this.spaces = node2.raws.between;
          node2.raws.between = "";
        }
      } else {
        node2.raws.afterName = "";
        node2.params = "";
      }
      if (open) {
        node2.nodes = [];
        this.current = node2;
      }
    }
    checkMissedSemicolon(tokens) {
      let colon = this.colon(tokens);
      if (colon === false) return;
      let founded = 0;
      let token;
      for (let j = colon - 1; j >= 0; j--) {
        token = tokens[j];
        if (token[0] !== "space") {
          founded += 1;
          if (founded === 2) break;
        }
      }
      throw this.input.error(
        "Missed semicolon",
        token[0] === "word" ? token[3] + 1 : token[2]
      );
    }
    colon(tokens) {
      let brackets = 0;
      let token, type, prev;
      for (let [i2, element] of tokens.entries()) {
        token = element;
        type = token[0];
        if (type === "(") {
          brackets += 1;
        }
        if (type === ")") {
          brackets -= 1;
        }
        if (brackets === 0 && type === ":") {
          if (!prev) {
            this.doubleColon(token);
          } else if (prev[0] === "word" && prev[1] === "progid") {
            continue;
          } else {
            return i2;
          }
        }
        prev = token;
      }
      return false;
    }
    comment(token) {
      let node2 = new Comment$2();
      this.init(node2, token[2]);
      node2.source.end = this.getPosition(token[3] || token[2]);
      node2.source.end.offset++;
      let text = token[1].slice(2, -2);
      if (/^\s*$/.test(text)) {
        node2.text = "";
        node2.raws.left = text;
        node2.raws.right = "";
      } else {
        let match = text.match(/^(\s*)([^]*\S)(\s*)$/);
        node2.text = match[2];
        node2.raws.left = match[1];
        node2.raws.right = match[3];
      }
    }
    createTokenizer() {
      this.tokenizer = tokenizer22(this.input);
    }
    decl(tokens, customProperty) {
      let node2 = new Declaration$2();
      this.init(node2, tokens[0][2]);
      let last = tokens[tokens.length - 1];
      if (last[0] === ";") {
        this.semicolon = true;
        tokens.pop();
      }
      node2.source.end = this.getPosition(
        last[3] || last[2] || findLastWithPosition(tokens)
      );
      node2.source.end.offset++;
      while (tokens[0][0] !== "word") {
        if (tokens.length === 1) this.unknownWord(tokens);
        node2.raws.before += tokens.shift()[1];
      }
      node2.source.start = this.getPosition(tokens[0][2]);
      node2.prop = "";
      while (tokens.length) {
        let type = tokens[0][0];
        if (type === ":" || type === "space" || type === "comment") {
          break;
        }
        node2.prop += tokens.shift()[1];
      }
      node2.raws.between = "";
      let token;
      while (tokens.length) {
        token = tokens.shift();
        if (token[0] === ":") {
          node2.raws.between += token[1];
          break;
        } else {
          if (token[0] === "word" && /\w/.test(token[1])) {
            this.unknownWord([token]);
          }
          node2.raws.between += token[1];
        }
      }
      if (node2.prop[0] === "_" || node2.prop[0] === "*") {
        node2.raws.before += node2.prop[0];
        node2.prop = node2.prop.slice(1);
      }
      let firstSpaces = [];
      let next;
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        firstSpaces.push(tokens.shift());
      }
      this.precheckMissedSemicolon(tokens);
      for (let i2 = tokens.length - 1; i2 >= 0; i2--) {
        token = tokens[i2];
        if (token[1].toLowerCase() === "!important") {
          node2.important = true;
          let string = this.stringFrom(tokens, i2);
          string = this.spacesFromEnd(tokens) + string;
          if (string !== " !important") node2.raws.important = string;
          break;
        } else if (token[1].toLowerCase() === "important") {
          let cache = tokens.slice(0);
          let str = "";
          for (let j = i2; j > 0; j--) {
            let type = cache[j][0];
            if (str.trim().indexOf("!") === 0 && type !== "space") {
              break;
            }
            str = cache.pop()[1] + str;
          }
          if (str.trim().indexOf("!") === 0) {
            node2.important = true;
            node2.raws.important = str;
            tokens = cache;
          }
        }
        if (token[0] !== "space" && token[0] !== "comment") {
          break;
        }
      }
      let hasWord = tokens.some((i2) => i2[0] !== "space" && i2[0] !== "comment");
      if (hasWord) {
        node2.raws.between += firstSpaces.map((i2) => i2[1]).join("");
        firstSpaces = [];
      }
      this.raw(node2, "value", firstSpaces.concat(tokens), customProperty);
      if (node2.value.includes(":") && !customProperty) {
        this.checkMissedSemicolon(tokens);
      }
    }
    doubleColon(token) {
      throw this.input.error(
        "Double colon",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
    emptyRule(token) {
      let node2 = new Rule$2();
      this.init(node2, token[2]);
      node2.selector = "";
      node2.raws.between = "";
      this.current = node2;
    }
    end(token) {
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.semicolon = false;
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.spaces = "";
      if (this.current.parent) {
        this.current.source.end = this.getPosition(token[2]);
        this.current.source.end.offset++;
        this.current = this.current.parent;
      } else {
        this.unexpectedClose(token);
      }
    }
    endFile() {
      if (this.current.parent) this.unclosedBlock();
      if (this.current.nodes && this.current.nodes.length) {
        this.current.raws.semicolon = this.semicolon;
      }
      this.current.raws.after = (this.current.raws.after || "") + this.spaces;
      this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(token) {
      this.spaces += token[1];
      if (this.current.nodes) {
        let prev = this.current.nodes[this.current.nodes.length - 1];
        if (prev && prev.type === "rule" && !prev.raws.ownSemicolon) {
          prev.raws.ownSemicolon = this.spaces;
          this.spaces = "";
        }
      }
    }
    // Helpers
    getPosition(offset) {
      let pos = this.input.fromOffset(offset);
      return {
        column: pos.col,
        line: pos.line,
        offset
      };
    }
    init(node2, offset) {
      this.current.push(node2);
      node2.source = {
        input: this.input,
        start: this.getPosition(offset)
      };
      node2.raws.before = this.spaces;
      this.spaces = "";
      if (node2.type !== "comment") this.semicolon = false;
    }
    other(start) {
      let end = false;
      let type = null;
      let colon = false;
      let bracket = null;
      let brackets = [];
      let customProperty = start[1].startsWith("--");
      let tokens = [];
      let token = start;
      while (token) {
        type = token[0];
        tokens.push(token);
        if (type === "(" || type === "[") {
          if (!bracket) bracket = token;
          brackets.push(type === "(" ? ")" : "]");
        } else if (customProperty && colon && type === "{") {
          if (!bracket) bracket = token;
          brackets.push("}");
        } else if (brackets.length === 0) {
          if (type === ";") {
            if (colon) {
              this.decl(tokens, customProperty);
              return;
            } else {
              break;
            }
          } else if (type === "{") {
            this.rule(tokens);
            return;
          } else if (type === "}") {
            this.tokenizer.back(tokens.pop());
            end = true;
            break;
          } else if (type === ":") {
            colon = true;
          }
        } else if (type === brackets[brackets.length - 1]) {
          brackets.pop();
          if (brackets.length === 0) bracket = null;
        }
        token = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile()) end = true;
      if (brackets.length > 0) this.unclosedBracket(bracket);
      if (end && colon) {
        if (!customProperty) {
          while (tokens.length) {
            token = tokens[tokens.length - 1][0];
            if (token !== "space" && token !== "comment") break;
            this.tokenizer.back(tokens.pop());
          }
        }
        this.decl(tokens, customProperty);
      } else {
        this.unknownWord(tokens);
      }
    }
    parse() {
      let token;
      while (!this.tokenizer.endOfFile()) {
        token = this.tokenizer.nextToken();
        switch (token[0]) {
          case "space":
            this.spaces += token[1];
            break;
          case ";":
            this.freeSemicolon(token);
            break;
          case "}":
            this.end(token);
            break;
          case "comment":
            this.comment(token);
            break;
          case "at-word":
            this.atrule(token);
            break;
          case "{":
            this.emptyRule(token);
            break;
          default:
            this.other(token);
            break;
        }
      }
      this.endFile();
    }
    precheckMissedSemicolon() {
    }
    raw(node2, prop, tokens, customProperty) {
      let token, type;
      let length = tokens.length;
      let value = "";
      let clean = true;
      let next, prev;
      for (let i2 = 0; i2 < length; i2 += 1) {
        token = tokens[i2];
        type = token[0];
        if (type === "space" && i2 === length - 1 && !customProperty) {
          clean = false;
        } else if (type === "comment") {
          prev = tokens[i2 - 1] ? tokens[i2 - 1][0] : "empty";
          next = tokens[i2 + 1] ? tokens[i2 + 1][0] : "empty";
          if (!SAFE_COMMENT_NEIGHBOR[prev] && !SAFE_COMMENT_NEIGHBOR[next]) {
            if (value.slice(-1) === ",") {
              clean = false;
            } else {
              value += token[1];
            }
          } else {
            clean = false;
          }
        } else {
          value += token[1];
        }
      }
      if (!clean) {
        let raw = tokens.reduce((all, i2) => all + i2[1], "");
        node2.raws[prop] = { raw, value };
      }
      node2[prop] = value;
    }
    rule(tokens) {
      tokens.pop();
      let node2 = new Rule$2();
      this.init(node2, tokens[0][2]);
      node2.raws.between = this.spacesAndCommentsFromEnd(tokens);
      this.raw(node2, "selector", tokens);
      this.current = node2;
    }
    spacesAndCommentsFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space" && lastTokenType !== "comment") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    // Errors
    spacesAndCommentsFromStart(tokens) {
      let next;
      let spaces = "";
      while (tokens.length) {
        next = tokens[0][0];
        if (next !== "space" && next !== "comment") break;
        spaces += tokens.shift()[1];
      }
      return spaces;
    }
    spacesFromEnd(tokens) {
      let lastTokenType;
      let spaces = "";
      while (tokens.length) {
        lastTokenType = tokens[tokens.length - 1][0];
        if (lastTokenType !== "space") break;
        spaces = tokens.pop()[1] + spaces;
      }
      return spaces;
    }
    stringFrom(tokens, from) {
      let result2 = "";
      for (let i2 = from; i2 < tokens.length; i2++) {
        result2 += tokens[i2][1];
      }
      tokens.splice(from, tokens.length - from);
      return result2;
    }
    unclosedBlock() {
      let pos = this.current.source.start;
      throw this.input.error("Unclosed block", pos.line, pos.column);
    }
    unclosedBracket(bracket) {
      throw this.input.error(
        "Unclosed bracket",
        { offset: bracket[2] },
        { offset: bracket[2] + 1 }
      );
    }
    unexpectedClose(token) {
      throw this.input.error(
        "Unexpected }",
        { offset: token[2] },
        { offset: token[2] + 1 }
      );
    }
    unknownWord(tokens) {
      throw this.input.error(
        "Unknown word",
        { offset: tokens[0][2] },
        { offset: tokens[0][2] + tokens[0][1].length }
      );
    }
    unnamedAtrule(node2, token) {
      throw this.input.error(
        "At-rule without name",
        { offset: token[2] },
        { offset: token[2] + token[1].length }
      );
    }
  };
  var parser = Parser$1;
  var Container$2 = container;
  var Parser22 = parser;
  var Input$2 = input;
  function parse$3(css, opts) {
    let input2 = new Input$2(css, opts);
    let parser2 = new Parser22(input2);
    try {
      parser2.parse();
    } catch (e2) {
      if (false) {
        if (e2.name === "CssSyntaxError" && opts && opts.from) {
          if (/\.scss$/i.test(opts.from)) {
            e2.message += "\nYou tried to parse SCSS with the standard CSS parser; try again with the postcss-scss parser";
          } else if (/\.sass/i.test(opts.from)) {
            e2.message += "\nYou tried to parse Sass with the standard CSS parser; try again with the postcss-sass parser";
          } else if (/\.less$/i.test(opts.from)) {
            e2.message += "\nYou tried to parse Less with the standard CSS parser; try again with the postcss-less parser";
          }
        }
      }
      throw e2;
    }
    return parser2.root;
  }
  var parse_1 = parse$3;
  parse$3.default = parse$3;
  Container$2.registerParse(parse$3);
  var { isClean, my } = symbols;
  var MapGenerator$1 = mapGenerator;
  var stringify$2 = stringify_1;
  var Container$1 = container;
  var Document$2 = document$1;
  var Result$2 = result;
  var parse$2 = parse_1;
  var Root$3 = root;
  var TYPE_TO_CLASS_NAME = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  };
  var PLUGIN_PROPS = {
    AtRule: true,
    AtRuleExit: true,
    Comment: true,
    CommentExit: true,
    Declaration: true,
    DeclarationExit: true,
    Document: true,
    DocumentExit: true,
    Once: true,
    OnceExit: true,
    postcssPlugin: true,
    prepare: true,
    Root: true,
    RootExit: true,
    Rule: true,
    RuleExit: true
  };
  var NOT_VISITORS = {
    Once: true,
    postcssPlugin: true,
    prepare: true
  };
  var CHILDREN = 0;
  function isPromise(obj) {
    return typeof obj === "object" && typeof obj.then === "function";
  }
  function getEvents(node2) {
    let key = false;
    let type = TYPE_TO_CLASS_NAME[node2.type];
    if (node2.type === "decl") {
      key = node2.prop.toLowerCase();
    } else if (node2.type === "atrule") {
      key = node2.name.toLowerCase();
    }
    if (key && node2.append) {
      return [
        type,
        type + "-" + key,
        CHILDREN,
        type + "Exit",
        type + "Exit-" + key
      ];
    } else if (key) {
      return [type, type + "-" + key, type + "Exit", type + "Exit-" + key];
    } else if (node2.append) {
      return [type, CHILDREN, type + "Exit"];
    } else {
      return [type, type + "Exit"];
    }
  }
  function toStack(node2) {
    let events;
    if (node2.type === "document") {
      events = ["Document", CHILDREN, "DocumentExit"];
    } else if (node2.type === "root") {
      events = ["Root", CHILDREN, "RootExit"];
    } else {
      events = getEvents(node2);
    }
    return {
      eventIndex: 0,
      events,
      iterator: 0,
      node: node2,
      visitorIndex: 0,
      visitors: []
    };
  }
  function cleanMarks(node2) {
    node2[isClean] = false;
    if (node2.nodes) node2.nodes.forEach((i2) => cleanMarks(i2));
    return node2;
  }
  var postcss$2 = {};
  var LazyResult$2 = class LazyResult2 {
    constructor(processor2, css, opts) {
      this.stringified = false;
      this.processed = false;
      let root2;
      if (typeof css === "object" && css !== null && (css.type === "root" || css.type === "document")) {
        root2 = cleanMarks(css);
      } else if (css instanceof LazyResult2 || css instanceof Result$2) {
        root2 = cleanMarks(css.root);
        if (css.map) {
          if (typeof opts.map === "undefined") opts.map = {};
          if (!opts.map.inline) opts.map.inline = false;
          opts.map.prev = css.map;
        }
      } else {
        let parser2 = parse$2;
        if (opts.syntax) parser2 = opts.syntax.parse;
        if (opts.parser) parser2 = opts.parser;
        if (parser2.parse) parser2 = parser2.parse;
        try {
          root2 = parser2(css, opts);
        } catch (error) {
          this.processed = true;
          this.error = error;
        }
        if (root2 && !root2[my]) {
          Container$1.rebuild(root2);
        }
      }
      this.result = new Result$2(processor2, root2, opts);
      this.helpers = { ...postcss$2, postcss: postcss$2, result: this.result };
      this.plugins = this.processor.plugins.map((plugin22) => {
        if (typeof plugin22 === "object" && plugin22.prepare) {
          return { ...plugin22, ...plugin22.prepare(this.result) };
        } else {
          return plugin22;
        }
      });
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      if (this.processed) return Promise.resolve(this.result);
      if (!this.processing) {
        this.processing = this.runAsync();
      }
      return this.processing;
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(error, node2) {
      let plugin22 = this.result.lastPlugin;
      try {
        if (node2) node2.addToError(error);
        this.error = error;
        if (error.name === "CssSyntaxError" && !error.plugin) {
          error.plugin = plugin22.postcssPlugin;
          error.setMessage();
        } else if (plugin22.postcssVersion) {
          if (false) {
            let pluginName = plugin22.postcssPlugin;
            let pluginVer = plugin22.postcssVersion;
            let runtimeVer = this.result.processor.version;
            let a2 = pluginVer.split(".");
            let b = runtimeVer.split(".");
            if (a2[0] !== b[0] || parseInt(a2[1]) > parseInt(b[1])) {
              console.error(
                "Unknown error from PostCSS plugin. Your current PostCSS version is " + runtimeVer + ", but " + pluginName + " uses " + pluginVer + ". Perhaps this is the source of the error below."
              );
            }
          }
        }
      } catch (err2) {
        if (console && console.error) console.error(err2);
      }
      return error;
    }
    prepareVisitors() {
      this.listeners = {};
      let add = (plugin22, type, cb) => {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push([plugin22, cb]);
      };
      for (let plugin22 of this.plugins) {
        if (typeof plugin22 === "object") {
          for (let event in plugin22) {
            if (!PLUGIN_PROPS[event] && /^[A-Z]/.test(event)) {
              throw new Error(
                `Unknown event ${event} in ${plugin22.postcssPlugin}. Try to update PostCSS (${this.processor.version} now).`
              );
            }
            if (!NOT_VISITORS[event]) {
              if (typeof plugin22[event] === "object") {
                for (let filter in plugin22[event]) {
                  if (filter === "*") {
                    add(plugin22, event, plugin22[event][filter]);
                  } else {
                    add(
                      plugin22,
                      event + "-" + filter.toLowerCase(),
                      plugin22[event][filter]
                    );
                  }
                }
              } else if (typeof plugin22[event] === "function") {
                add(plugin22, event, plugin22[event]);
              }
            }
          }
        }
      }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let i2 = 0; i2 < this.plugins.length; i2++) {
        let plugin22 = this.plugins[i2];
        let promise = this.runOnRoot(plugin22);
        if (isPromise(promise)) {
          try {
            await promise;
          } catch (error) {
            throw this.handleError(error);
          }
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean]) {
          root2[isClean] = true;
          let stack = [toStack(root2)];
          while (stack.length > 0) {
            let promise = this.visitTick(stack);
            if (isPromise(promise)) {
              try {
                await promise;
              } catch (e2) {
                let node2 = stack[stack.length - 1].node;
                throw this.handleError(e2, node2);
              }
            }
          }
        }
        if (this.listeners.OnceExit) {
          for (let [plugin22, visitor] of this.listeners.OnceExit) {
            this.result.lastPlugin = plugin22;
            try {
              if (root2.type === "document") {
                let roots = root2.nodes.map(
                  (subRoot) => visitor(subRoot, this.helpers)
                );
                await Promise.all(roots);
              } else {
                await visitor(root2, this.helpers);
              }
            } catch (e2) {
              throw this.handleError(e2);
            }
          }
        }
      }
      this.processed = true;
      return this.stringify();
    }
    runOnRoot(plugin22) {
      this.result.lastPlugin = plugin22;
      try {
        if (typeof plugin22 === "object" && plugin22.Once) {
          if (this.result.root.type === "document") {
            let roots = this.result.root.nodes.map(
              (root2) => plugin22.Once(root2, this.helpers)
            );
            if (isPromise(roots[0])) {
              return Promise.all(roots);
            }
            return roots;
          }
          return plugin22.Once(this.result.root, this.helpers);
        } else if (typeof plugin22 === "function") {
          return plugin22(this.result.root, this.result);
        }
      } catch (error) {
        throw this.handleError(error);
      }
    }
    stringify() {
      if (this.error) throw this.error;
      if (this.stringified) return this.result;
      this.stringified = true;
      this.sync();
      let opts = this.result.opts;
      let str = stringify$2;
      if (opts.syntax) str = opts.syntax.stringify;
      if (opts.stringifier) str = opts.stringifier;
      if (str.stringify) str = str.stringify;
      let map = new MapGenerator$1(str, this.result.root, this.result.opts);
      let data = map.generate();
      this.result.css = data[0];
      this.result.map = data[1];
      return this.result;
    }
    sync() {
      if (this.error) throw this.error;
      if (this.processed) return this.result;
      this.processed = true;
      if (this.processing) {
        throw this.getAsyncError();
      }
      for (let plugin22 of this.plugins) {
        let promise = this.runOnRoot(plugin22);
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
      this.prepareVisitors();
      if (this.hasListener) {
        let root2 = this.result.root;
        while (!root2[isClean]) {
          root2[isClean] = true;
          this.walkSync(root2);
        }
        if (this.listeners.OnceExit) {
          if (root2.type === "document") {
            for (let subRoot of root2.nodes) {
              this.visitSync(this.listeners.OnceExit, subRoot);
            }
          } else {
            this.visitSync(this.listeners.OnceExit, root2);
          }
        }
      }
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (false) {
        if (!("from" in this.opts)) {
          warnOnce$1(
            "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
          );
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this.css;
    }
    visitSync(visitors, node2) {
      for (let [plugin22, visitor] of visitors) {
        this.result.lastPlugin = plugin22;
        let promise;
        try {
          promise = visitor(node2, this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2.proxyOf);
        }
        if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
          return true;
        }
        if (isPromise(promise)) {
          throw this.getAsyncError();
        }
      }
    }
    visitTick(stack) {
      let visit2 = stack[stack.length - 1];
      let { node: node2, visitors } = visit2;
      if (node2.type !== "root" && node2.type !== "document" && !node2.parent) {
        stack.pop();
        return;
      }
      if (visitors.length > 0 && visit2.visitorIndex < visitors.length) {
        let [plugin22, visitor] = visitors[visit2.visitorIndex];
        visit2.visitorIndex += 1;
        if (visit2.visitorIndex === visitors.length) {
          visit2.visitors = [];
          visit2.visitorIndex = 0;
        }
        this.result.lastPlugin = plugin22;
        try {
          return visitor(node2.toProxy(), this.helpers);
        } catch (e2) {
          throw this.handleError(e2, node2);
        }
      }
      if (visit2.iterator !== 0) {
        let iterator = visit2.iterator;
        let child;
        while (child = node2.nodes[node2.indexes[iterator]]) {
          node2.indexes[iterator] += 1;
          if (!child[isClean]) {
            child[isClean] = true;
            stack.push(toStack(child));
            return;
          }
        }
        visit2.iterator = 0;
        delete node2.indexes[iterator];
      }
      let events = visit2.events;
      while (visit2.eventIndex < events.length) {
        let event = events[visit2.eventIndex];
        visit2.eventIndex += 1;
        if (event === CHILDREN) {
          if (node2.nodes && node2.nodes.length) {
            node2[isClean] = true;
            visit2.iterator = node2.getIterator();
          }
          return;
        } else if (this.listeners[event]) {
          visit2.visitors = this.listeners[event];
          return;
        }
      }
      stack.pop();
    }
    walkSync(node2) {
      node2[isClean] = true;
      let events = getEvents(node2);
      for (let event of events) {
        if (event === CHILDREN) {
          if (node2.nodes) {
            node2.each((child) => {
              if (!child[isClean]) this.walkSync(child);
            });
          }
        } else {
          let visitors = this.listeners[event];
          if (visitors) {
            if (this.visitSync(visitors, node2.toProxy())) return;
          }
        }
      }
    }
    warnings() {
      return this.sync().warnings();
    }
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
  };
  LazyResult$2.registerPostcss = (dependant) => {
    postcss$2 = dependant;
  };
  var lazyResult = LazyResult$2;
  LazyResult$2.default = LazyResult$2;
  Root$3.registerLazyResult(LazyResult$2);
  Document$2.registerLazyResult(LazyResult$2);
  var MapGenerator22 = mapGenerator;
  var stringify$1 = stringify_1;
  var parse$1 = parse_1;
  var Result$1 = result;
  var NoWorkResult$1 = class NoWorkResult2 {
    constructor(processor2, css, opts) {
      css = css.toString();
      this.stringified = false;
      this._processor = processor2;
      this._css = css;
      this._opts = opts;
      this._map = void 0;
      let root2;
      let str = stringify$1;
      this.result = new Result$1(this._processor, root2, this._opts);
      this.result.css = css;
      let self = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return self.root;
        }
      });
      let map = new MapGenerator22(str, root2, this._opts, css);
      if (map.isMap()) {
        let [generatedCSS, generatedMap] = map.generate();
        if (generatedCSS) {
          this.result.css = generatedCSS;
        }
        if (generatedMap) {
          this.result.map = generatedMap;
        }
      } else {
        map.clearAnnotation();
        this.result.css = map.css;
      }
    }
    async() {
      if (this.error) return Promise.reject(this.error);
      return Promise.resolve(this.result);
    }
    catch(onRejected) {
      return this.async().catch(onRejected);
    }
    finally(onFinally) {
      return this.async().then(onFinally, onFinally);
    }
    sync() {
      if (this.error) throw this.error;
      return this.result;
    }
    then(onFulfilled, onRejected) {
      if (false) {
        if (!("from" in this._opts)) {
          warnOnce22(
            "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
          );
        }
      }
      return this.async().then(onFulfilled, onRejected);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root) {
        return this._root;
      }
      let root2;
      let parser2 = parse$1;
      try {
        root2 = parser2(this._css, this._opts);
      } catch (error) {
        this.error = error;
      }
      if (this.error) {
        throw this.error;
      } else {
        this._root = root2;
        return root2;
      }
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
  };
  var noWorkResult = NoWorkResult$1;
  NoWorkResult$1.default = NoWorkResult$1;
  var NoWorkResult22 = noWorkResult;
  var LazyResult$1 = lazyResult;
  var Document$1 = document$1;
  var Root$2 = root;
  var Processor$1 = class Processor2 {
    constructor(plugins = []) {
      this.version = "8.4.38";
      this.plugins = this.normalize(plugins);
    }
    normalize(plugins) {
      let normalized = [];
      for (let i2 of plugins) {
        if (i2.postcss === true) {
          i2 = i2();
        } else if (i2.postcss) {
          i2 = i2.postcss;
        }
        if (typeof i2 === "object" && Array.isArray(i2.plugins)) {
          normalized = normalized.concat(i2.plugins);
        } else if (typeof i2 === "object" && i2.postcssPlugin) {
          normalized.push(i2);
        } else if (typeof i2 === "function") {
          normalized.push(i2);
        } else if (typeof i2 === "object" && (i2.parse || i2.stringify)) {
          if (false) {
            throw new Error(
              "PostCSS syntaxes cannot be used as plugins. Instead, please use one of the syntax/parser/stringifier options as outlined in your PostCSS runner documentation."
            );
          }
        } else {
          throw new Error(i2 + " is not a PostCSS plugin");
        }
      }
      return normalized;
    }
    process(css, opts = {}) {
      if (!this.plugins.length && !opts.parser && !opts.stringifier && !opts.syntax) {
        return new NoWorkResult22(this, css, opts);
      } else {
        return new LazyResult$1(this, css, opts);
      }
    }
    use(plugin22) {
      this.plugins = this.plugins.concat(this.normalize([plugin22]));
      return this;
    }
  };
  var processor = Processor$1;
  Processor$1.default = Processor$1;
  Root$2.registerProcessor(Processor$1);
  Document$1.registerProcessor(Processor$1);
  var Declaration$1 = declaration;
  var PreviousMap22 = previousMap;
  var Comment$1 = comment;
  var AtRule$1 = atRule;
  var Input$1 = input;
  var Root$1 = root;
  var Rule$1 = rule;
  function fromJSON$1(json, inputs) {
    if (Array.isArray(json)) return json.map((n2) => fromJSON$1(n2));
    let { inputs: ownInputs, ...defaults } = json;
    if (ownInputs) {
      inputs = [];
      for (let input2 of ownInputs) {
        let inputHydrated = { ...input2, __proto__: Input$1.prototype };
        if (inputHydrated.map) {
          inputHydrated.map = {
            ...inputHydrated.map,
            __proto__: PreviousMap22.prototype
          };
        }
        inputs.push(inputHydrated);
      }
    }
    if (defaults.nodes) {
      defaults.nodes = json.nodes.map((n2) => fromJSON$1(n2, inputs));
    }
    if (defaults.source) {
      let { inputId, ...source } = defaults.source;
      defaults.source = source;
      if (inputId != null) {
        defaults.source.input = inputs[inputId];
      }
    }
    if (defaults.type === "root") {
      return new Root$1(defaults);
    } else if (defaults.type === "decl") {
      return new Declaration$1(defaults);
    } else if (defaults.type === "rule") {
      return new Rule$1(defaults);
    } else if (defaults.type === "comment") {
      return new Comment$1(defaults);
    } else if (defaults.type === "atrule") {
      return new AtRule$1(defaults);
    } else {
      throw new Error("Unknown node type: " + json.type);
    }
  }
  var fromJSON_1 = fromJSON$1;
  fromJSON$1.default = fromJSON$1;
  var CssSyntaxError22 = cssSyntaxError;
  var Declaration22 = declaration;
  var LazyResult22 = lazyResult;
  var Container22 = container;
  var Processor22 = processor;
  var stringify = stringify_1;
  var fromJSON = fromJSON_1;
  var Document222 = document$1;
  var Warning22 = warning;
  var Comment22 = comment;
  var AtRule22 = atRule;
  var Result22 = result;
  var Input22 = input;
  var parse = parse_1;
  var list = list_1;
  var Rule22 = rule;
  var Root22 = root;
  var Node22 = node;
  function postcss(...plugins) {
    if (plugins.length === 1 && Array.isArray(plugins[0])) {
      plugins = plugins[0];
    }
    return new Processor22(plugins);
  }
  postcss.plugin = function plugin2(name, initializer) {
    let warningPrinted = false;
    function creator(...args) {
      if (console && console.warn && !warningPrinted) {
        warningPrinted = true;
        console.warn(
          name + ": postcss.plugin was deprecated. Migration guide:\nhttps://evilmartians.com/chronicles/postcss-8-plugin-migration"
        );
        if (process.env.LANG && process.env.LANG.startsWith("cn")) {
          console.warn(
            name + ": \u91CC\u9762 postcss.plugin \u88AB\u5F03\u7528. \u8FC1\u79FB\u6307\u5357:\nhttps://www.w3ctech.com/topic/2226"
          );
        }
      }
      let transformer = initializer(...args);
      transformer.postcssPlugin = name;
      transformer.postcssVersion = new Processor22().version;
      return transformer;
    }
    let cache;
    Object.defineProperty(creator, "postcss", {
      get() {
        if (!cache) cache = creator();
        return cache;
      }
    });
    creator.process = function(css, processOpts, pluginOpts) {
      return postcss([creator(pluginOpts)]).process(css, processOpts);
    };
    return creator;
  };
  postcss.stringify = stringify;
  postcss.parse = parse;
  postcss.fromJSON = fromJSON;
  postcss.list = list;
  postcss.comment = (defaults) => new Comment22(defaults);
  postcss.atRule = (defaults) => new AtRule22(defaults);
  postcss.decl = (defaults) => new Declaration22(defaults);
  postcss.rule = (defaults) => new Rule22(defaults);
  postcss.root = (defaults) => new Root22(defaults);
  postcss.document = (defaults) => new Document222(defaults);
  postcss.CssSyntaxError = CssSyntaxError22;
  postcss.Declaration = Declaration22;
  postcss.Container = Container22;
  postcss.Processor = Processor22;
  postcss.Document = Document222;
  postcss.Comment = Comment22;
  postcss.Warning = Warning22;
  postcss.AtRule = AtRule22;
  postcss.Result = Result22;
  postcss.Input = Input22;
  postcss.Rule = Rule22;
  postcss.Root = Root22;
  postcss.Node = Node22;
  LazyResult22.registerPostcss(postcss);
  var postcss_1 = postcss;
  postcss.default = postcss;
  var postcss$1 = /* @__PURE__ */ getDefaultExportFromCjs(postcss_1);
  postcss$1.stringify;
  postcss$1.fromJSON;
  postcss$1.plugin;
  postcss$1.parse;
  postcss$1.list;
  postcss$1.document;
  postcss$1.comment;
  postcss$1.atRule;
  postcss$1.rule;
  postcss$1.decl;
  postcss$1.root;
  postcss$1.CssSyntaxError;
  postcss$1.Declaration;
  postcss$1.Container;
  postcss$1.Processor;
  postcss$1.Document;
  postcss$1.Comment;
  postcss$1.Warning;
  postcss$1.AtRule;
  postcss$1.Result;
  postcss$1.Input;
  postcss$1.Rule;
  postcss$1.Root;
  postcss$1.Node;
  var BaseRRNode = class _BaseRRNode {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    constructor(..._args) {
      __publicField2(this, "parentElement", null);
      __publicField2(this, "parentNode", null);
      __publicField2(this, "ownerDocument");
      __publicField2(this, "firstChild", null);
      __publicField2(this, "lastChild", null);
      __publicField2(this, "previousSibling", null);
      __publicField2(this, "nextSibling", null);
      __publicField2(this, "ELEMENT_NODE", 1);
      __publicField2(this, "TEXT_NODE", 3);
      __publicField2(this, "nodeType");
      __publicField2(this, "nodeName");
      __publicField2(this, "RRNodeType");
    }
    get childNodes() {
      const childNodes2 = [];
      let childIterator = this.firstChild;
      while (childIterator) {
        childNodes2.push(childIterator);
        childIterator = childIterator.nextSibling;
      }
      return childNodes2;
    }
    contains(node2) {
      if (!(node2 instanceof _BaseRRNode)) return false;
      else if (node2.ownerDocument !== this.ownerDocument) return false;
      else if (node2 === this) return true;
      while (node2.parentNode) {
        if (node2.parentNode === this) return true;
        node2 = node2.parentNode;
      }
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appendChild(_newChild) {
      throw new Error(
        `RRDomException: Failed to execute 'appendChild' on 'RRNode': This RRNode type does not support this method.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insertBefore(_newChild, _refChild) {
      throw new Error(
        `RRDomException: Failed to execute 'insertBefore' on 'RRNode': This RRNode type does not support this method.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeChild(_node) {
      throw new Error(
        `RRDomException: Failed to execute 'removeChild' on 'RRNode': This RRNode type does not support this method.`
      );
    }
    toString() {
      return "RRNode";
    }
  };
  var testableAccessors = {
    Node: [
      "childNodes",
      "parentNode",
      "parentElement",
      "textContent",
      "ownerDocument"
    ],
    ShadowRoot: ["host", "styleSheets"],
    Element: ["shadowRoot", "querySelector", "querySelectorAll"],
    MutationObserver: []
  };
  var testableMethods = {
    Node: ["contains", "getRootNode"],
    ShadowRoot: ["getSelection"],
    Element: [],
    MutationObserver: ["constructor"]
  };
  var untaintedBasePrototype = {};
  var isAngularZonePresent = () => {
    return !!globalThis.Zone;
  };
  function getUntaintedPrototype(key) {
    if (untaintedBasePrototype[key])
      return untaintedBasePrototype[key];
    const defaultObj = globalThis[key];
    const defaultPrototype = defaultObj.prototype;
    const accessorNames = key in testableAccessors ? testableAccessors[key] : void 0;
    const isUntaintedAccessors = Boolean(
      accessorNames && // @ts-expect-error 2345
      accessorNames.every(
        (accessor) => {
          var _a2, _b;
          return Boolean(
            (_b = (_a2 = Object.getOwnPropertyDescriptor(defaultPrototype, accessor)) == null ? void 0 : _a2.get) == null ? void 0 : _b.toString().includes("[native code]")
          );
        }
      )
    );
    const methodNames = key in testableMethods ? testableMethods[key] : void 0;
    const isUntaintedMethods = Boolean(
      methodNames && methodNames.every(
        // @ts-expect-error 2345
        (method) => {
          var _a2;
          return typeof defaultPrototype[method] === "function" && ((_a2 = defaultPrototype[method]) == null ? void 0 : _a2.toString().includes("[native code]"));
        }
      )
    );
    if (isUntaintedAccessors && isUntaintedMethods && !isAngularZonePresent()) {
      untaintedBasePrototype[key] = defaultObj.prototype;
      return defaultObj.prototype;
    }
    try {
      const iframeEl = document.createElement("iframe");
      document.body.appendChild(iframeEl);
      const win = iframeEl.contentWindow;
      if (!win) return defaultObj.prototype;
      const untaintedObject = win[key].prototype;
      document.body.removeChild(iframeEl);
      if (!untaintedObject) return defaultPrototype;
      return untaintedBasePrototype[key] = untaintedObject;
    } catch {
      return defaultPrototype;
    }
  }
  var untaintedAccessorCache = {};
  function getUntaintedAccessor(key, instance, accessor) {
    var _a2;
    const cacheKey = `${key}.${String(accessor)}`;
    if (untaintedAccessorCache[cacheKey])
      return untaintedAccessorCache[cacheKey].call(
        instance
      );
    const untaintedPrototype = getUntaintedPrototype(key);
    const untaintedAccessor = (_a2 = Object.getOwnPropertyDescriptor(
      untaintedPrototype,
      accessor
    )) == null ? void 0 : _a2.get;
    if (!untaintedAccessor) return instance[accessor];
    untaintedAccessorCache[cacheKey] = untaintedAccessor;
    return untaintedAccessor.call(instance);
  }
  var untaintedMethodCache = {};
  function getUntaintedMethod(key, instance, method) {
    const cacheKey = `${key}.${String(method)}`;
    if (untaintedMethodCache[cacheKey])
      return untaintedMethodCache[cacheKey].bind(
        instance
      );
    const untaintedPrototype = getUntaintedPrototype(key);
    const untaintedMethod = untaintedPrototype[method];
    if (typeof untaintedMethod !== "function") return instance[method];
    untaintedMethodCache[cacheKey] = untaintedMethod;
    return untaintedMethod.bind(instance);
  }
  function ownerDocument(n2) {
    return getUntaintedAccessor("Node", n2, "ownerDocument");
  }
  function childNodes(n2) {
    return getUntaintedAccessor("Node", n2, "childNodes");
  }
  function parentNode(n2) {
    return getUntaintedAccessor("Node", n2, "parentNode");
  }
  function parentElement(n2) {
    return getUntaintedAccessor("Node", n2, "parentElement");
  }
  function textContent(n2) {
    return getUntaintedAccessor("Node", n2, "textContent");
  }
  function contains(n2, other) {
    return getUntaintedMethod("Node", n2, "contains")(other);
  }
  function getRootNode(n2) {
    return getUntaintedMethod("Node", n2, "getRootNode")();
  }
  function host(n2) {
    if (!n2 || !("host" in n2)) return null;
    return getUntaintedAccessor("ShadowRoot", n2, "host");
  }
  function styleSheets(n2) {
    return n2.styleSheets;
  }
  function shadowRoot(n2) {
    if (!n2 || !("shadowRoot" in n2)) return null;
    return getUntaintedAccessor("Element", n2, "shadowRoot");
  }
  function querySelector(n2, selectors) {
    return getUntaintedAccessor("Element", n2, "querySelector")(selectors);
  }
  function querySelectorAll(n2, selectors) {
    return getUntaintedAccessor("Element", n2, "querySelectorAll")(selectors);
  }
  function mutationObserverCtor() {
    return getUntaintedPrototype("MutationObserver").constructor;
  }
  function patch(source, name, replacement) {
    try {
      if (!(name in source)) {
        return () => {
        };
      }
      const original = source[name];
      const wrapped = replacement(original);
      if (typeof wrapped === "function") {
        wrapped.prototype = wrapped.prototype || {};
        Object.defineProperties(wrapped, {
          __rrweb_original__: {
            enumerable: false,
            value: original
          }
        });
      }
      source[name] = wrapped;
      return () => {
        source[name] = original;
      };
    } catch {
      return () => {
      };
    }
  }
  var index = {
    ownerDocument,
    childNodes,
    parentNode,
    parentElement,
    textContent,
    contains,
    getRootNode,
    host,
    styleSheets,
    shadowRoot,
    querySelector,
    querySelectorAll,
    mutationObserver: mutationObserverCtor,
    patch
  };
  function on(type, fn, target = document) {
    const options = { capture: true, passive: true };
    target.addEventListener(type, fn, options);
    return () => target.removeEventListener(type, fn, options);
  }
  var DEPARTED_MIRROR_ACCESS_WARNING = "Please stop import mirror directly. Instead of that,\r\nnow you can use replayer.getMirror() to access the mirror instance of a replayer,\r\nor you can use record.mirror to access the mirror instance during recording.";
  var _mirror = {
    map: {},
    getId() {
      console.error(DEPARTED_MIRROR_ACCESS_WARNING);
      return -1;
    },
    getNode() {
      console.error(DEPARTED_MIRROR_ACCESS_WARNING);
      return null;
    },
    removeNodeFromMap() {
      console.error(DEPARTED_MIRROR_ACCESS_WARNING);
    },
    has() {
      console.error(DEPARTED_MIRROR_ACCESS_WARNING);
      return false;
    },
    reset() {
      console.error(DEPARTED_MIRROR_ACCESS_WARNING);
    }
  };
  if (typeof window !== "undefined" && window.Proxy && window.Reflect) {
    _mirror = new Proxy(_mirror, {
      get(target, prop, receiver) {
        if (prop === "map") {
          console.error(DEPARTED_MIRROR_ACCESS_WARNING);
        }
        return Reflect.get(target, prop, receiver);
      }
    });
  }
  function throttle(func, wait, options = {}) {
    let timeout = null;
    let previous = 0;
    return function(...args) {
      const now = Date.now();
      if (!previous && options.leading === false) {
        previous = now;
      }
      const remaining = wait - (now - previous);
      const context = this;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        func.apply(context, args);
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(() => {
          previous = options.leading === false ? 0 : Date.now();
          timeout = null;
          func.apply(context, args);
        }, remaining);
      }
    };
  }
  function hookSetter(target, key, d, isRevoked, win = window) {
    const original = win.Object.getOwnPropertyDescriptor(target, key);
    win.Object.defineProperty(
      target,
      key,
      isRevoked ? d : {
        set(value) {
          setTimeout(() => {
            d.set.call(this, value);
          }, 0);
          if (original && original.set) {
            original.set.call(this, value);
          }
        }
      }
    );
    return () => hookSetter(target, key, original || {}, true);
  }
  var nowTimestamp = Date.now;
  if (!/* @__PURE__ */ /[1-9][0-9]{12}/.test(Date.now().toString())) {
    nowTimestamp = () => (/* @__PURE__ */ new Date()).getTime();
  }
  function getWindowScroll(win) {
    var _a2, _b, _c, _d;
    const doc = win.document;
    return {
      left: doc.scrollingElement ? doc.scrollingElement.scrollLeft : win.pageXOffset !== void 0 ? win.pageXOffset : doc.documentElement.scrollLeft || (doc == null ? void 0 : doc.body) && ((_a2 = index.parentElement(doc.body)) == null ? void 0 : _a2.scrollLeft) || ((_b = doc == null ? void 0 : doc.body) == null ? void 0 : _b.scrollLeft) || 0,
      top: doc.scrollingElement ? doc.scrollingElement.scrollTop : win.pageYOffset !== void 0 ? win.pageYOffset : (doc == null ? void 0 : doc.documentElement.scrollTop) || (doc == null ? void 0 : doc.body) && ((_c = index.parentElement(doc.body)) == null ? void 0 : _c.scrollTop) || ((_d = doc == null ? void 0 : doc.body) == null ? void 0 : _d.scrollTop) || 0
    };
  }
  function getWindowHeight() {
    return window.innerHeight || document.documentElement && document.documentElement.clientHeight || document.body && document.body.clientHeight;
  }
  function getWindowWidth() {
    return window.innerWidth || document.documentElement && document.documentElement.clientWidth || document.body && document.body.clientWidth;
  }
  function closestElementOfNode(node2) {
    if (!node2) {
      return null;
    }
    const el = node2.nodeType === node2.ELEMENT_NODE ? node2 : index.parentElement(node2);
    return el;
  }
  function isBlocked(node2, blockClass, blockSelector, checkAncestors) {
    if (!node2) {
      return false;
    }
    const el = closestElementOfNode(node2);
    if (!el) {
      return false;
    }
    try {
      if (typeof blockClass === "string") {
        if (el.classList.contains(blockClass)) return true;
        if (checkAncestors && el.closest("." + blockClass) !== null) return true;
      } else {
        if (classMatchesRegex(el, blockClass, checkAncestors)) return true;
      }
    } catch (e2) {
    }
    if (blockSelector) {
      if (el.matches(blockSelector)) return true;
      if (checkAncestors && el.closest(blockSelector) !== null) return true;
    }
    return false;
  }
  function isSerialized(n2, mirror2) {
    return mirror2.getId(n2) !== -1;
  }
  function isIgnored(n2, mirror2, slimDOMOptions) {
    if (n2.tagName === "TITLE" && slimDOMOptions.headTitleMutations) {
      return true;
    }
    return mirror2.getId(n2) === IGNORED_NODE;
  }
  function isAncestorRemoved(target, mirror2) {
    if (isShadowRoot(target)) {
      return false;
    }
    const id = mirror2.getId(target);
    if (!mirror2.has(id)) {
      return true;
    }
    const parent = index.parentNode(target);
    if (parent && parent.nodeType === target.DOCUMENT_NODE) {
      return false;
    }
    if (!parent) {
      return true;
    }
    return isAncestorRemoved(parent, mirror2);
  }
  function legacy_isTouchEvent(event) {
    return Boolean(event.changedTouches);
  }
  function polyfill$1(win = window) {
    if ("NodeList" in win && !win.NodeList.prototype.forEach) {
      win.NodeList.prototype.forEach = Array.prototype.forEach;
    }
    if ("DOMTokenList" in win && !win.DOMTokenList.prototype.forEach) {
      win.DOMTokenList.prototype.forEach = Array.prototype.forEach;
    }
  }
  function isSerializedIframe(n2, mirror2) {
    return Boolean(n2.nodeName === "IFRAME" && mirror2.getMeta(n2));
  }
  function isSerializedStylesheet(n2, mirror2) {
    return Boolean(
      n2.nodeName === "LINK" && n2.nodeType === n2.ELEMENT_NODE && n2.getAttribute && n2.getAttribute("rel") === "stylesheet" && mirror2.getMeta(n2)
    );
  }
  function hasShadowRoot(n2) {
    if (!n2) return false;
    if (n2 instanceof BaseRRNode && "shadowRoot" in n2) {
      return Boolean(n2.shadowRoot);
    }
    return Boolean(index.shadowRoot(n2));
  }
  var StyleSheetMirror = class {
    constructor() {
      __publicField(this, "id", 1);
      __publicField(this, "styleIDMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "idStyleMap", /* @__PURE__ */ new Map());
    }
    getId(stylesheet) {
      return this.styleIDMap.get(stylesheet) ?? -1;
    }
    has(stylesheet) {
      return this.styleIDMap.has(stylesheet);
    }
    /**
     * @returns If the stylesheet is in the mirror, returns the id of the stylesheet. If not, return the new assigned id.
     */
    add(stylesheet, id) {
      if (this.has(stylesheet)) return this.getId(stylesheet);
      let newId;
      if (id === void 0) {
        newId = this.id++;
      } else newId = id;
      this.styleIDMap.set(stylesheet, newId);
      this.idStyleMap.set(newId, stylesheet);
      return newId;
    }
    getStyle(id) {
      return this.idStyleMap.get(id) || null;
    }
    reset() {
      this.styleIDMap = /* @__PURE__ */ new WeakMap();
      this.idStyleMap = /* @__PURE__ */ new Map();
      this.id = 1;
    }
    generateId() {
      return this.id++;
    }
  };
  function getShadowHost(n2) {
    var _a2;
    let shadowHost = null;
    if ("getRootNode" in n2 && ((_a2 = index.getRootNode(n2)) == null ? void 0 : _a2.nodeType) === Node.DOCUMENT_FRAGMENT_NODE && index.host(index.getRootNode(n2)))
      shadowHost = index.host(index.getRootNode(n2));
    return shadowHost;
  }
  function getRootShadowHost(n2) {
    let rootShadowHost = n2;
    let shadowHost;
    while (shadowHost = getShadowHost(rootShadowHost))
      rootShadowHost = shadowHost;
    return rootShadowHost;
  }
  function shadowHostInDom(n2) {
    const doc = index.ownerDocument(n2);
    if (!doc) return false;
    const shadowHost = getRootShadowHost(n2);
    return index.contains(doc, shadowHost);
  }
  function inDom(n2) {
    const doc = index.ownerDocument(n2);
    if (!doc) return false;
    return index.contains(doc, n2) || shadowHostInDom(n2);
  }
  var EventType = /* @__PURE__ */ ((EventType2) => {
    EventType2[EventType2["DomContentLoaded"] = 0] = "DomContentLoaded";
    EventType2[EventType2["Load"] = 1] = "Load";
    EventType2[EventType2["FullSnapshot"] = 2] = "FullSnapshot";
    EventType2[EventType2["IncrementalSnapshot"] = 3] = "IncrementalSnapshot";
    EventType2[EventType2["Meta"] = 4] = "Meta";
    EventType2[EventType2["Custom"] = 5] = "Custom";
    EventType2[EventType2["Plugin"] = 6] = "Plugin";
    return EventType2;
  })(EventType || {});
  var IncrementalSource = /* @__PURE__ */ ((IncrementalSource2) => {
    IncrementalSource2[IncrementalSource2["Mutation"] = 0] = "Mutation";
    IncrementalSource2[IncrementalSource2["MouseMove"] = 1] = "MouseMove";
    IncrementalSource2[IncrementalSource2["MouseInteraction"] = 2] = "MouseInteraction";
    IncrementalSource2[IncrementalSource2["Scroll"] = 3] = "Scroll";
    IncrementalSource2[IncrementalSource2["ViewportResize"] = 4] = "ViewportResize";
    IncrementalSource2[IncrementalSource2["Input"] = 5] = "Input";
    IncrementalSource2[IncrementalSource2["TouchMove"] = 6] = "TouchMove";
    IncrementalSource2[IncrementalSource2["MediaInteraction"] = 7] = "MediaInteraction";
    IncrementalSource2[IncrementalSource2["StyleSheetRule"] = 8] = "StyleSheetRule";
    IncrementalSource2[IncrementalSource2["CanvasMutation"] = 9] = "CanvasMutation";
    IncrementalSource2[IncrementalSource2["Font"] = 10] = "Font";
    IncrementalSource2[IncrementalSource2["Log"] = 11] = "Log";
    IncrementalSource2[IncrementalSource2["Drag"] = 12] = "Drag";
    IncrementalSource2[IncrementalSource2["StyleDeclaration"] = 13] = "StyleDeclaration";
    IncrementalSource2[IncrementalSource2["Selection"] = 14] = "Selection";
    IncrementalSource2[IncrementalSource2["AdoptedStyleSheet"] = 15] = "AdoptedStyleSheet";
    IncrementalSource2[IncrementalSource2["CustomElement"] = 16] = "CustomElement";
    return IncrementalSource2;
  })(IncrementalSource || {});
  var MouseInteractions = /* @__PURE__ */ ((MouseInteractions2) => {
    MouseInteractions2[MouseInteractions2["MouseUp"] = 0] = "MouseUp";
    MouseInteractions2[MouseInteractions2["MouseDown"] = 1] = "MouseDown";
    MouseInteractions2[MouseInteractions2["Click"] = 2] = "Click";
    MouseInteractions2[MouseInteractions2["ContextMenu"] = 3] = "ContextMenu";
    MouseInteractions2[MouseInteractions2["DblClick"] = 4] = "DblClick";
    MouseInteractions2[MouseInteractions2["Focus"] = 5] = "Focus";
    MouseInteractions2[MouseInteractions2["Blur"] = 6] = "Blur";
    MouseInteractions2[MouseInteractions2["TouchStart"] = 7] = "TouchStart";
    MouseInteractions2[MouseInteractions2["TouchMove_Departed"] = 8] = "TouchMove_Departed";
    MouseInteractions2[MouseInteractions2["TouchEnd"] = 9] = "TouchEnd";
    MouseInteractions2[MouseInteractions2["TouchCancel"] = 10] = "TouchCancel";
    return MouseInteractions2;
  })(MouseInteractions || {});
  var PointerTypes = /* @__PURE__ */ ((PointerTypes2) => {
    PointerTypes2[PointerTypes2["Mouse"] = 0] = "Mouse";
    PointerTypes2[PointerTypes2["Pen"] = 1] = "Pen";
    PointerTypes2[PointerTypes2["Touch"] = 2] = "Touch";
    return PointerTypes2;
  })(PointerTypes || {});
  var CanvasContext = /* @__PURE__ */ ((CanvasContext2) => {
    CanvasContext2[CanvasContext2["2D"] = 0] = "2D";
    CanvasContext2[CanvasContext2["WebGL"] = 1] = "WebGL";
    CanvasContext2[CanvasContext2["WebGL2"] = 2] = "WebGL2";
    return CanvasContext2;
  })(CanvasContext || {});
  var MediaInteractions = /* @__PURE__ */ ((MediaInteractions2) => {
    MediaInteractions2[MediaInteractions2["Play"] = 0] = "Play";
    MediaInteractions2[MediaInteractions2["Pause"] = 1] = "Pause";
    MediaInteractions2[MediaInteractions2["Seeked"] = 2] = "Seeked";
    MediaInteractions2[MediaInteractions2["VolumeChange"] = 3] = "VolumeChange";
    MediaInteractions2[MediaInteractions2["RateChange"] = 4] = "RateChange";
    return MediaInteractions2;
  })(MediaInteractions || {});
  var NodeType = /* @__PURE__ */ ((NodeType2) => {
    NodeType2[NodeType2["Document"] = 0] = "Document";
    NodeType2[NodeType2["DocumentType"] = 1] = "DocumentType";
    NodeType2[NodeType2["Element"] = 2] = "Element";
    NodeType2[NodeType2["Text"] = 3] = "Text";
    NodeType2[NodeType2["CDATA"] = 4] = "CDATA";
    NodeType2[NodeType2["Comment"] = 5] = "Comment";
    return NodeType2;
  })(NodeType || {});
  function isNodeInLinkedList(n2) {
    return "__ln" in n2;
  }
  var DoubleLinkedList = class {
    constructor() {
      __publicField(this, "length", 0);
      __publicField(this, "head", null);
      __publicField(this, "tail", null);
    }
    get(position) {
      if (position >= this.length) {
        throw new Error("Position outside of list range");
      }
      let current = this.head;
      for (let index2 = 0; index2 < position; index2++) {
        current = (current == null ? void 0 : current.next) || null;
      }
      return current;
    }
    addNode(n2) {
      const node2 = {
        value: n2,
        previous: null,
        next: null
      };
      n2.__ln = node2;
      if (n2.previousSibling && isNodeInLinkedList(n2.previousSibling)) {
        const current = n2.previousSibling.__ln.next;
        node2.next = current;
        node2.previous = n2.previousSibling.__ln;
        n2.previousSibling.__ln.next = node2;
        if (current) {
          current.previous = node2;
        }
      } else if (n2.nextSibling && isNodeInLinkedList(n2.nextSibling) && n2.nextSibling.__ln.previous) {
        const current = n2.nextSibling.__ln.previous;
        node2.previous = current;
        node2.next = n2.nextSibling.__ln;
        n2.nextSibling.__ln.previous = node2;
        if (current) {
          current.next = node2;
        }
      } else {
        if (this.head) {
          this.head.previous = node2;
        }
        node2.next = this.head;
        this.head = node2;
      }
      if (node2.next === null) {
        this.tail = node2;
      }
      this.length++;
    }
    removeNode(n2) {
      const current = n2.__ln;
      if (!this.head) {
        return;
      }
      if (!current.previous) {
        this.head = current.next;
        if (this.head) {
          this.head.previous = null;
        } else {
          this.tail = null;
        }
      } else {
        current.previous.next = current.next;
        if (current.next) {
          current.next.previous = current.previous;
        } else {
          this.tail = current.previous;
        }
      }
      if (n2.__ln) {
        delete n2.__ln;
      }
      this.length--;
    }
  };
  var moveKey = (id, parentId) => `${id}@${parentId}`;
  var MutationBuffer = class {
    constructor() {
      __publicField(this, "frozen", false);
      __publicField(this, "locked", false);
      __publicField(this, "texts", []);
      __publicField(this, "attributes", []);
      __publicField(this, "attributeMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "removes", []);
      __publicField(this, "mapRemoves", []);
      __publicField(this, "movedMap", {});
      __publicField(this, "addedSet", /* @__PURE__ */ new Set());
      __publicField(this, "movedSet", /* @__PURE__ */ new Set());
      __publicField(this, "droppedSet", /* @__PURE__ */ new Set());
      __publicField(this, "removesSubTreeCache", /* @__PURE__ */ new Set());
      __publicField(this, "mutationCb");
      __publicField(this, "blockClass");
      __publicField(this, "blockSelector");
      __publicField(this, "maskTextClass");
      __publicField(this, "maskTextSelector");
      __publicField(this, "inlineStylesheet");
      __publicField(this, "maskInputOptions");
      __publicField(this, "maskTextFn");
      __publicField(this, "maskInputFn");
      __publicField(this, "keepIframeSrcFn");
      __publicField(this, "recordCanvas");
      __publicField(this, "inlineImages");
      __publicField(this, "slimDOMOptions");
      __publicField(this, "dataURLOptions");
      __publicField(this, "doc");
      __publicField(this, "mirror");
      __publicField(this, "iframeManager");
      __publicField(this, "stylesheetManager");
      __publicField(this, "shadowDomManager");
      __publicField(this, "canvasManager");
      __publicField(this, "processedNodeManager");
      __publicField(this, "unattachedDoc");
      __publicField(this, "processMutations", (mutations) => {
        mutations.forEach(this.processMutation);
        this.emit();
      });
      __publicField(this, "emit", () => {
        if (this.frozen || this.locked) {
          return;
        }
        const adds = [];
        const addedIds = /* @__PURE__ */ new Set();
        const addList = new DoubleLinkedList();
        const getNextId = (n2) => {
          let ns = n2;
          let nextId = IGNORED_NODE;
          while (nextId === IGNORED_NODE) {
            ns = ns && ns.nextSibling;
            nextId = ns && this.mirror.getId(ns);
          }
          return nextId;
        };
        const pushAdd = (n2) => {
          const parent = index.parentNode(n2);
          if (!parent || !inDom(n2)) {
            return;
          }
          let cssCaptured = false;
          if (n2.nodeType === Node.TEXT_NODE) {
            const parentTag = parent.tagName;
            if (parentTag === "TEXTAREA") {
              return;
            } else if (parentTag === "STYLE" && this.addedSet.has(parent)) {
              cssCaptured = true;
            }
          }
          const parentId = isShadowRoot(parent) ? this.mirror.getId(getShadowHost(n2)) : this.mirror.getId(parent);
          const nextId = getNextId(n2);
          if (parentId === -1 || nextId === -1) {
            return addList.addNode(n2);
          }
          const sn = serializeNodeWithId(n2, {
            doc: this.doc,
            mirror: this.mirror,
            blockClass: this.blockClass,
            blockSelector: this.blockSelector,
            maskTextClass: this.maskTextClass,
            maskTextSelector: this.maskTextSelector,
            skipChild: true,
            newlyAddedElement: true,
            inlineStylesheet: this.inlineStylesheet,
            maskInputOptions: this.maskInputOptions,
            maskTextFn: this.maskTextFn,
            maskInputFn: this.maskInputFn,
            slimDOMOptions: this.slimDOMOptions,
            dataURLOptions: this.dataURLOptions,
            recordCanvas: this.recordCanvas,
            inlineImages: this.inlineImages,
            onSerialize: (currentN) => {
              if (isSerializedIframe(currentN, this.mirror)) {
                this.iframeManager.addIframe(currentN);
              }
              if (isSerializedStylesheet(currentN, this.mirror)) {
                this.stylesheetManager.trackLinkElement(
                  currentN
                );
              }
              if (hasShadowRoot(n2)) {
                this.shadowDomManager.addShadowRoot(index.shadowRoot(n2), this.doc);
              }
            },
            onIframeLoad: (iframe, childSn) => {
              this.iframeManager.attachIframe(iframe, childSn);
              this.shadowDomManager.observeAttachShadow(iframe);
            },
            onStylesheetLoad: (link, childSn) => {
              this.stylesheetManager.attachLinkElement(link, childSn);
            },
            cssCaptured
          });
          if (sn) {
            adds.push({
              parentId,
              nextId,
              node: sn
            });
            addedIds.add(sn.id);
          }
        };
        while (this.mapRemoves.length) {
          this.mirror.removeNodeFromMap(this.mapRemoves.shift());
        }
        for (const n2 of this.movedSet) {
          if (isParentRemoved(this.removesSubTreeCache, n2, this.mirror) && !this.movedSet.has(index.parentNode(n2))) {
            continue;
          }
          pushAdd(n2);
        }
        for (const n2 of this.addedSet) {
          if (!isAncestorInSet(this.droppedSet, n2) && !isParentRemoved(this.removesSubTreeCache, n2, this.mirror)) {
            pushAdd(n2);
          } else if (isAncestorInSet(this.movedSet, n2)) {
            pushAdd(n2);
          } else {
            this.droppedSet.add(n2);
          }
        }
        let candidate = null;
        while (addList.length) {
          let node2 = null;
          if (candidate) {
            const parentId = this.mirror.getId(index.parentNode(candidate.value));
            const nextId = getNextId(candidate.value);
            if (parentId !== -1 && nextId !== -1) {
              node2 = candidate;
            }
          }
          if (!node2) {
            let tailNode = addList.tail;
            while (tailNode) {
              const _node = tailNode;
              tailNode = tailNode.previous;
              if (_node) {
                const parentId = this.mirror.getId(index.parentNode(_node.value));
                const nextId = getNextId(_node.value);
                if (nextId === -1) continue;
                else if (parentId !== -1) {
                  node2 = _node;
                  break;
                } else {
                  const unhandledNode = _node.value;
                  const parent = index.parentNode(unhandledNode);
                  if (parent && parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                    const shadowHost = index.host(parent);
                    const parentId2 = this.mirror.getId(shadowHost);
                    if (parentId2 !== -1) {
                      node2 = _node;
                      break;
                    }
                  }
                }
              }
            }
          }
          if (!node2) {
            while (addList.head) {
              addList.removeNode(addList.head.value);
            }
            break;
          }
          candidate = node2.previous;
          addList.removeNode(node2.value);
          pushAdd(node2.value);
        }
        const payload = {
          texts: this.texts.map((text) => {
            const n2 = text.node;
            const parent = index.parentNode(n2);
            if (parent && parent.tagName === "TEXTAREA") {
              this.genTextAreaValueMutation(parent);
            }
            return {
              id: this.mirror.getId(n2),
              value: text.value
            };
          }).filter((text) => !addedIds.has(text.id)).filter((text) => this.mirror.has(text.id)),
          attributes: this.attributes.map((attribute) => {
            const { attributes: attributes2 } = attribute;
            if (typeof attributes2.style === "string") {
              const diffAsStr = JSON.stringify(attribute.styleDiff);
              const unchangedAsStr = JSON.stringify(attribute._unchangedStyles);
              if (diffAsStr.length < attributes2.style.length) {
                if ((diffAsStr + unchangedAsStr).split("var(").length === attributes2.style.split("var(").length) {
                  attributes2.style = attribute.styleDiff;
                }
              }
            }
            return {
              id: this.mirror.getId(attribute.node),
              attributes: attributes2
            };
          }).filter((attribute) => !addedIds.has(attribute.id)).filter((attribute) => this.mirror.has(attribute.id)),
          removes: this.removes,
          adds
        };
        if (!payload.texts.length && !payload.attributes.length && !payload.removes.length && !payload.adds.length) {
          return;
        }
        this.texts = [];
        this.attributes = [];
        this.attributeMap = /* @__PURE__ */ new WeakMap();
        this.removes = [];
        this.addedSet = /* @__PURE__ */ new Set();
        this.movedSet = /* @__PURE__ */ new Set();
        this.droppedSet = /* @__PURE__ */ new Set();
        this.removesSubTreeCache = /* @__PURE__ */ new Set();
        this.movedMap = {};
        this.mutationCb(payload);
      });
      __publicField(this, "genTextAreaValueMutation", (textarea) => {
        let item = this.attributeMap.get(textarea);
        if (!item) {
          item = {
            node: textarea,
            attributes: {},
            styleDiff: {},
            _unchangedStyles: {}
          };
          this.attributes.push(item);
          this.attributeMap.set(textarea, item);
        }
        const value = Array.from(
          index.childNodes(textarea),
          (cn) => index.textContent(cn) || ""
        ).join("");
        item.attributes.value = maskInputValue({
          element: textarea,
          maskInputOptions: this.maskInputOptions,
          tagName: textarea.tagName,
          type: getInputType(textarea),
          value,
          maskInputFn: this.maskInputFn
        });
      });
      __publicField(this, "processMutation", (m) => {
        if (isIgnored(m.target, this.mirror, this.slimDOMOptions)) {
          return;
        }
        switch (m.type) {
          case "characterData": {
            const value = index.textContent(m.target);
            if (!isBlocked(m.target, this.blockClass, this.blockSelector, false) && value !== m.oldValue) {
              this.texts.push({
                value: needMaskingText(
                  m.target,
                  this.maskTextClass,
                  this.maskTextSelector,
                  true
                  // checkAncestors
                ) && value ? this.maskTextFn ? this.maskTextFn(value, closestElementOfNode(m.target)) : value.replace(/[\S]/g, "*") : value,
                node: m.target
              });
            }
            break;
          }
          case "attributes": {
            const target = m.target;
            let attributeName = m.attributeName;
            let value = m.target.getAttribute(attributeName);
            if (attributeName === "value") {
              const type = getInputType(target);
              value = maskInputValue({
                element: target,
                maskInputOptions: this.maskInputOptions,
                tagName: target.tagName,
                type,
                value,
                maskInputFn: this.maskInputFn
              });
            }
            if (isBlocked(m.target, this.blockClass, this.blockSelector, false) || value === m.oldValue) {
              return;
            }
            let item = this.attributeMap.get(m.target);
            if (target.tagName === "IFRAME" && attributeName === "src" && !this.keepIframeSrcFn(value)) {
              if (!target.contentDocument) {
                attributeName = "rr_src";
              } else {
                return;
              }
            }
            if (!item) {
              item = {
                node: m.target,
                attributes: {},
                styleDiff: {},
                _unchangedStyles: {}
              };
              this.attributes.push(item);
              this.attributeMap.set(m.target, item);
            }
            if (attributeName === "type" && target.tagName === "INPUT" && (m.oldValue || "").toLowerCase() === "password") {
              target.setAttribute("data-rr-is-password", "true");
            }
            if (!ignoreAttribute(target.tagName, attributeName)) {
              item.attributes[attributeName] = transformAttribute(
                this.doc,
                toLowerCase(target.tagName),
                toLowerCase(attributeName),
                value
              );
              if (attributeName === "style") {
                if (!this.unattachedDoc) {
                  try {
                    this.unattachedDoc = document.implementation.createHTMLDocument();
                  } catch (e2) {
                    this.unattachedDoc = this.doc;
                  }
                }
                const old = this.unattachedDoc.createElement("span");
                if (m.oldValue) {
                  old.setAttribute("style", m.oldValue);
                }
                for (const pname of Array.from(target.style)) {
                  const newValue = target.style.getPropertyValue(pname);
                  const newPriority = target.style.getPropertyPriority(pname);
                  if (newValue !== old.style.getPropertyValue(pname) || newPriority !== old.style.getPropertyPriority(pname)) {
                    if (newPriority === "") {
                      item.styleDiff[pname] = newValue;
                    } else {
                      item.styleDiff[pname] = [newValue, newPriority];
                    }
                  } else {
                    item._unchangedStyles[pname] = [newValue, newPriority];
                  }
                }
                for (const pname of Array.from(old.style)) {
                  if (target.style.getPropertyValue(pname) === "") {
                    item.styleDiff[pname] = false;
                  }
                }
              } else if (attributeName === "open" && target.tagName === "DIALOG") {
                if (target.matches("dialog:modal")) {
                  item.attributes["rr_open_mode"] = "modal";
                } else {
                  item.attributes["rr_open_mode"] = "non-modal";
                }
              }
            }
            break;
          }
          case "childList": {
            if (isBlocked(m.target, this.blockClass, this.blockSelector, true))
              return;
            if (m.target.tagName === "TEXTAREA") {
              this.genTextAreaValueMutation(m.target);
              return;
            }
            m.addedNodes.forEach((n2) => this.genAdds(n2, m.target));
            m.removedNodes.forEach((n2) => {
              const nodeId = this.mirror.getId(n2);
              const parentId = isShadowRoot(m.target) ? this.mirror.getId(index.host(m.target)) : this.mirror.getId(m.target);
              if (isBlocked(m.target, this.blockClass, this.blockSelector, false) || isIgnored(n2, this.mirror, this.slimDOMOptions) || !isSerialized(n2, this.mirror)) {
                return;
              }
              if (this.addedSet.has(n2)) {
                deepDelete(this.addedSet, n2);
                this.droppedSet.add(n2);
              } else if (this.addedSet.has(m.target) && nodeId === -1) ;
              else if (isAncestorRemoved(m.target, this.mirror)) ;
              else if (this.movedSet.has(n2) && this.movedMap[moveKey(nodeId, parentId)]) {
                deepDelete(this.movedSet, n2);
              } else {
                this.removes.push({
                  parentId,
                  id: nodeId,
                  isShadow: isShadowRoot(m.target) && isNativeShadowDom(m.target) ? true : void 0
                });
                processRemoves(n2, this.removesSubTreeCache);
              }
              this.mapRemoves.push(n2);
            });
            break;
          }
        }
      });
      __publicField(this, "genAdds", (n2, target) => {
        if (this.processedNodeManager.inOtherBuffer(n2, this)) return;
        if (this.addedSet.has(n2) || this.movedSet.has(n2)) return;
        if (this.mirror.hasNode(n2)) {
          if (isIgnored(n2, this.mirror, this.slimDOMOptions)) {
            return;
          }
          this.movedSet.add(n2);
          let targetId = null;
          if (target && this.mirror.hasNode(target)) {
            targetId = this.mirror.getId(target);
          }
          if (targetId && targetId !== -1) {
            this.movedMap[moveKey(this.mirror.getId(n2), targetId)] = true;
          }
        } else {
          this.addedSet.add(n2);
          this.droppedSet.delete(n2);
        }
        if (!isBlocked(n2, this.blockClass, this.blockSelector, false)) {
          index.childNodes(n2).forEach((childN) => this.genAdds(childN));
          if (hasShadowRoot(n2)) {
            index.childNodes(index.shadowRoot(n2)).forEach((childN) => {
              this.processedNodeManager.add(childN, this);
              this.genAdds(childN, n2);
            });
          }
        }
      });
    }
    init(options) {
      [
        "mutationCb",
        "blockClass",
        "blockSelector",
        "maskTextClass",
        "maskTextSelector",
        "inlineStylesheet",
        "maskInputOptions",
        "maskTextFn",
        "maskInputFn",
        "keepIframeSrcFn",
        "recordCanvas",
        "inlineImages",
        "slimDOMOptions",
        "dataURLOptions",
        "doc",
        "mirror",
        "iframeManager",
        "stylesheetManager",
        "shadowDomManager",
        "canvasManager",
        "processedNodeManager"
      ].forEach((key) => {
        this[key] = options[key];
      });
    }
    freeze() {
      this.frozen = true;
      this.canvasManager.freeze();
    }
    unfreeze() {
      this.frozen = false;
      this.canvasManager.unfreeze();
      this.emit();
    }
    isFrozen() {
      return this.frozen;
    }
    lock() {
      this.locked = true;
      this.canvasManager.lock();
    }
    unlock() {
      this.locked = false;
      this.canvasManager.unlock();
      this.emit();
    }
    reset() {
      this.shadowDomManager.reset();
      this.canvasManager.reset();
    }
  };
  function deepDelete(addsSet, n2) {
    addsSet.delete(n2);
    index.childNodes(n2).forEach((childN) => deepDelete(addsSet, childN));
  }
  function processRemoves(n2, cache) {
    const queue = [n2];
    while (queue.length) {
      const next = queue.pop();
      if (cache.has(next)) continue;
      cache.add(next);
      index.childNodes(next).forEach((n22) => queue.push(n22));
    }
    return;
  }
  function isParentRemoved(removes, n2, mirror2) {
    if (removes.size === 0) return false;
    return _isParentRemoved(removes, n2);
  }
  function _isParentRemoved(removes, n2, _mirror2) {
    const node2 = index.parentNode(n2);
    if (!node2) return false;
    return removes.has(node2);
  }
  function isAncestorInSet(set, n2) {
    if (set.size === 0) return false;
    return _isAncestorInSet(set, n2);
  }
  function _isAncestorInSet(set, n2) {
    const parent = index.parentNode(n2);
    if (!parent) {
      return false;
    }
    if (set.has(parent)) {
      return true;
    }
    return _isAncestorInSet(set, parent);
  }
  var errorHandler;
  function registerErrorHandler(handler) {
    errorHandler = handler;
  }
  function unregisterErrorHandler() {
    errorHandler = void 0;
  }
  var callbackWrapper = (cb) => {
    if (!errorHandler) {
      return cb;
    }
    const rrwebWrapped = (...rest) => {
      try {
        return cb(...rest);
      } catch (error) {
        if (errorHandler && errorHandler(error) === true) {
          return;
        }
        throw error;
      }
    };
    return rrwebWrapped;
  };
  var mutationBuffers = [];
  function getEventTarget(event) {
    try {
      if ("composedPath" in event) {
        const path = event.composedPath();
        if (path.length) {
          return path[0];
        }
      } else if ("path" in event && event.path.length) {
        return event.path[0];
      }
    } catch {
    }
    return event && event.target;
  }
  function initMutationObserver(options, rootEl) {
    const mutationBuffer = new MutationBuffer();
    mutationBuffers.push(mutationBuffer);
    mutationBuffer.init(options);
    const observer = new (mutationObserverCtor())(
      callbackWrapper(mutationBuffer.processMutations.bind(mutationBuffer))
    );
    observer.observe(rootEl, {
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      characterDataOldValue: true,
      childList: true,
      subtree: true
    });
    return observer;
  }
  function initMoveObserver({
    mousemoveCb,
    sampling,
    doc,
    mirror: mirror2
  }) {
    if (sampling.mousemove === false) {
      return () => {
      };
    }
    const threshold = typeof sampling.mousemove === "number" ? sampling.mousemove : 50;
    const callbackThreshold = typeof sampling.mousemoveCallback === "number" ? sampling.mousemoveCallback : 500;
    let positions = [];
    let timeBaseline;
    const wrappedCb = throttle(
      callbackWrapper(
        (source) => {
          const totalOffset = Date.now() - timeBaseline;
          mousemoveCb(
            positions.map((p) => {
              p.timeOffset -= totalOffset;
              return p;
            }),
            source
          );
          positions = [];
          timeBaseline = null;
        }
      ),
      callbackThreshold
    );
    const updatePosition = callbackWrapper(
      throttle(
        callbackWrapper((evt) => {
          const target = getEventTarget(evt);
          const { clientX, clientY } = legacy_isTouchEvent(evt) ? evt.changedTouches[0] : evt;
          if (!timeBaseline) {
            timeBaseline = nowTimestamp();
          }
          positions.push({
            x: clientX,
            y: clientY,
            id: mirror2.getId(target),
            timeOffset: nowTimestamp() - timeBaseline
          });
          wrappedCb(
            typeof DragEvent !== "undefined" && evt instanceof DragEvent ? IncrementalSource.Drag : evt instanceof MouseEvent ? IncrementalSource.MouseMove : IncrementalSource.TouchMove
          );
        }),
        threshold,
        {
          trailing: false
        }
      )
    );
    const handlers = [
      on("mousemove", updatePosition, doc),
      on("touchmove", updatePosition, doc),
      on("drag", updatePosition, doc)
    ];
    return callbackWrapper(() => {
      handlers.forEach((h) => h());
    });
  }
  function initMouseInteractionObserver({
    mouseInteractionCb,
    doc,
    mirror: mirror2,
    blockClass,
    blockSelector,
    sampling
  }) {
    if (sampling.mouseInteraction === false) {
      return () => {
      };
    }
    const disableMap = sampling.mouseInteraction === true || sampling.mouseInteraction === void 0 ? {} : sampling.mouseInteraction;
    const handlers = [];
    let currentPointerType = null;
    const getHandler = (eventKey) => {
      return (event) => {
        const target = getEventTarget(event);
        if (isBlocked(target, blockClass, blockSelector, true)) {
          return;
        }
        let pointerType = null;
        let thisEventKey = eventKey;
        if ("pointerType" in event) {
          switch (event.pointerType) {
            case "mouse":
              pointerType = PointerTypes.Mouse;
              break;
            case "touch":
              pointerType = PointerTypes.Touch;
              break;
            case "pen":
              pointerType = PointerTypes.Pen;
              break;
          }
          if (pointerType === PointerTypes.Touch) {
            if (MouseInteractions[eventKey] === MouseInteractions.MouseDown) {
              thisEventKey = "TouchStart";
            } else if (MouseInteractions[eventKey] === MouseInteractions.MouseUp) {
              thisEventKey = "TouchEnd";
            }
          } else if (pointerType === PointerTypes.Pen) ;
        } else if (legacy_isTouchEvent(event)) {
          pointerType = PointerTypes.Touch;
        }
        if (pointerType !== null) {
          currentPointerType = pointerType;
          if (thisEventKey.startsWith("Touch") && pointerType === PointerTypes.Touch || thisEventKey.startsWith("Mouse") && pointerType === PointerTypes.Mouse) {
            pointerType = null;
          }
        } else if (MouseInteractions[eventKey] === MouseInteractions.Click) {
          pointerType = currentPointerType;
          currentPointerType = null;
        }
        const e2 = legacy_isTouchEvent(event) ? event.changedTouches[0] : event;
        if (!e2) {
          return;
        }
        const id = mirror2.getId(target);
        const { clientX, clientY } = e2;
        callbackWrapper(mouseInteractionCb)({
          type: MouseInteractions[thisEventKey],
          id,
          x: clientX,
          y: clientY,
          ...pointerType !== null && { pointerType }
        });
      };
    };
    Object.keys(MouseInteractions).filter(
      (key) => Number.isNaN(Number(key)) && !key.endsWith("_Departed") && disableMap[key] !== false
    ).forEach((eventKey) => {
      let eventName = toLowerCase(eventKey);
      const handler = getHandler(eventKey);
      if (window.PointerEvent) {
        switch (MouseInteractions[eventKey]) {
          case MouseInteractions.MouseDown:
          case MouseInteractions.MouseUp:
            eventName = eventName.replace(
              "mouse",
              "pointer"
            );
            break;
          case MouseInteractions.TouchStart:
          case MouseInteractions.TouchEnd:
            return;
        }
      }
      handlers.push(on(eventName, handler, doc));
    });
    return callbackWrapper(() => {
      handlers.forEach((h) => h());
    });
  }
  function initScrollObserver({
    scrollCb,
    doc,
    mirror: mirror2,
    blockClass,
    blockSelector,
    sampling
  }) {
    const updatePosition = callbackWrapper(
      throttle(
        callbackWrapper((evt) => {
          const target = getEventTarget(evt);
          if (!target || isBlocked(target, blockClass, blockSelector, true)) {
            return;
          }
          const id = mirror2.getId(target);
          if (target === doc && doc.defaultView) {
            const scrollLeftTop = getWindowScroll(doc.defaultView);
            scrollCb({
              id,
              x: scrollLeftTop.left,
              y: scrollLeftTop.top
            });
          } else {
            scrollCb({
              id,
              x: target.scrollLeft,
              y: target.scrollTop
            });
          }
        }),
        sampling.scroll || 100
      )
    );
    return on("scroll", updatePosition, doc);
  }
  function initViewportResizeObserver({ viewportResizeCb }, { win }) {
    let lastH = -1;
    let lastW = -1;
    const updateDimension = callbackWrapper(
      throttle(
        callbackWrapper(() => {
          const height = getWindowHeight();
          const width = getWindowWidth();
          if (lastH !== height || lastW !== width) {
            viewportResizeCb({
              width: Number(width),
              height: Number(height)
            });
            lastH = height;
            lastW = width;
          }
        }),
        200
      )
    );
    return on("resize", updateDimension, win);
  }
  var INPUT_TAGS = ["INPUT", "TEXTAREA", "SELECT"];
  var lastInputValueMap = /* @__PURE__ */ new WeakMap();
  function initInputObserver({
    inputCb,
    doc,
    mirror: mirror2,
    blockClass,
    blockSelector,
    ignoreClass,
    ignoreSelector,
    maskInputOptions,
    maskInputFn,
    sampling,
    userTriggeredOnInput
  }) {
    function eventHandler(event) {
      let target = getEventTarget(event);
      const userTriggered = event.isTrusted;
      const tagName = target && target.tagName;
      if (target && tagName === "OPTION") {
        target = index.parentElement(target);
      }
      if (!target || !tagName || INPUT_TAGS.indexOf(tagName) < 0 || isBlocked(target, blockClass, blockSelector, true)) {
        return;
      }
      if (target.classList.contains(ignoreClass) || ignoreSelector && target.matches(ignoreSelector)) {
        return;
      }
      let text = target.value;
      let isChecked = false;
      const type = getInputType(target) || "";
      if (type === "radio" || type === "checkbox") {
        isChecked = target.checked;
      } else if (maskInputOptions[tagName.toLowerCase()] || maskInputOptions[type]) {
        text = maskInputValue({
          element: target,
          maskInputOptions,
          tagName,
          type,
          value: text,
          maskInputFn
        });
      }
      cbWithDedup(
        target,
        userTriggeredOnInput ? { text, isChecked, userTriggered } : { text, isChecked }
      );
      const name = target.name;
      if (type === "radio" && name && isChecked) {
        doc.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach((el) => {
          if (el !== target) {
            const text2 = el.value;
            cbWithDedup(
              el,
              userTriggeredOnInput ? { text: text2, isChecked: !isChecked, userTriggered: false } : { text: text2, isChecked: !isChecked }
            );
          }
        });
      }
    }
    function cbWithDedup(target, v2) {
      const lastInputValue = lastInputValueMap.get(target);
      if (!lastInputValue || lastInputValue.text !== v2.text || lastInputValue.isChecked !== v2.isChecked) {
        lastInputValueMap.set(target, v2);
        const id = mirror2.getId(target);
        callbackWrapper(inputCb)({
          ...v2,
          id
        });
      }
    }
    const events = sampling.input === "last" ? ["change"] : ["input", "change"];
    const handlers = events.map(
      (eventName) => on(eventName, callbackWrapper(eventHandler), doc)
    );
    const currentWindow = doc.defaultView;
    if (!currentWindow) {
      return () => {
        handlers.forEach((h) => h());
      };
    }
    const propertyDescriptor = currentWindow.Object.getOwnPropertyDescriptor(
      currentWindow.HTMLInputElement.prototype,
      "value"
    );
    const hookProperties = [
      [currentWindow.HTMLInputElement.prototype, "value"],
      [currentWindow.HTMLInputElement.prototype, "checked"],
      [currentWindow.HTMLSelectElement.prototype, "value"],
      [currentWindow.HTMLTextAreaElement.prototype, "value"],
      // Some UI library use selectedIndex to set select value
      [currentWindow.HTMLSelectElement.prototype, "selectedIndex"],
      [currentWindow.HTMLOptionElement.prototype, "selected"]
    ];
    if (propertyDescriptor && propertyDescriptor.set) {
      handlers.push(
        ...hookProperties.map(
          (p) => hookSetter(
            p[0],
            p[1],
            {
              set() {
                callbackWrapper(eventHandler)({
                  target: this,
                  isTrusted: false
                  // userTriggered to false as this could well be programmatic
                });
              }
            },
            false,
            currentWindow
          )
        )
      );
    }
    return callbackWrapper(() => {
      handlers.forEach((h) => h());
    });
  }
  function getNestedCSSRulePositions(rule2) {
    const positions = [];
    function recurse(childRule, pos) {
      if (hasNestedCSSRule("CSSGroupingRule") && childRule.parentRule instanceof CSSGroupingRule || hasNestedCSSRule("CSSMediaRule") && childRule.parentRule instanceof CSSMediaRule || hasNestedCSSRule("CSSSupportsRule") && childRule.parentRule instanceof CSSSupportsRule || hasNestedCSSRule("CSSConditionRule") && childRule.parentRule instanceof CSSConditionRule) {
        const rules2 = Array.from(
          childRule.parentRule.cssRules
        );
        const index2 = rules2.indexOf(childRule);
        pos.unshift(index2);
      } else if (childRule.parentStyleSheet) {
        const rules2 = Array.from(childRule.parentStyleSheet.cssRules);
        const index2 = rules2.indexOf(childRule);
        pos.unshift(index2);
      }
      return pos;
    }
    return recurse(rule2, positions);
  }
  function getIdAndStyleId(sheet, mirror2, styleMirror) {
    let id, styleId;
    if (!sheet) return {};
    if (sheet.ownerNode) id = mirror2.getId(sheet.ownerNode);
    else styleId = styleMirror.getId(sheet);
    return {
      styleId,
      id
    };
  }
  function initStyleSheetObserver({ styleSheetRuleCb, mirror: mirror2, stylesheetManager }, { win }) {
    if (!win.CSSStyleSheet || !win.CSSStyleSheet.prototype) {
      return () => {
      };
    }
    const insertRule = win.CSSStyleSheet.prototype.insertRule;
    win.CSSStyleSheet.prototype.insertRule = new Proxy(insertRule, {
      apply: callbackWrapper(
        (target, thisArg, argumentsList) => {
          const [rule2, index2] = argumentsList;
          const { id, styleId } = getIdAndStyleId(
            thisArg,
            mirror2,
            stylesheetManager.styleMirror
          );
          if (id && id !== -1 || styleId && styleId !== -1) {
            styleSheetRuleCb({
              id,
              styleId,
              adds: [{ rule: rule2, index: index2 }]
            });
          }
          return target.apply(thisArg, argumentsList);
        }
      )
    });
    win.CSSStyleSheet.prototype.addRule = function(selector, styleBlock, index2 = this.cssRules.length) {
      const rule2 = `${selector} { ${styleBlock} }`;
      return win.CSSStyleSheet.prototype.insertRule.apply(this, [rule2, index2]);
    };
    const deleteRule = win.CSSStyleSheet.prototype.deleteRule;
    win.CSSStyleSheet.prototype.deleteRule = new Proxy(deleteRule, {
      apply: callbackWrapper(
        (target, thisArg, argumentsList) => {
          const [index2] = argumentsList;
          const { id, styleId } = getIdAndStyleId(
            thisArg,
            mirror2,
            stylesheetManager.styleMirror
          );
          if (id && id !== -1 || styleId && styleId !== -1) {
            styleSheetRuleCb({
              id,
              styleId,
              removes: [{ index: index2 }]
            });
          }
          return target.apply(thisArg, argumentsList);
        }
      )
    });
    win.CSSStyleSheet.prototype.removeRule = function(index2) {
      return win.CSSStyleSheet.prototype.deleteRule.apply(this, [index2]);
    };
    let replace;
    if (win.CSSStyleSheet.prototype.replace) {
      replace = win.CSSStyleSheet.prototype.replace;
      win.CSSStyleSheet.prototype.replace = new Proxy(replace, {
        apply: callbackWrapper(
          (target, thisArg, argumentsList) => {
            const [text] = argumentsList;
            const { id, styleId } = getIdAndStyleId(
              thisArg,
              mirror2,
              stylesheetManager.styleMirror
            );
            if (id && id !== -1 || styleId && styleId !== -1) {
              styleSheetRuleCb({
                id,
                styleId,
                replace: text
              });
            }
            return target.apply(thisArg, argumentsList);
          }
        )
      });
    }
    let replaceSync;
    if (win.CSSStyleSheet.prototype.replaceSync) {
      replaceSync = win.CSSStyleSheet.prototype.replaceSync;
      win.CSSStyleSheet.prototype.replaceSync = new Proxy(replaceSync, {
        apply: callbackWrapper(
          (target, thisArg, argumentsList) => {
            const [text] = argumentsList;
            const { id, styleId } = getIdAndStyleId(
              thisArg,
              mirror2,
              stylesheetManager.styleMirror
            );
            if (id && id !== -1 || styleId && styleId !== -1) {
              styleSheetRuleCb({
                id,
                styleId,
                replaceSync: text
              });
            }
            return target.apply(thisArg, argumentsList);
          }
        )
      });
    }
    const supportedNestedCSSRuleTypes = {};
    if (canMonkeyPatchNestedCSSRule("CSSGroupingRule")) {
      supportedNestedCSSRuleTypes.CSSGroupingRule = win.CSSGroupingRule;
    } else {
      if (canMonkeyPatchNestedCSSRule("CSSMediaRule")) {
        supportedNestedCSSRuleTypes.CSSMediaRule = win.CSSMediaRule;
      }
      if (canMonkeyPatchNestedCSSRule("CSSConditionRule")) {
        supportedNestedCSSRuleTypes.CSSConditionRule = win.CSSConditionRule;
      }
      if (canMonkeyPatchNestedCSSRule("CSSSupportsRule")) {
        supportedNestedCSSRuleTypes.CSSSupportsRule = win.CSSSupportsRule;
      }
    }
    const unmodifiedFunctions = {};
    Object.entries(supportedNestedCSSRuleTypes).forEach(([typeKey, type]) => {
      unmodifiedFunctions[typeKey] = {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        insertRule: type.prototype.insertRule,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        deleteRule: type.prototype.deleteRule
      };
      type.prototype.insertRule = new Proxy(
        unmodifiedFunctions[typeKey].insertRule,
        {
          apply: callbackWrapper(
            (target, thisArg, argumentsList) => {
              const [rule2, index2] = argumentsList;
              const { id, styleId } = getIdAndStyleId(
                thisArg.parentStyleSheet,
                mirror2,
                stylesheetManager.styleMirror
              );
              if (id && id !== -1 || styleId && styleId !== -1) {
                styleSheetRuleCb({
                  id,
                  styleId,
                  adds: [
                    {
                      rule: rule2,
                      index: [
                        ...getNestedCSSRulePositions(thisArg),
                        index2 || 0
                        // defaults to 0
                      ]
                    }
                  ]
                });
              }
              return target.apply(thisArg, argumentsList);
            }
          )
        }
      );
      type.prototype.deleteRule = new Proxy(
        unmodifiedFunctions[typeKey].deleteRule,
        {
          apply: callbackWrapper(
            (target, thisArg, argumentsList) => {
              const [index2] = argumentsList;
              const { id, styleId } = getIdAndStyleId(
                thisArg.parentStyleSheet,
                mirror2,
                stylesheetManager.styleMirror
              );
              if (id && id !== -1 || styleId && styleId !== -1) {
                styleSheetRuleCb({
                  id,
                  styleId,
                  removes: [
                    { index: [...getNestedCSSRulePositions(thisArg), index2] }
                  ]
                });
              }
              return target.apply(thisArg, argumentsList);
            }
          )
        }
      );
    });
    return callbackWrapper(() => {
      win.CSSStyleSheet.prototype.insertRule = insertRule;
      win.CSSStyleSheet.prototype.deleteRule = deleteRule;
      replace && (win.CSSStyleSheet.prototype.replace = replace);
      replaceSync && (win.CSSStyleSheet.prototype.replaceSync = replaceSync);
      Object.entries(supportedNestedCSSRuleTypes).forEach(([typeKey, type]) => {
        type.prototype.insertRule = unmodifiedFunctions[typeKey].insertRule;
        type.prototype.deleteRule = unmodifiedFunctions[typeKey].deleteRule;
      });
    });
  }
  function initAdoptedStyleSheetObserver({
    mirror: mirror2,
    stylesheetManager
  }, host2) {
    var _a2, _b, _c;
    let hostId = null;
    if (host2.nodeName === "#document") hostId = mirror2.getId(host2);
    else hostId = mirror2.getId(index.host(host2));
    const patchTarget = host2.nodeName === "#document" ? (_a2 = host2.defaultView) == null ? void 0 : _a2.Document : (_c = (_b = host2.ownerDocument) == null ? void 0 : _b.defaultView) == null ? void 0 : _c.ShadowRoot;
    const originalPropertyDescriptor = (patchTarget == null ? void 0 : patchTarget.prototype) ? Object.getOwnPropertyDescriptor(
      patchTarget == null ? void 0 : patchTarget.prototype,
      "adoptedStyleSheets"
    ) : void 0;
    if (hostId === null || hostId === -1 || !patchTarget || !originalPropertyDescriptor)
      return () => {
      };
    Object.defineProperty(host2, "adoptedStyleSheets", {
      configurable: originalPropertyDescriptor.configurable,
      enumerable: originalPropertyDescriptor.enumerable,
      get() {
        var _a3;
        return (_a3 = originalPropertyDescriptor.get) == null ? void 0 : _a3.call(this);
      },
      set(sheets) {
        var _a3;
        const result2 = (_a3 = originalPropertyDescriptor.set) == null ? void 0 : _a3.call(this, sheets);
        if (hostId !== null && hostId !== -1) {
          try {
            stylesheetManager.adoptStyleSheets(sheets, hostId);
          } catch (e2) {
          }
        }
        return result2;
      }
    });
    return callbackWrapper(() => {
      Object.defineProperty(host2, "adoptedStyleSheets", {
        configurable: originalPropertyDescriptor.configurable,
        enumerable: originalPropertyDescriptor.enumerable,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        get: originalPropertyDescriptor.get,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        set: originalPropertyDescriptor.set
      });
    });
  }
  function initStyleDeclarationObserver({
    styleDeclarationCb,
    mirror: mirror2,
    ignoreCSSAttributes,
    stylesheetManager
  }, { win }) {
    const setProperty = win.CSSStyleDeclaration.prototype.setProperty;
    win.CSSStyleDeclaration.prototype.setProperty = new Proxy(setProperty, {
      apply: callbackWrapper(
        (target, thisArg, argumentsList) => {
          var _a2;
          const [property, value, priority] = argumentsList;
          if (ignoreCSSAttributes.has(property)) {
            return setProperty.apply(thisArg, [property, value, priority]);
          }
          const { id, styleId } = getIdAndStyleId(
            (_a2 = thisArg.parentRule) == null ? void 0 : _a2.parentStyleSheet,
            mirror2,
            stylesheetManager.styleMirror
          );
          if (id && id !== -1 || styleId && styleId !== -1) {
            styleDeclarationCb({
              id,
              styleId,
              set: {
                property,
                value,
                priority
              },
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              index: getNestedCSSRulePositions(thisArg.parentRule)
            });
          }
          return target.apply(thisArg, argumentsList);
        }
      )
    });
    const removeProperty = win.CSSStyleDeclaration.prototype.removeProperty;
    win.CSSStyleDeclaration.prototype.removeProperty = new Proxy(removeProperty, {
      apply: callbackWrapper(
        (target, thisArg, argumentsList) => {
          var _a2;
          const [property] = argumentsList;
          if (ignoreCSSAttributes.has(property)) {
            return removeProperty.apply(thisArg, [property]);
          }
          const { id, styleId } = getIdAndStyleId(
            (_a2 = thisArg.parentRule) == null ? void 0 : _a2.parentStyleSheet,
            mirror2,
            stylesheetManager.styleMirror
          );
          if (id && id !== -1 || styleId && styleId !== -1) {
            styleDeclarationCb({
              id,
              styleId,
              remove: {
                property
              },
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              index: getNestedCSSRulePositions(thisArg.parentRule)
            });
          }
          return target.apply(thisArg, argumentsList);
        }
      )
    });
    return callbackWrapper(() => {
      win.CSSStyleDeclaration.prototype.setProperty = setProperty;
      win.CSSStyleDeclaration.prototype.removeProperty = removeProperty;
    });
  }
  function initMediaInteractionObserver({
    mediaInteractionCb,
    blockClass,
    blockSelector,
    mirror: mirror2,
    sampling,
    doc
  }) {
    const handler = callbackWrapper(
      (type) => throttle(
        callbackWrapper((event) => {
          const target = getEventTarget(event);
          if (!target || isBlocked(target, blockClass, blockSelector, true)) {
            return;
          }
          const { currentTime, volume, muted, playbackRate, loop } = target;
          mediaInteractionCb({
            type,
            id: mirror2.getId(target),
            currentTime,
            volume,
            muted,
            playbackRate,
            loop
          });
        }),
        sampling.media || 500
      )
    );
    const handlers = [
      on("play", handler(MediaInteractions.Play), doc),
      on("pause", handler(MediaInteractions.Pause), doc),
      on("seeked", handler(MediaInteractions.Seeked), doc),
      on("volumechange", handler(MediaInteractions.VolumeChange), doc),
      on("ratechange", handler(MediaInteractions.RateChange), doc)
    ];
    return callbackWrapper(() => {
      handlers.forEach((h) => h());
    });
  }
  function initFontObserver({ fontCb, doc }) {
    const win = doc.defaultView;
    if (!win) {
      return () => {
      };
    }
    const handlers = [];
    const fontMap = /* @__PURE__ */ new WeakMap();
    const originalFontFace = win.FontFace;
    win.FontFace = function FontFace2(family, source, descriptors) {
      const fontFace = new originalFontFace(family, source, descriptors);
      fontMap.set(fontFace, {
        family,
        buffer: typeof source !== "string",
        descriptors,
        fontSource: typeof source === "string" ? source : JSON.stringify(Array.from(new Uint8Array(source)))
      });
      return fontFace;
    };
    const restoreHandler = patch(
      doc.fonts,
      "add",
      function(original) {
        return function(fontFace) {
          setTimeout(
            callbackWrapper(() => {
              const p = fontMap.get(fontFace);
              if (p) {
                fontCb(p);
                fontMap.delete(fontFace);
              }
            }),
            0
          );
          return original.apply(this, [fontFace]);
        };
      }
    );
    handlers.push(() => {
      win.FontFace = originalFontFace;
    });
    handlers.push(restoreHandler);
    return callbackWrapper(() => {
      handlers.forEach((h) => h());
    });
  }
  function initSelectionObserver(param) {
    const { doc, mirror: mirror2, blockClass, blockSelector, selectionCb } = param;
    let collapsed = true;
    const updateSelection = callbackWrapper(() => {
      const selection = doc.getSelection();
      if (!selection || collapsed && (selection == null ? void 0 : selection.isCollapsed)) return;
      collapsed = selection.isCollapsed || false;
      const ranges = [];
      const count2 = selection.rangeCount || 0;
      for (let i2 = 0; i2 < count2; i2++) {
        const range = selection.getRangeAt(i2);
        const { startContainer, startOffset, endContainer, endOffset } = range;
        const blocked = isBlocked(startContainer, blockClass, blockSelector, true) || isBlocked(endContainer, blockClass, blockSelector, true);
        if (blocked) continue;
        ranges.push({
          start: mirror2.getId(startContainer),
          startOffset,
          end: mirror2.getId(endContainer),
          endOffset
        });
      }
      selectionCb({ ranges });
    });
    updateSelection();
    return on("selectionchange", updateSelection);
  }
  function initCustomElementObserver({
    doc,
    customElementCb
  }) {
    const win = doc.defaultView;
    if (!win || !win.customElements) return () => {
    };
    const restoreHandler = patch(
      win.customElements,
      "define",
      function(original) {
        return function(name, constructor, options) {
          try {
            customElementCb({
              define: {
                name
              }
            });
          } catch (e2) {
            console.warn(`Custom element callback failed for ${name}`);
          }
          return original.apply(this, [name, constructor, options]);
        };
      }
    );
    return restoreHandler;
  }
  function mergeHooks(o2, hooks) {
    const {
      mutationCb,
      mousemoveCb,
      mouseInteractionCb,
      scrollCb,
      viewportResizeCb,
      inputCb,
      mediaInteractionCb,
      styleSheetRuleCb,
      styleDeclarationCb,
      canvasMutationCb,
      fontCb,
      selectionCb,
      customElementCb
    } = o2;
    o2.mutationCb = (...p) => {
      if (hooks.mutation) {
        hooks.mutation(...p);
      }
      mutationCb(...p);
    };
    o2.mousemoveCb = (...p) => {
      if (hooks.mousemove) {
        hooks.mousemove(...p);
      }
      mousemoveCb(...p);
    };
    o2.mouseInteractionCb = (...p) => {
      if (hooks.mouseInteraction) {
        hooks.mouseInteraction(...p);
      }
      mouseInteractionCb(...p);
    };
    o2.scrollCb = (...p) => {
      if (hooks.scroll) {
        hooks.scroll(...p);
      }
      scrollCb(...p);
    };
    o2.viewportResizeCb = (...p) => {
      if (hooks.viewportResize) {
        hooks.viewportResize(...p);
      }
      viewportResizeCb(...p);
    };
    o2.inputCb = (...p) => {
      if (hooks.input) {
        hooks.input(...p);
      }
      inputCb(...p);
    };
    o2.mediaInteractionCb = (...p) => {
      if (hooks.mediaInteaction) {
        hooks.mediaInteaction(...p);
      }
      mediaInteractionCb(...p);
    };
    o2.styleSheetRuleCb = (...p) => {
      if (hooks.styleSheetRule) {
        hooks.styleSheetRule(...p);
      }
      styleSheetRuleCb(...p);
    };
    o2.styleDeclarationCb = (...p) => {
      if (hooks.styleDeclaration) {
        hooks.styleDeclaration(...p);
      }
      styleDeclarationCb(...p);
    };
    o2.canvasMutationCb = (...p) => {
      if (hooks.canvasMutation) {
        hooks.canvasMutation(...p);
      }
      canvasMutationCb(...p);
    };
    o2.fontCb = (...p) => {
      if (hooks.font) {
        hooks.font(...p);
      }
      fontCb(...p);
    };
    o2.selectionCb = (...p) => {
      if (hooks.selection) {
        hooks.selection(...p);
      }
      selectionCb(...p);
    };
    o2.customElementCb = (...c2) => {
      if (hooks.customElement) {
        hooks.customElement(...c2);
      }
      customElementCb(...c2);
    };
  }
  function initObservers(o2, hooks = {}) {
    const currentWindow = o2.doc.defaultView;
    if (!currentWindow) {
      return () => {
      };
    }
    mergeHooks(o2, hooks);
    let mutationObserver;
    if (o2.recordDOM) {
      mutationObserver = initMutationObserver(o2, o2.doc);
    }
    const mousemoveHandler = initMoveObserver(o2);
    const mouseInteractionHandler = initMouseInteractionObserver(o2);
    const scrollHandler = initScrollObserver(o2);
    const viewportResizeHandler = initViewportResizeObserver(o2, {
      win: currentWindow
    });
    const inputHandler = initInputObserver(o2);
    const mediaInteractionHandler = initMediaInteractionObserver(o2);
    let styleSheetObserver = () => {
    };
    let adoptedStyleSheetObserver = () => {
    };
    let styleDeclarationObserver = () => {
    };
    let fontObserver = () => {
    };
    if (o2.recordDOM) {
      styleSheetObserver = initStyleSheetObserver(o2, { win: currentWindow });
      adoptedStyleSheetObserver = initAdoptedStyleSheetObserver(o2, o2.doc);
      styleDeclarationObserver = initStyleDeclarationObserver(o2, {
        win: currentWindow
      });
      if (o2.collectFonts) {
        fontObserver = initFontObserver(o2);
      }
    }
    const selectionObserver = initSelectionObserver(o2);
    const customElementObserver = initCustomElementObserver(o2);
    const pluginHandlers = [];
    for (const plugin3 of o2.plugins) {
      pluginHandlers.push(
        plugin3.observer(plugin3.callback, currentWindow, plugin3.options)
      );
    }
    return callbackWrapper(() => {
      mutationBuffers.forEach((b) => b.reset());
      mutationObserver == null ? void 0 : mutationObserver.disconnect();
      mousemoveHandler();
      mouseInteractionHandler();
      scrollHandler();
      viewportResizeHandler();
      inputHandler();
      mediaInteractionHandler();
      styleSheetObserver();
      adoptedStyleSheetObserver();
      styleDeclarationObserver();
      fontObserver();
      selectionObserver();
      customElementObserver();
      pluginHandlers.forEach((h) => h());
    });
  }
  function hasNestedCSSRule(prop) {
    return typeof window[prop] !== "undefined";
  }
  function canMonkeyPatchNestedCSSRule(prop) {
    return Boolean(
      typeof window[prop] !== "undefined" && // Note: Generally, this check _shouldn't_ be necessary
      // However, in some scenarios (e.g. jsdom) this can sometimes fail, so we check for it here
      window[prop].prototype && "insertRule" in window[prop].prototype && "deleteRule" in window[prop].prototype
    );
  }
  var CrossOriginIframeMirror = class {
    constructor(generateIdFn) {
      __publicField(this, "iframeIdToRemoteIdMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "iframeRemoteIdToIdMap", /* @__PURE__ */ new WeakMap());
      this.generateIdFn = generateIdFn;
    }
    getId(iframe, remoteId, idToRemoteMap, remoteToIdMap) {
      const idToRemoteIdMap = idToRemoteMap || this.getIdToRemoteIdMap(iframe);
      const remoteIdToIdMap = remoteToIdMap || this.getRemoteIdToIdMap(iframe);
      let id = idToRemoteIdMap.get(remoteId);
      if (!id) {
        id = this.generateIdFn();
        idToRemoteIdMap.set(remoteId, id);
        remoteIdToIdMap.set(id, remoteId);
      }
      return id;
    }
    getIds(iframe, remoteId) {
      const idToRemoteIdMap = this.getIdToRemoteIdMap(iframe);
      const remoteIdToIdMap = this.getRemoteIdToIdMap(iframe);
      return remoteId.map(
        (id) => this.getId(iframe, id, idToRemoteIdMap, remoteIdToIdMap)
      );
    }
    getRemoteId(iframe, id, map) {
      const remoteIdToIdMap = map || this.getRemoteIdToIdMap(iframe);
      if (typeof id !== "number") return id;
      const remoteId = remoteIdToIdMap.get(id);
      if (!remoteId) return -1;
      return remoteId;
    }
    getRemoteIds(iframe, ids) {
      const remoteIdToIdMap = this.getRemoteIdToIdMap(iframe);
      return ids.map((id) => this.getRemoteId(iframe, id, remoteIdToIdMap));
    }
    reset(iframe) {
      if (!iframe) {
        this.iframeIdToRemoteIdMap = /* @__PURE__ */ new WeakMap();
        this.iframeRemoteIdToIdMap = /* @__PURE__ */ new WeakMap();
        return;
      }
      this.iframeIdToRemoteIdMap.delete(iframe);
      this.iframeRemoteIdToIdMap.delete(iframe);
    }
    getIdToRemoteIdMap(iframe) {
      let idToRemoteIdMap = this.iframeIdToRemoteIdMap.get(iframe);
      if (!idToRemoteIdMap) {
        idToRemoteIdMap = /* @__PURE__ */ new Map();
        this.iframeIdToRemoteIdMap.set(iframe, idToRemoteIdMap);
      }
      return idToRemoteIdMap;
    }
    getRemoteIdToIdMap(iframe) {
      let remoteIdToIdMap = this.iframeRemoteIdToIdMap.get(iframe);
      if (!remoteIdToIdMap) {
        remoteIdToIdMap = /* @__PURE__ */ new Map();
        this.iframeRemoteIdToIdMap.set(iframe, remoteIdToIdMap);
      }
      return remoteIdToIdMap;
    }
  };
  var IframeManager = class {
    constructor(options) {
      __publicField(this, "iframes", /* @__PURE__ */ new WeakMap());
      __publicField(this, "crossOriginIframeMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "crossOriginIframeMirror", new CrossOriginIframeMirror(genId));
      __publicField(this, "crossOriginIframeStyleMirror");
      __publicField(this, "crossOriginIframeRootIdMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "mirror");
      __publicField(this, "mutationCb");
      __publicField(this, "wrappedEmit");
      __publicField(this, "loadListener");
      __publicField(this, "stylesheetManager");
      __publicField(this, "recordCrossOriginIframes");
      this.mutationCb = options.mutationCb;
      this.wrappedEmit = options.wrappedEmit;
      this.stylesheetManager = options.stylesheetManager;
      this.recordCrossOriginIframes = options.recordCrossOriginIframes;
      this.crossOriginIframeStyleMirror = new CrossOriginIframeMirror(
        this.stylesheetManager.styleMirror.generateId.bind(
          this.stylesheetManager.styleMirror
        )
      );
      this.mirror = options.mirror;
      if (this.recordCrossOriginIframes) {
        window.addEventListener("message", this.handleMessage.bind(this));
      }
    }
    addIframe(iframeEl) {
      this.iframes.set(iframeEl, true);
      if (iframeEl.contentWindow)
        this.crossOriginIframeMap.set(iframeEl.contentWindow, iframeEl);
    }
    addLoadListener(cb) {
      this.loadListener = cb;
    }
    attachIframe(iframeEl, childSn) {
      var _a2, _b;
      this.mutationCb({
        adds: [
          {
            parentId: this.mirror.getId(iframeEl),
            nextId: null,
            node: childSn
          }
        ],
        removes: [],
        texts: [],
        attributes: [],
        isAttachIframe: true
      });
      if (this.recordCrossOriginIframes)
        (_a2 = iframeEl.contentWindow) == null ? void 0 : _a2.addEventListener(
          "message",
          this.handleMessage.bind(this)
        );
      (_b = this.loadListener) == null ? void 0 : _b.call(this, iframeEl);
      if (iframeEl.contentDocument && iframeEl.contentDocument.adoptedStyleSheets && iframeEl.contentDocument.adoptedStyleSheets.length > 0)
        this.stylesheetManager.adoptStyleSheets(
          iframeEl.contentDocument.adoptedStyleSheets,
          this.mirror.getId(iframeEl.contentDocument)
        );
    }
    handleMessage(message) {
      const crossOriginMessageEvent = message;
      if (crossOriginMessageEvent.data.type !== "rrweb" || // To filter out the rrweb messages which are forwarded by some sites.
      crossOriginMessageEvent.origin !== crossOriginMessageEvent.data.origin)
        return;
      const iframeSourceWindow = message.source;
      if (!iframeSourceWindow) return;
      const iframeEl = this.crossOriginIframeMap.get(message.source);
      if (!iframeEl) return;
      const transformedEvent = this.transformCrossOriginEvent(
        iframeEl,
        crossOriginMessageEvent.data.event
      );
      if (transformedEvent)
        this.wrappedEmit(
          transformedEvent,
          crossOriginMessageEvent.data.isCheckout
        );
    }
    transformCrossOriginEvent(iframeEl, e2) {
      var _a2;
      switch (e2.type) {
        case EventType.FullSnapshot: {
          this.crossOriginIframeMirror.reset(iframeEl);
          this.crossOriginIframeStyleMirror.reset(iframeEl);
          this.replaceIdOnNode(e2.data.node, iframeEl);
          const rootId = e2.data.node.id;
          this.crossOriginIframeRootIdMap.set(iframeEl, rootId);
          this.patchRootIdOnNode(e2.data.node, rootId);
          return {
            timestamp: e2.timestamp,
            type: EventType.IncrementalSnapshot,
            data: {
              source: IncrementalSource.Mutation,
              adds: [
                {
                  parentId: this.mirror.getId(iframeEl),
                  nextId: null,
                  node: e2.data.node
                }
              ],
              removes: [],
              texts: [],
              attributes: [],
              isAttachIframe: true
            }
          };
        }
        case EventType.Meta:
        case EventType.Load:
        case EventType.DomContentLoaded: {
          return false;
        }
        case EventType.Plugin: {
          return e2;
        }
        case EventType.Custom: {
          this.replaceIds(
            e2.data.payload,
            iframeEl,
            ["id", "parentId", "previousId", "nextId"]
          );
          return e2;
        }
        case EventType.IncrementalSnapshot: {
          switch (e2.data.source) {
            case IncrementalSource.Mutation: {
              e2.data.adds.forEach((n2) => {
                this.replaceIds(n2, iframeEl, [
                  "parentId",
                  "nextId",
                  "previousId"
                ]);
                this.replaceIdOnNode(n2.node, iframeEl);
                const rootId = this.crossOriginIframeRootIdMap.get(iframeEl);
                rootId && this.patchRootIdOnNode(n2.node, rootId);
              });
              e2.data.removes.forEach((n2) => {
                this.replaceIds(n2, iframeEl, ["parentId", "id"]);
              });
              e2.data.attributes.forEach((n2) => {
                this.replaceIds(n2, iframeEl, ["id"]);
              });
              e2.data.texts.forEach((n2) => {
                this.replaceIds(n2, iframeEl, ["id"]);
              });
              return e2;
            }
            case IncrementalSource.Drag:
            case IncrementalSource.TouchMove:
            case IncrementalSource.MouseMove: {
              e2.data.positions.forEach((p) => {
                this.replaceIds(p, iframeEl, ["id"]);
              });
              return e2;
            }
            case IncrementalSource.ViewportResize: {
              return false;
            }
            case IncrementalSource.MediaInteraction:
            case IncrementalSource.MouseInteraction:
            case IncrementalSource.Scroll:
            case IncrementalSource.CanvasMutation:
            case IncrementalSource.Input: {
              this.replaceIds(e2.data, iframeEl, ["id"]);
              return e2;
            }
            case IncrementalSource.StyleSheetRule:
            case IncrementalSource.StyleDeclaration: {
              this.replaceIds(e2.data, iframeEl, ["id"]);
              this.replaceStyleIds(e2.data, iframeEl, ["styleId"]);
              return e2;
            }
            case IncrementalSource.Font: {
              return e2;
            }
            case IncrementalSource.Selection: {
              e2.data.ranges.forEach((range) => {
                this.replaceIds(range, iframeEl, ["start", "end"]);
              });
              return e2;
            }
            case IncrementalSource.AdoptedStyleSheet: {
              this.replaceIds(e2.data, iframeEl, ["id"]);
              this.replaceStyleIds(e2.data, iframeEl, ["styleIds"]);
              (_a2 = e2.data.styles) == null ? void 0 : _a2.forEach((style) => {
                this.replaceStyleIds(style, iframeEl, ["styleId"]);
              });
              return e2;
            }
          }
        }
      }
      return false;
    }
    replace(iframeMirror, obj, iframeEl, keys) {
      for (const key of keys) {
        if (!Array.isArray(obj[key]) && typeof obj[key] !== "number") continue;
        if (Array.isArray(obj[key])) {
          obj[key] = iframeMirror.getIds(
            iframeEl,
            obj[key]
          );
        } else {
          obj[key] = iframeMirror.getId(iframeEl, obj[key]);
        }
      }
      return obj;
    }
    replaceIds(obj, iframeEl, keys) {
      return this.replace(this.crossOriginIframeMirror, obj, iframeEl, keys);
    }
    replaceStyleIds(obj, iframeEl, keys) {
      return this.replace(this.crossOriginIframeStyleMirror, obj, iframeEl, keys);
    }
    replaceIdOnNode(node2, iframeEl) {
      this.replaceIds(node2, iframeEl, ["id", "rootId"]);
      if ("childNodes" in node2) {
        node2.childNodes.forEach((child) => {
          this.replaceIdOnNode(child, iframeEl);
        });
      }
    }
    patchRootIdOnNode(node2, rootId) {
      if (node2.type !== NodeType.Document && !node2.rootId) node2.rootId = rootId;
      if ("childNodes" in node2) {
        node2.childNodes.forEach((child) => {
          this.patchRootIdOnNode(child, rootId);
        });
      }
    }
  };
  var ShadowDomManager = class {
    constructor(options) {
      __publicField(this, "shadowDoms", /* @__PURE__ */ new WeakSet());
      __publicField(this, "mutationCb");
      __publicField(this, "scrollCb");
      __publicField(this, "bypassOptions");
      __publicField(this, "mirror");
      __publicField(this, "restoreHandlers", []);
      this.mutationCb = options.mutationCb;
      this.scrollCb = options.scrollCb;
      this.bypassOptions = options.bypassOptions;
      this.mirror = options.mirror;
      this.init();
    }
    init() {
      this.reset();
      this.patchAttachShadow(Element, document);
    }
    addShadowRoot(shadowRoot2, doc) {
      if (!isNativeShadowDom(shadowRoot2)) return;
      if (this.shadowDoms.has(shadowRoot2)) return;
      this.shadowDoms.add(shadowRoot2);
      const observer = initMutationObserver(
        {
          ...this.bypassOptions,
          doc,
          mutationCb: this.mutationCb,
          mirror: this.mirror,
          shadowDomManager: this
        },
        shadowRoot2
      );
      this.restoreHandlers.push(() => observer.disconnect());
      this.restoreHandlers.push(
        initScrollObserver({
          ...this.bypassOptions,
          scrollCb: this.scrollCb,
          // https://gist.github.com/praveenpuglia/0832da687ed5a5d7a0907046c9ef1813
          // scroll is not allowed to pass the boundary, so we need to listen the shadow document
          doc: shadowRoot2,
          mirror: this.mirror
        })
      );
      setTimeout(() => {
        if (shadowRoot2.adoptedStyleSheets && shadowRoot2.adoptedStyleSheets.length > 0)
          this.bypassOptions.stylesheetManager.adoptStyleSheets(
            shadowRoot2.adoptedStyleSheets,
            this.mirror.getId(index.host(shadowRoot2))
          );
        this.restoreHandlers.push(
          initAdoptedStyleSheetObserver(
            {
              mirror: this.mirror,
              stylesheetManager: this.bypassOptions.stylesheetManager
            },
            shadowRoot2
          )
        );
      }, 0);
    }
    /**
     * Monkey patch 'attachShadow' of an IFrameElement to observe newly added shadow doms.
     */
    observeAttachShadow(iframeElement) {
      if (!iframeElement.contentWindow || !iframeElement.contentDocument) return;
      this.patchAttachShadow(
        iframeElement.contentWindow.Element,
        iframeElement.contentDocument
      );
    }
    /**
     * Patch 'attachShadow' to observe newly added shadow doms.
     */
    patchAttachShadow(element, doc) {
      const manager = this;
      this.restoreHandlers.push(
        patch(
          element.prototype,
          "attachShadow",
          function(original) {
            return function(option) {
              const sRoot = original.call(this, option);
              const shadowRootEl = index.shadowRoot(this);
              if (shadowRootEl && inDom(this))
                manager.addShadowRoot(shadowRootEl, doc);
              return sRoot;
            };
          }
        )
      );
    }
    reset() {
      this.restoreHandlers.forEach((handler) => {
        try {
          handler();
        } catch (e2) {
        }
      });
      this.restoreHandlers = [];
      this.shadowDoms = /* @__PURE__ */ new WeakSet();
    }
  };
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
  for (i$1 = 0; i$1 < chars.length; i$1++) {
    lookup[chars.charCodeAt(i$1)] = i$1;
  }
  var i$1;
  var encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer), i2, len = bytes.length, base64 = "";
    for (i2 = 0; i2 < len; i2 += 3) {
      base64 += chars[bytes[i2] >> 2];
      base64 += chars[(bytes[i2] & 3) << 4 | bytes[i2 + 1] >> 4];
      base64 += chars[(bytes[i2 + 1] & 15) << 2 | bytes[i2 + 2] >> 6];
      base64 += chars[bytes[i2 + 2] & 63];
    }
    if (len % 3 === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }
    return base64;
  };
  var canvasVarMap = /* @__PURE__ */ new Map();
  function variableListFor$1(ctx, ctor) {
    let contextMap = canvasVarMap.get(ctx);
    if (!contextMap) {
      contextMap = /* @__PURE__ */ new Map();
      canvasVarMap.set(ctx, contextMap);
    }
    if (!contextMap.has(ctor)) {
      contextMap.set(ctor, []);
    }
    return contextMap.get(ctor);
  }
  var saveWebGLVar = (value, win, ctx) => {
    if (!value || !(isInstanceOfWebGLObject(value, win) || typeof value === "object"))
      return;
    const name = value.constructor.name;
    const list2 = variableListFor$1(ctx, name);
    let index2 = list2.indexOf(value);
    if (index2 === -1) {
      index2 = list2.length;
      list2.push(value);
    }
    return index2;
  };
  function serializeArg(value, win, ctx) {
    if (value instanceof Array) {
      return value.map((arg) => serializeArg(arg, win, ctx));
    } else if (value === null) {
      return value;
    } else if (value instanceof Float32Array || value instanceof Float64Array || value instanceof Int32Array || value instanceof Uint32Array || value instanceof Uint8Array || value instanceof Uint16Array || value instanceof Int16Array || value instanceof Int8Array || value instanceof Uint8ClampedArray) {
      const name = value.constructor.name;
      return {
        rr_type: name,
        args: [Object.values(value)]
      };
    } else if (
      // SharedArrayBuffer disabled on most browsers due to spectre.
      // More info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/SharedArrayBuffer
      // value instanceof SharedArrayBuffer ||
      value instanceof ArrayBuffer
    ) {
      const name = value.constructor.name;
      const base64 = encode(value);
      return {
        rr_type: name,
        base64
      };
    } else if (value instanceof DataView) {
      const name = value.constructor.name;
      return {
        rr_type: name,
        args: [
          serializeArg(value.buffer, win, ctx),
          value.byteOffset,
          value.byteLength
        ]
      };
    } else if (value instanceof HTMLImageElement) {
      const name = value.constructor.name;
      const { src } = value;
      return {
        rr_type: name,
        src
      };
    } else if (value instanceof HTMLCanvasElement) {
      const name = "HTMLImageElement";
      const src = value.toDataURL();
      return {
        rr_type: name,
        src
      };
    } else if (value instanceof ImageData) {
      const name = value.constructor.name;
      return {
        rr_type: name,
        args: [serializeArg(value.data, win, ctx), value.width, value.height]
      };
    } else if (isInstanceOfWebGLObject(value, win) || typeof value === "object") {
      const name = value.constructor.name;
      const index2 = saveWebGLVar(value, win, ctx);
      return {
        rr_type: name,
        index: index2
      };
    }
    return value;
  }
  var serializeArgs2 = (args, win, ctx) => {
    return args.map((arg) => serializeArg(arg, win, ctx));
  };
  var isInstanceOfWebGLObject = (value, win) => {
    const webGLConstructorNames = [
      "WebGLActiveInfo",
      "WebGLBuffer",
      "WebGLFramebuffer",
      "WebGLProgram",
      "WebGLRenderbuffer",
      "WebGLShader",
      "WebGLShaderPrecisionFormat",
      "WebGLTexture",
      "WebGLUniformLocation",
      "WebGLVertexArrayObject",
      // In old Chrome versions, value won't be an instanceof WebGLVertexArrayObject.
      "WebGLVertexArrayObjectOES"
    ];
    const supportedWebGLConstructorNames = webGLConstructorNames.filter(
      (name) => typeof win[name] === "function"
    );
    return Boolean(
      supportedWebGLConstructorNames.find(
        (name) => value instanceof win[name]
      )
    );
  };
  function initCanvas2DMutationObserver(cb, win, blockClass, blockSelector) {
    const handlers = [];
    const props2D = Object.getOwnPropertyNames(
      win.CanvasRenderingContext2D.prototype
    );
    for (const prop of props2D) {
      try {
        if (typeof win.CanvasRenderingContext2D.prototype[prop] !== "function") {
          continue;
        }
        const restoreHandler = patch(
          win.CanvasRenderingContext2D.prototype,
          prop,
          function(original) {
            return function(...args) {
              if (!isBlocked(this.canvas, blockClass, blockSelector, true)) {
                setTimeout(() => {
                  const recordArgs = serializeArgs2(args, win, this);
                  cb(this.canvas, {
                    type: CanvasContext["2D"],
                    property: prop,
                    args: recordArgs
                  });
                }, 0);
              }
              return original.apply(this, args);
            };
          }
        );
        handlers.push(restoreHandler);
      } catch {
        const hookHandler = hookSetter(
          win.CanvasRenderingContext2D.prototype,
          prop,
          {
            set(v2) {
              cb(this.canvas, {
                type: CanvasContext["2D"],
                property: prop,
                args: [v2],
                setter: true
              });
            }
          }
        );
        handlers.push(hookHandler);
      }
    }
    return () => {
      handlers.forEach((h) => h());
    };
  }
  function getNormalizedContextName(contextType) {
    return contextType === "experimental-webgl" ? "webgl" : contextType;
  }
  function initCanvasContextObserver(win, blockClass, blockSelector, setPreserveDrawingBufferToTrue) {
    const handlers = [];
    try {
      const restoreHandler = patch(
        win.HTMLCanvasElement.prototype,
        "getContext",
        function(original) {
          return function(contextType, ...args) {
            if (!isBlocked(this, blockClass, blockSelector, true)) {
              const ctxName = getNormalizedContextName(contextType);
              if (!("__context" in this)) this.__context = ctxName;
              if (setPreserveDrawingBufferToTrue && ["webgl", "webgl2"].includes(ctxName)) {
                if (args[0] && typeof args[0] === "object") {
                  const contextAttributes = args[0];
                  if (!contextAttributes.preserveDrawingBuffer) {
                    contextAttributes.preserveDrawingBuffer = true;
                  }
                } else {
                  args.splice(0, 1, {
                    preserveDrawingBuffer: true
                  });
                }
              }
            }
            return original.apply(this, [contextType, ...args]);
          };
        }
      );
      handlers.push(restoreHandler);
    } catch {
      console.error("failed to patch HTMLCanvasElement.prototype.getContext");
    }
    return () => {
      handlers.forEach((h) => h());
    };
  }
  function patchGLPrototype(prototype, type, cb, blockClass, blockSelector, win) {
    const handlers = [];
    const props = Object.getOwnPropertyNames(prototype);
    for (const prop of props) {
      if (
        //prop.startsWith('get') ||  // e.g. getProgramParameter, but too risky
        [
          "isContextLost",
          "canvas",
          "drawingBufferWidth",
          "drawingBufferHeight"
        ].includes(prop)
      ) {
        continue;
      }
      try {
        if (typeof prototype[prop] !== "function") {
          continue;
        }
        const restoreHandler = patch(
          prototype,
          prop,
          function(original) {
            return function(...args) {
              const result2 = original.apply(this, args);
              saveWebGLVar(result2, win, this);
              if ("tagName" in this.canvas && !isBlocked(this.canvas, blockClass, blockSelector, true)) {
                const recordArgs = serializeArgs2(args, win, this);
                const mutation = {
                  type,
                  property: prop,
                  args: recordArgs
                };
                cb(this.canvas, mutation);
              }
              return result2;
            };
          }
        );
        handlers.push(restoreHandler);
      } catch {
        const hookHandler = hookSetter(prototype, prop, {
          set(v2) {
            cb(this.canvas, {
              type,
              property: prop,
              args: [v2],
              setter: true
            });
          }
        });
        handlers.push(hookHandler);
      }
    }
    return handlers;
  }
  function initCanvasWebGLMutationObserver(cb, win, blockClass, blockSelector) {
    const handlers = [];
    handlers.push(
      ...patchGLPrototype(
        win.WebGLRenderingContext.prototype,
        CanvasContext.WebGL,
        cb,
        blockClass,
        blockSelector,
        win
      )
    );
    if (typeof win.WebGL2RenderingContext !== "undefined") {
      handlers.push(
        ...patchGLPrototype(
          win.WebGL2RenderingContext.prototype,
          CanvasContext.WebGL2,
          cb,
          blockClass,
          blockSelector,
          win
        )
      );
    }
    return () => {
      handlers.forEach((h) => h());
    };
  }
  var encodedJs = "KGZ1bmN0aW9uKCkgewogICJ1c2Ugc3RyaWN0IjsKICB2YXIgY2hhcnMgPSAiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyI7CiAgdmFyIGxvb2t1cCA9IHR5cGVvZiBVaW50OEFycmF5ID09PSAidW5kZWZpbmVkIiA/IFtdIDogbmV3IFVpbnQ4QXJyYXkoMjU2KTsKICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYXJzLmxlbmd0aDsgaSsrKSB7CiAgICBsb29rdXBbY2hhcnMuY2hhckNvZGVBdChpKV0gPSBpOwogIH0KICB2YXIgZW5jb2RlID0gZnVuY3Rpb24oYXJyYXlidWZmZXIpIHsKICAgIHZhciBieXRlcyA9IG5ldyBVaW50OEFycmF5KGFycmF5YnVmZmVyKSwgaTIsIGxlbiA9IGJ5dGVzLmxlbmd0aCwgYmFzZTY0ID0gIiI7CiAgICBmb3IgKGkyID0gMDsgaTIgPCBsZW47IGkyICs9IDMpIHsKICAgICAgYmFzZTY0ICs9IGNoYXJzW2J5dGVzW2kyXSA+PiAyXTsKICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpMl0gJiAzKSA8PCA0IHwgYnl0ZXNbaTIgKyAxXSA+PiA0XTsKICAgICAgYmFzZTY0ICs9IGNoYXJzWyhieXRlc1tpMiArIDFdICYgMTUpIDw8IDIgfCBieXRlc1tpMiArIDJdID4+IDZdOwogICAgICBiYXNlNjQgKz0gY2hhcnNbYnl0ZXNbaTIgKyAyXSAmIDYzXTsKICAgIH0KICAgIGlmIChsZW4gJSAzID09PSAyKSB7CiAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDEpICsgIj0iOwogICAgfSBlbHNlIGlmIChsZW4gJSAzID09PSAxKSB7CiAgICAgIGJhc2U2NCA9IGJhc2U2NC5zdWJzdHJpbmcoMCwgYmFzZTY0Lmxlbmd0aCAtIDIpICsgIj09IjsKICAgIH0KICAgIHJldHVybiBiYXNlNjQ7CiAgfTsKICBjb25zdCBsYXN0QmxvYk1hcCA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7CiAgY29uc3QgdHJhbnNwYXJlbnRCbG9iTWFwID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTsKICBhc3luYyBmdW5jdGlvbiBnZXRUcmFuc3BhcmVudEJsb2JGb3Iod2lkdGgsIGhlaWdodCwgZGF0YVVSTE9wdGlvbnMpIHsKICAgIGNvbnN0IGlkID0gYCR7d2lkdGh9LSR7aGVpZ2h0fWA7CiAgICBpZiAoIk9mZnNjcmVlbkNhbnZhcyIgaW4gZ2xvYmFsVGhpcykgewogICAgICBpZiAodHJhbnNwYXJlbnRCbG9iTWFwLmhhcyhpZCkpIHJldHVybiB0cmFuc3BhcmVudEJsb2JNYXAuZ2V0KGlkKTsKICAgICAgY29uc3Qgb2Zmc2NyZWVuID0gbmV3IE9mZnNjcmVlbkNhbnZhcyh3aWR0aCwgaGVpZ2h0KTsKICAgICAgb2Zmc2NyZWVuLmdldENvbnRleHQoIjJkIik7CiAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCBvZmZzY3JlZW4uY29udmVydFRvQmxvYihkYXRhVVJMT3B0aW9ucyk7CiAgICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgYmxvYi5hcnJheUJ1ZmZlcigpOwogICAgICBjb25zdCBiYXNlNjQgPSBlbmNvZGUoYXJyYXlCdWZmZXIpOwogICAgICB0cmFuc3BhcmVudEJsb2JNYXAuc2V0KGlkLCBiYXNlNjQpOwogICAgICByZXR1cm4gYmFzZTY0OwogICAgfSBlbHNlIHsKICAgICAgcmV0dXJuICIiOwogICAgfQogIH0KICBjb25zdCB3b3JrZXIgPSBzZWxmOwogIHdvcmtlci5vbm1lc3NhZ2UgPSBhc3luYyBmdW5jdGlvbihlKSB7CiAgICBpZiAoIk9mZnNjcmVlbkNhbnZhcyIgaW4gZ2xvYmFsVGhpcykgewogICAgICBjb25zdCB7IGlkLCBiaXRtYXAsIHdpZHRoLCBoZWlnaHQsIGRhdGFVUkxPcHRpb25zIH0gPSBlLmRhdGE7CiAgICAgIGNvbnN0IHRyYW5zcGFyZW50QmFzZTY0ID0gZ2V0VHJhbnNwYXJlbnRCbG9iRm9yKAogICAgICAgIHdpZHRoLAogICAgICAgIGhlaWdodCwKICAgICAgICBkYXRhVVJMT3B0aW9ucwogICAgICApOwogICAgICBjb25zdCBvZmZzY3JlZW4gPSBuZXcgT2Zmc2NyZWVuQ2FudmFzKHdpZHRoLCBoZWlnaHQpOwogICAgICBjb25zdCBjdHggPSBvZmZzY3JlZW4uZ2V0Q29udGV4dCgiMmQiKTsKICAgICAgY3R4LmRyYXdJbWFnZShiaXRtYXAsIDAsIDApOwogICAgICBiaXRtYXAuY2xvc2UoKTsKICAgICAgY29uc3QgYmxvYiA9IGF3YWl0IG9mZnNjcmVlbi5jb252ZXJ0VG9CbG9iKGRhdGFVUkxPcHRpb25zKTsKICAgICAgY29uc3QgdHlwZSA9IGJsb2IudHlwZTsKICAgICAgY29uc3QgYXJyYXlCdWZmZXIgPSBhd2FpdCBibG9iLmFycmF5QnVmZmVyKCk7CiAgICAgIGNvbnN0IGJhc2U2NCA9IGVuY29kZShhcnJheUJ1ZmZlcik7CiAgICAgIGlmICghbGFzdEJsb2JNYXAuaGFzKGlkKSAmJiBhd2FpdCB0cmFuc3BhcmVudEJhc2U2NCA9PT0gYmFzZTY0KSB7CiAgICAgICAgbGFzdEJsb2JNYXAuc2V0KGlkLCBiYXNlNjQpOwogICAgICAgIHJldHVybiB3b3JrZXIucG9zdE1lc3NhZ2UoeyBpZCB9KTsKICAgICAgfQogICAgICBpZiAobGFzdEJsb2JNYXAuZ2V0KGlkKSA9PT0gYmFzZTY0KSByZXR1cm4gd29ya2VyLnBvc3RNZXNzYWdlKHsgaWQgfSk7CiAgICAgIHdvcmtlci5wb3N0TWVzc2FnZSh7CiAgICAgICAgaWQsCiAgICAgICAgdHlwZSwKICAgICAgICBiYXNlNjQsCiAgICAgICAgd2lkdGgsCiAgICAgICAgaGVpZ2h0CiAgICAgIH0pOwogICAgICBsYXN0QmxvYk1hcC5zZXQoaWQsIGJhc2U2NCk7CiAgICB9IGVsc2UgewogICAgICByZXR1cm4gd29ya2VyLnBvc3RNZXNzYWdlKHsgaWQ6IGUuZGF0YS5pZCB9KTsKICAgIH0KICB9Owp9KSgpOwovLyMgc291cmNlTWFwcGluZ1VSTD1pbWFnZS1iaXRtYXAtZGF0YS11cmwtd29ya2VyLUlKcEM3Z19iLmpzLm1hcAo=";
  var decodeBase64 = (base64) => Uint8Array.from(atob(base64), (c2) => c2.charCodeAt(0));
  var blob = typeof window !== "undefined" && window.Blob && new Blob([decodeBase64(encodedJs)], { type: "text/javascript;charset=utf-8" });
  function WorkerWrapper(options) {
    let objURL;
    try {
      objURL = blob && (window.URL || window.webkitURL).createObjectURL(blob);
      if (!objURL) throw "";
      const worker2 = new Worker(objURL, {
        name: options == null ? void 0 : options.name
      });
      worker2.addEventListener("error", () => {
        (window.URL || window.webkitURL).revokeObjectURL(objURL);
      });
      return worker2;
    } catch (e2) {
      return new Worker(
        "data:text/javascript;base64," + encodedJs,
        {
          name: options == null ? void 0 : options.name
        }
      );
    } finally {
      objURL && (window.URL || window.webkitURL).revokeObjectURL(objURL);
    }
  }
  var CanvasManager = class {
    constructor(options) {
      __publicField(this, "pendingCanvasMutations", /* @__PURE__ */ new Map());
      __publicField(this, "rafStamps", { latestId: 0, invokeId: null });
      __publicField(this, "mirror");
      __publicField(this, "mutationCb");
      __publicField(this, "resetObservers");
      __publicField(this, "frozen", false);
      __publicField(this, "locked", false);
      __publicField(this, "processMutation", (target, mutation) => {
        const newFrame = this.rafStamps.invokeId && this.rafStamps.latestId !== this.rafStamps.invokeId;
        if (newFrame || !this.rafStamps.invokeId)
          this.rafStamps.invokeId = this.rafStamps.latestId;
        if (!this.pendingCanvasMutations.has(target)) {
          this.pendingCanvasMutations.set(target, []);
        }
        this.pendingCanvasMutations.get(target).push(mutation);
      });
      const {
        sampling = "all",
        win,
        blockClass,
        blockSelector,
        recordCanvas,
        dataURLOptions
      } = options;
      this.mutationCb = options.mutationCb;
      this.mirror = options.mirror;
      if (recordCanvas && sampling === "all")
        this.initCanvasMutationObserver(win, blockClass, blockSelector);
      if (recordCanvas && typeof sampling === "number")
        this.initCanvasFPSObserver(sampling, win, blockClass, blockSelector, {
          dataURLOptions
        });
    }
    reset() {
      this.pendingCanvasMutations.clear();
      this.resetObservers && this.resetObservers();
    }
    freeze() {
      this.frozen = true;
    }
    unfreeze() {
      this.frozen = false;
    }
    lock() {
      this.locked = true;
    }
    unlock() {
      this.locked = false;
    }
    initCanvasFPSObserver(fps, win, blockClass, blockSelector, options) {
      const canvasContextReset = initCanvasContextObserver(
        win,
        blockClass,
        blockSelector,
        true
      );
      const snapshotInProgressMap = /* @__PURE__ */ new Map();
      const worker2 = new WorkerWrapper();
      worker2.onmessage = (e2) => {
        const { id } = e2.data;
        snapshotInProgressMap.set(id, false);
        if (!("base64" in e2.data)) return;
        const { base64, type, width, height } = e2.data;
        this.mutationCb({
          id,
          type: CanvasContext["2D"],
          commands: [
            {
              property: "clearRect",
              // wipe canvas
              args: [0, 0, width, height]
            },
            {
              property: "drawImage",
              // draws (semi-transparent) image
              args: [
                {
                  rr_type: "ImageBitmap",
                  args: [
                    {
                      rr_type: "Blob",
                      data: [{ rr_type: "ArrayBuffer", base64 }],
                      type
                    }
                  ]
                },
                0,
                0
              ]
            }
          ]
        });
      };
      const timeBetweenSnapshots = 1e3 / fps;
      let lastSnapshotTime = 0;
      let rafId;
      const getCanvas = () => {
        const matchedCanvas = [];
        win.document.querySelectorAll("canvas").forEach((canvas) => {
          if (!isBlocked(canvas, blockClass, blockSelector, true)) {
            matchedCanvas.push(canvas);
          }
        });
        return matchedCanvas;
      };
      const takeCanvasSnapshots = (timestamp) => {
        if (lastSnapshotTime && timestamp - lastSnapshotTime < timeBetweenSnapshots) {
          rafId = requestAnimationFrame(takeCanvasSnapshots);
          return;
        }
        lastSnapshotTime = timestamp;
        getCanvas().forEach(async (canvas) => {
          var _a2;
          const id = this.mirror.getId(canvas);
          if (snapshotInProgressMap.get(id)) return;
          if (canvas.width === 0 || canvas.height === 0) return;
          snapshotInProgressMap.set(id, true);
          if (["webgl", "webgl2"].includes(canvas.__context)) {
            const context = canvas.getContext(canvas.__context);
            if (((_a2 = context == null ? void 0 : context.getContextAttributes()) == null ? void 0 : _a2.preserveDrawingBuffer) === false) {
              context.clear(context.COLOR_BUFFER_BIT);
            }
          }
          const bitmap = await createImageBitmap(canvas);
          worker2.postMessage(
            {
              id,
              bitmap,
              width: canvas.width,
              height: canvas.height,
              dataURLOptions: options.dataURLOptions
            },
            [bitmap]
          );
        });
        rafId = requestAnimationFrame(takeCanvasSnapshots);
      };
      rafId = requestAnimationFrame(takeCanvasSnapshots);
      this.resetObservers = () => {
        canvasContextReset();
        cancelAnimationFrame(rafId);
      };
    }
    initCanvasMutationObserver(win, blockClass, blockSelector) {
      this.startRAFTimestamping();
      this.startPendingCanvasMutationFlusher();
      const canvasContextReset = initCanvasContextObserver(
        win,
        blockClass,
        blockSelector,
        false
      );
      const canvas2DReset = initCanvas2DMutationObserver(
        this.processMutation.bind(this),
        win,
        blockClass,
        blockSelector
      );
      const canvasWebGL1and2Reset = initCanvasWebGLMutationObserver(
        this.processMutation.bind(this),
        win,
        blockClass,
        blockSelector
      );
      this.resetObservers = () => {
        canvasContextReset();
        canvas2DReset();
        canvasWebGL1and2Reset();
      };
    }
    startPendingCanvasMutationFlusher() {
      requestAnimationFrame(() => this.flushPendingCanvasMutations());
    }
    startRAFTimestamping() {
      const setLatestRAFTimestamp = (timestamp) => {
        this.rafStamps.latestId = timestamp;
        requestAnimationFrame(setLatestRAFTimestamp);
      };
      requestAnimationFrame(setLatestRAFTimestamp);
    }
    flushPendingCanvasMutations() {
      this.pendingCanvasMutations.forEach(
        (_values, canvas) => {
          const id = this.mirror.getId(canvas);
          this.flushPendingCanvasMutationFor(canvas, id);
        }
      );
      requestAnimationFrame(() => this.flushPendingCanvasMutations());
    }
    flushPendingCanvasMutationFor(canvas, id) {
      if (this.frozen || this.locked) {
        return;
      }
      const valuesWithType = this.pendingCanvasMutations.get(canvas);
      if (!valuesWithType || id === -1) return;
      const values = valuesWithType.map((value) => {
        const { type: type2, ...rest } = value;
        return rest;
      });
      const { type } = valuesWithType[0];
      this.mutationCb({ id, type, commands: values });
      this.pendingCanvasMutations.delete(canvas);
    }
  };
  var StylesheetManager = class {
    constructor(options) {
      __publicField(this, "trackedLinkElements", /* @__PURE__ */ new WeakSet());
      __publicField(this, "mutationCb");
      __publicField(this, "adoptedStyleSheetCb");
      __publicField(this, "styleMirror", new StyleSheetMirror());
      this.mutationCb = options.mutationCb;
      this.adoptedStyleSheetCb = options.adoptedStyleSheetCb;
    }
    attachLinkElement(linkEl, childSn) {
      if ("_cssText" in childSn.attributes)
        this.mutationCb({
          adds: [],
          removes: [],
          texts: [],
          attributes: [
            {
              id: childSn.id,
              attributes: childSn.attributes
            }
          ]
        });
      this.trackLinkElement(linkEl);
    }
    trackLinkElement(linkEl) {
      if (this.trackedLinkElements.has(linkEl)) return;
      this.trackedLinkElements.add(linkEl);
      this.trackStylesheetInLinkElement(linkEl);
    }
    adoptStyleSheets(sheets, hostId) {
      if (sheets.length === 0) return;
      const adoptedStyleSheetData = {
        id: hostId,
        styleIds: []
      };
      const styles = [];
      for (const sheet of sheets) {
        let styleId;
        if (!this.styleMirror.has(sheet)) {
          styleId = this.styleMirror.add(sheet);
          styles.push({
            styleId,
            rules: Array.from(sheet.rules || CSSRule, (r2, index2) => ({
              rule: stringifyRule(r2, sheet.href),
              index: index2
            }))
          });
        } else styleId = this.styleMirror.getId(sheet);
        adoptedStyleSheetData.styleIds.push(styleId);
      }
      if (styles.length > 0) adoptedStyleSheetData.styles = styles;
      this.adoptedStyleSheetCb(adoptedStyleSheetData);
    }
    reset() {
      this.styleMirror.reset();
      this.trackedLinkElements = /* @__PURE__ */ new WeakSet();
    }
    // TODO: take snapshot on stylesheet reload by applying event listener
    trackStylesheetInLinkElement(_linkEl) {
    }
  };
  var ProcessedNodeManager = class {
    constructor() {
      __publicField(this, "nodeMap", /* @__PURE__ */ new WeakMap());
      __publicField(this, "active", false);
    }
    inOtherBuffer(node2, thisBuffer) {
      const buffers = this.nodeMap.get(node2);
      return buffers && Array.from(buffers).some((buffer) => buffer !== thisBuffer);
    }
    add(node2, buffer) {
      if (!this.active) {
        this.active = true;
        requestAnimationFrame(() => {
          this.nodeMap = /* @__PURE__ */ new WeakMap();
          this.active = false;
        });
      }
      this.nodeMap.set(node2, (this.nodeMap.get(node2) || /* @__PURE__ */ new Set()).add(buffer));
    }
    destroy() {
    }
  };
  var wrappedEmit;
  var takeFullSnapshot$1;
  var canvasManager;
  var recording = false;
  try {
    if (Array.from([1], (x2) => x2 * 2)[0] !== 2) {
      const cleanFrame = document.createElement("iframe");
      document.body.appendChild(cleanFrame);
      Array.from = ((_a = cleanFrame.contentWindow) == null ? void 0 : _a.Array.from) || Array.from;
      document.body.removeChild(cleanFrame);
    }
  } catch (err2) {
    console.debug("Unable to override Array.from", err2);
  }
  var mirror = createMirror$2();
  function record(options = {}) {
    const {
      emit,
      checkoutEveryNms,
      checkoutEveryNth,
      blockClass = "rr-block",
      blockSelector = null,
      ignoreClass = "rr-ignore",
      ignoreSelector = null,
      maskTextClass = "rr-mask",
      maskTextSelector = null,
      inlineStylesheet = true,
      maskAllInputs,
      maskInputOptions: _maskInputOptions,
      slimDOMOptions: _slimDOMOptions,
      maskInputFn,
      maskTextFn,
      hooks,
      packFn,
      sampling = {},
      dataURLOptions = {},
      mousemoveWait,
      recordDOM = true,
      recordCanvas = false,
      recordCrossOriginIframes = false,
      recordAfter = options.recordAfter === "DOMContentLoaded" ? options.recordAfter : "load",
      userTriggeredOnInput = false,
      collectFonts = false,
      inlineImages = false,
      plugins,
      keepIframeSrcFn = () => false,
      ignoreCSSAttributes = /* @__PURE__ */ new Set([]),
      errorHandler: errorHandler2
    } = options;
    registerErrorHandler(errorHandler2);
    const inEmittingFrame = recordCrossOriginIframes ? window.parent === window : true;
    let passEmitsToParent = false;
    if (!inEmittingFrame) {
      try {
        if (window.parent.document) {
          passEmitsToParent = false;
        }
      } catch (e2) {
        passEmitsToParent = true;
      }
    }
    if (inEmittingFrame && !emit) {
      throw new Error("emit function is required");
    }
    if (!inEmittingFrame && !passEmitsToParent) {
      return () => {
      };
    }
    if (mousemoveWait !== void 0 && sampling.mousemove === void 0) {
      sampling.mousemove = mousemoveWait;
    }
    mirror.reset();
    const maskInputOptions = maskAllInputs === true ? {
      color: true,
      date: true,
      "datetime-local": true,
      email: true,
      month: true,
      number: true,
      range: true,
      search: true,
      tel: true,
      text: true,
      time: true,
      url: true,
      week: true,
      textarea: true,
      select: true,
      password: true
    } : _maskInputOptions !== void 0 ? _maskInputOptions : { password: true };
    const slimDOMOptions = slimDOMDefaults(_slimDOMOptions);
    polyfill$1();
    let lastFullSnapshotEvent;
    let incrementalSnapshotCount = 0;
    const eventProcessor = (e2) => {
      for (const plugin3 of plugins || []) {
        if (plugin3.eventProcessor) {
          e2 = plugin3.eventProcessor(e2);
        }
      }
      if (packFn && // Disable packing events which will be emitted to parent frames.
      !passEmitsToParent) {
        e2 = packFn(e2);
      }
      return e2;
    };
    wrappedEmit = (r2, isCheckout) => {
      var _a2;
      const e2 = r2;
      e2.timestamp = nowTimestamp();
      if (((_a2 = mutationBuffers[0]) == null ? void 0 : _a2.isFrozen()) && e2.type !== EventType.FullSnapshot && !(e2.type === EventType.IncrementalSnapshot && e2.data.source === IncrementalSource.Mutation)) {
        mutationBuffers.forEach((buf) => buf.unfreeze());
      }
      if (inEmittingFrame) {
        emit == null ? void 0 : emit(eventProcessor(e2), isCheckout);
      } else if (passEmitsToParent) {
        const message = {
          type: "rrweb",
          event: eventProcessor(e2),
          origin: window.location.origin,
          isCheckout
        };
        window.parent.postMessage(message, "*");
      }
      if (e2.type === EventType.FullSnapshot) {
        lastFullSnapshotEvent = e2;
        incrementalSnapshotCount = 0;
      } else if (e2.type === EventType.IncrementalSnapshot) {
        if (e2.data.source === IncrementalSource.Mutation && e2.data.isAttachIframe) {
          return;
        }
        incrementalSnapshotCount++;
        const exceedCount = checkoutEveryNth && incrementalSnapshotCount >= checkoutEveryNth;
        const exceedTime = checkoutEveryNms && e2.timestamp - lastFullSnapshotEvent.timestamp > checkoutEveryNms;
        if (exceedCount || exceedTime) {
          takeFullSnapshot$1(true);
        }
      }
    };
    const wrappedMutationEmit = (m) => {
      wrappedEmit({
        type: EventType.IncrementalSnapshot,
        data: {
          source: IncrementalSource.Mutation,
          ...m
        }
      });
    };
    const wrappedScrollEmit = (p) => wrappedEmit({
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.Scroll,
        ...p
      }
    });
    const wrappedCanvasMutationEmit = (p) => wrappedEmit({
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.CanvasMutation,
        ...p
      }
    });
    const wrappedAdoptedStyleSheetEmit = (a2) => wrappedEmit({
      type: EventType.IncrementalSnapshot,
      data: {
        source: IncrementalSource.AdoptedStyleSheet,
        ...a2
      }
    });
    const stylesheetManager = new StylesheetManager({
      mutationCb: wrappedMutationEmit,
      adoptedStyleSheetCb: wrappedAdoptedStyleSheetEmit
    });
    const iframeManager = new IframeManager({
      mirror,
      mutationCb: wrappedMutationEmit,
      stylesheetManager,
      recordCrossOriginIframes,
      wrappedEmit
    });
    for (const plugin3 of plugins || []) {
      if (plugin3.getMirror)
        plugin3.getMirror({
          nodeMirror: mirror,
          crossOriginIframeMirror: iframeManager.crossOriginIframeMirror,
          crossOriginIframeStyleMirror: iframeManager.crossOriginIframeStyleMirror
        });
    }
    const processedNodeManager = new ProcessedNodeManager();
    canvasManager = new CanvasManager({
      recordCanvas,
      mutationCb: wrappedCanvasMutationEmit,
      win: window,
      blockClass,
      blockSelector,
      mirror,
      sampling: sampling.canvas,
      dataURLOptions
    });
    const shadowDomManager = new ShadowDomManager({
      mutationCb: wrappedMutationEmit,
      scrollCb: wrappedScrollEmit,
      bypassOptions: {
        blockClass,
        blockSelector,
        maskTextClass,
        maskTextSelector,
        inlineStylesheet,
        maskInputOptions,
        dataURLOptions,
        maskTextFn,
        maskInputFn,
        recordCanvas,
        inlineImages,
        sampling,
        slimDOMOptions,
        iframeManager,
        stylesheetManager,
        canvasManager,
        keepIframeSrcFn,
        processedNodeManager
      },
      mirror
    });
    takeFullSnapshot$1 = (isCheckout = false) => {
      if (!recordDOM) {
        return;
      }
      wrappedEmit(
        {
          type: EventType.Meta,
          data: {
            href: window.location.href,
            width: getWindowWidth(),
            height: getWindowHeight()
          }
        },
        isCheckout
      );
      stylesheetManager.reset();
      shadowDomManager.init();
      mutationBuffers.forEach((buf) => buf.lock());
      const node2 = snapshot(document, {
        mirror,
        blockClass,
        blockSelector,
        maskTextClass,
        maskTextSelector,
        inlineStylesheet,
        maskAllInputs: maskInputOptions,
        maskTextFn,
        maskInputFn,
        slimDOM: slimDOMOptions,
        dataURLOptions,
        recordCanvas,
        inlineImages,
        onSerialize: (n2) => {
          if (isSerializedIframe(n2, mirror)) {
            iframeManager.addIframe(n2);
          }
          if (isSerializedStylesheet(n2, mirror)) {
            stylesheetManager.trackLinkElement(n2);
          }
          if (hasShadowRoot(n2)) {
            shadowDomManager.addShadowRoot(index.shadowRoot(n2), document);
          }
        },
        onIframeLoad: (iframe, childSn) => {
          iframeManager.attachIframe(iframe, childSn);
          shadowDomManager.observeAttachShadow(iframe);
        },
        onStylesheetLoad: (linkEl, childSn) => {
          stylesheetManager.attachLinkElement(linkEl, childSn);
        },
        keepIframeSrcFn
      });
      if (!node2) {
        return console.warn("Failed to snapshot the document");
      }
      wrappedEmit(
        {
          type: EventType.FullSnapshot,
          data: {
            node: node2,
            initialOffset: getWindowScroll(window)
          }
        },
        isCheckout
      );
      mutationBuffers.forEach((buf) => buf.unlock());
      if (document.adoptedStyleSheets && document.adoptedStyleSheets.length > 0)
        stylesheetManager.adoptStyleSheets(
          document.adoptedStyleSheets,
          mirror.getId(document)
        );
    };
    try {
      const handlers = [];
      const observe = (doc) => {
        var _a2;
        return callbackWrapper(initObservers)(
          {
            mutationCb: wrappedMutationEmit,
            mousemoveCb: (positions, source) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source,
                positions
              }
            }),
            mouseInteractionCb: (d) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.MouseInteraction,
                ...d
              }
            }),
            scrollCb: wrappedScrollEmit,
            viewportResizeCb: (d) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.ViewportResize,
                ...d
              }
            }),
            inputCb: (v2) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.Input,
                ...v2
              }
            }),
            mediaInteractionCb: (p) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.MediaInteraction,
                ...p
              }
            }),
            styleSheetRuleCb: (r2) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.StyleSheetRule,
                ...r2
              }
            }),
            styleDeclarationCb: (r2) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.StyleDeclaration,
                ...r2
              }
            }),
            canvasMutationCb: wrappedCanvasMutationEmit,
            fontCb: (p) => wrappedEmit({
              type: EventType.IncrementalSnapshot,
              data: {
                source: IncrementalSource.Font,
                ...p
              }
            }),
            selectionCb: (p) => {
              wrappedEmit({
                type: EventType.IncrementalSnapshot,
                data: {
                  source: IncrementalSource.Selection,
                  ...p
                }
              });
            },
            customElementCb: (c2) => {
              wrappedEmit({
                type: EventType.IncrementalSnapshot,
                data: {
                  source: IncrementalSource.CustomElement,
                  ...c2
                }
              });
            },
            blockClass,
            ignoreClass,
            ignoreSelector,
            maskTextClass,
            maskTextSelector,
            maskInputOptions,
            inlineStylesheet,
            sampling,
            recordDOM,
            recordCanvas,
            inlineImages,
            userTriggeredOnInput,
            collectFonts,
            doc,
            maskInputFn,
            maskTextFn,
            keepIframeSrcFn,
            blockSelector,
            slimDOMOptions,
            dataURLOptions,
            mirror,
            iframeManager,
            stylesheetManager,
            shadowDomManager,
            processedNodeManager,
            canvasManager,
            ignoreCSSAttributes,
            plugins: ((_a2 = plugins == null ? void 0 : plugins.filter((p) => p.observer)) == null ? void 0 : _a2.map((p) => ({
              observer: p.observer,
              options: p.options,
              callback: (payload) => wrappedEmit({
                type: EventType.Plugin,
                data: {
                  plugin: p.name,
                  payload
                }
              })
            }))) || []
          },
          hooks
        );
      };
      iframeManager.addLoadListener((iframeEl) => {
        try {
          handlers.push(observe(iframeEl.contentDocument));
        } catch (error) {
          console.warn(error);
        }
      });
      const init2 = () => {
        takeFullSnapshot$1();
        handlers.push(observe(document));
        recording = true;
      };
      if (["interactive", "complete"].includes(document.readyState)) {
        init2();
      } else {
        handlers.push(
          on("DOMContentLoaded", () => {
            wrappedEmit({
              type: EventType.DomContentLoaded,
              data: {}
            });
            if (recordAfter === "DOMContentLoaded") init2();
          })
        );
        handlers.push(
          on(
            "load",
            () => {
              wrappedEmit({
                type: EventType.Load,
                data: {}
              });
              if (recordAfter === "load") init2();
            },
            window
          )
        );
      }
      return () => {
        handlers.forEach((handler) => {
          try {
            handler();
          } catch (error) {
            const msg = String(error).toLowerCase();
            if (!msg.includes("cross-origin")) {
              console.warn(error);
            }
          }
        });
        processedNodeManager.destroy();
        recording = false;
        unregisterErrorHandler();
      };
    } catch (error) {
      console.warn(error);
    }
  }
  record.addCustomEvent = (tag, payload) => {
    if (!recording) {
      throw new Error("please add custom event after start recording");
    }
    wrappedEmit({
      type: EventType.Custom,
      data: {
        tag,
        payload
      }
    });
  };
  record.freezePage = () => {
    mutationBuffers.forEach((buf) => buf.freeze());
  };
  record.takeFullSnapshot = (isCheckout) => {
    if (!recording) {
      throw new Error("please take full snapshot after start recording");
    }
    takeFullSnapshot$1(isCheckout);
  };
  record.mirror = mirror;
  var n;
  !(function(t2) {
    t2[t2.NotStarted = 0] = "NotStarted", t2[t2.Running = 1] = "Running", t2[t2.Stopped = 2] = "Stopped";
  })(n || (n = {}));

  // src/record.js
  var stopFn = null;
  function startRecording() {
    if (stopFn) {
      return;
    }
    stopFn = record({
      emit(event) {
        pushEvent3(event);
      },
      checkoutEveryNms: 3e4,
      inlineStylesheet: true,
      collectFonts: true,
      recordCSSVariables: true,
      inlineImages: false,
      maskInputOptions: { password: true },
      blockSelector: "[data-ql-block]",
      ignoreSelector: "[data-ql-ignore]",
      sampling: {
        mousemove: 50,
        scroll: 100,
        input: "last"
      }
    });
  }
  function stopRecording() {
    if (stopFn && typeof stopFn === "function") {
      stopFn();
      stopFn = null;
    }
  }
  async function ensureSessionStarted() {
    return await startSession();
  }

  // src/init.js
  var DEFAULT_API_URL = "https://localhost:3080";
  var KNOWN_OPTIONS = /* @__PURE__ */ new Set(["apiUrl", "retentionDays", "captureStorage", "workerUrl", "excludedUrls", "includedUrls", "inactivityTimeout", "pauseOnHidden", "maxSessionDuration"]);
  function pushEventAndMaybeStart(ev) {
    pushEvent3(ev);
  }
  var recordingStarted = false;
  var stopRecord = null;
  function patchHistoryAPI(pushEventFn, onNavigate) {
    if (typeof window === "undefined" || typeof history === "undefined") return;
    const afterNav = () => {
      pushEventFn({
        type: 4,
        // Meta event
        data: { href: window.location.href },
        timestamp: Date.now()
      });
      if (typeof onNavigate === "function") onNavigate();
    };
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) {
      const result2 = originalPushState.apply(this, args);
      afterNav();
      return result2;
    };
    history.replaceState = function(...args) {
      const result2 = originalReplaceState.apply(this, args);
      afterNav();
      return result2;
    };
    window.addEventListener("popstate", afterNav);
  }
  var initCalled = false;
  function init(projectKey2, options = {}) {
    if (initCalled) {
      return;
    }
    initCalled = true;
    const apiUrl2 = options.apiUrl || DEFAULT_API_URL;
    const meta2 = captureDeviceMeta();
    const user2 = getIdentity();
    if (options.captureStorage) {
      try {
        meta2.localStorageSnapshot = captureStorageSnapshot();
      } catch (e) {
      }
    }
    const custom = {};
    for (const key of Object.keys(options)) {
      if (KNOWN_OPTIONS.has(key)) continue;
      const v = options[key];
      if (v !== void 0 && v !== null) custom[key] = v;
    }
    const apiUrlNorm = apiUrl2.replace(/\/$/, "");
    setConfig({
      apiUrl: apiUrlNorm,
      projectKey: String(projectKey2),
      meta: meta2,
      user: user2,
      retentionDays: options.retentionDays ?? 30,
      attributes: Object.keys(custom).length ? custom : void 0,
      excludedUrls: options.excludedUrls,
      includedUrls: options.includedUrls,
      maxSessionDuration: options.maxSessionDuration !== void 0 ? options.maxSessionDuration : 60 * 60 * 1e3
    });
    setActivityConfig({
      inactivityTimeout: options.inactivityTimeout !== void 0 ? options.inactivityTimeout : 5 * 60 * 1e3,
      pauseOnHidden: options.pauseOnHidden !== void 0 ? options.pauseOnHidden : true
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
          startRecording();
          startScheduler();
        }
      }
    );
    patchConsole(pushEventAndMaybeStart);
    patchNetwork(pushEventAndMaybeStart, apiUrlNorm);
    if (options.workerUrl !== false) {
      const script = typeof document !== "undefined" && document.currentScript;
      const base = script && script.src ? script.src.replace(/\/[^/]*$/, "/") : "";
      const baseOrApi = base || apiUrlNorm + "/";
      const workerUrl2 = options.workerUrl || baseOrApi + "compress.worker.js";
      setWorkerUrl(workerUrl2);
      try {
        const w = new Worker(workerUrl2);
        setWorker(w);
      } catch (e) {
      }
    }
    async function startRecordingOnPage() {
      const sessionId2 = await ensureSessionStarted();
      if (!sessionId2) return false;
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
          const r = await fetch(`${apiUrlNorm}/api/quicklook/projects/${encodeURIComponent(projectKey2)}/config`);
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
        } catch (_) {
        }
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
  }
  function stop() {
    stopActivityMonitoring();
    if (stopRecord) stopRecord();
    flushAndEnd();
    endSession(void 0, { clearStorage: true });
  }
  function getSessionIdPublic(cb) {
    const id = getSessionId();
    if (typeof cb === "function") cb(id);
    return id;
  }
  function createQuicklook() {
    const api2 = {
      init,
      identify,
      stop,
      getSessionId: getSessionIdPublic
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => {
        if (recordingStarted) {
          flushAndEnd();
        }
      });
      window.addEventListener("beforeunload", () => {
        if (recordingStarted) {
          flushAndEnd();
        }
      });
    }
    return api2;
  }

  // src/index.js
  var api = createQuicklook();
  function dispatch(cmd, ...args) {
    if (api[cmd]) api[cmd](...args);
  }
  function quicklookGlobal() {
    const q = window.quicklook && window.quicklook.q;
    if (Array.isArray(q)) {
      while (q.length) {
        const a = q.shift();
        if (a && a.length) dispatch(a[0], ...Array.prototype.slice.call(a, 1));
      }
    }
    if (arguments.length) {
      dispatch(arguments[0], ...Array.prototype.slice.call(arguments, 1));
    }
  }
  if (typeof window !== "undefined") {
    setupQueue();
    const prev = window.quicklook;
    const prevQ = prev && prev.q || [];
    window.quicklook = quicklookGlobal;
    window.quicklook.q = prevQ;
    Object.defineProperty(window.quicklook, "sessionId", {
      get() {
        return getSessionId();
      },
      configurable: true,
      enumerable: true
    });
    quicklookGlobal();
  }
})();
/*! Bundled license information:

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
