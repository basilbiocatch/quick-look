let pushEvent;
let apiBase = "";
const BLOCKLIST = ["/api/quicklook/", "quicklook", "sessions/start", "sessions/", "/chunk", "/end"];

function isQuicklookUrl(url) {
  if (!url || !apiBase) return false;
  try {
    const u = typeof url === "string" ? url : url.toString();
    // Check if URL starts with apiBase OR contains any blocklist pattern
    if (u.startsWith(apiBase)) return true;
    return BLOCKLIST.some((p) => u.includes(p));
  } catch {
    return false;
  }
}

function captureNetwork(method, url, status, duration, responseSize) {
  if (!pushEvent) return;
  pushEvent({
    type: 5,
    data: {
      tag: "ql_network",
      payload: { method, url, status, duration, responseSize, timestamp: Date.now() },
    },
    timestamp: Date.now(),
  });
}

export function patchNetwork(pushEventFn, apiUrl) {
  pushEvent = pushEventFn;
  apiBase = apiUrl ? apiUrl.replace(/\/$/, "") : "";
  if (typeof window === "undefined") return;

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input?.url;
    if (isQuicklookUrl(url)) {
      // Don't record Quicklook's own API calls
      return origFetch.apply(this, arguments);
    }
    const start = Date.now();
    return origFetch.apply(this, arguments).then(
      (res) => {
        const duration = Date.now() - start;
        res.clone().text().then((t) => {
          captureNetwork((init?.method || "GET").toUpperCase(), url, res.status, duration, t.length);
        });
        return res;
      },
      () => {
        captureNetwork((init?.method || "GET").toUpperCase(), url, 0, Date.now() - start, 0);
        throw arguments[0];
      }
    );
  };

  const XHR = window.XMLHttpRequest;
  if (XHR) {
    window.XMLHttpRequest = function () {
      const xhr = new XHR();
      const open = xhr.open;
      let method, url, start;
      xhr.open = function (m, u) {
        method = m;
        url = u;
        return open.apply(this, arguments);
      };
      xhr.addEventListener("loadend", function () {
        if (isQuicklookUrl(url)) return;
        const duration = start ? Date.now() - start : 0;
        captureNetwork(method || "GET", url, xhr.status, duration, xhr.responseText?.length || 0);
      });
      xhr.addEventListener("loadstart", function () {
        start = Date.now();
      });
      return xhr;
    };
  }
}
