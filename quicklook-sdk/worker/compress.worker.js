import pako from "pako";

self.onmessage = function (e) {
  const { index, events } = e.data || {};
  if (!Array.isArray(events)) return;
  try {
    const json = JSON.stringify(events);
    const compressed = pako.gzip(json);
    const len = compressed.length;
    let b64 = "";
    const chunk = 8192;
    for (let i = 0; i < len; i += chunk) {
      b64 += String.fromCharCode.apply(null, compressed.subarray(i, i + chunk));
    }
    b64 = btoa(b64);
    self.postMessage({ index, data: b64 });
  } catch (err) {
    self.postMessage({ index, error: String(err.message) });
  }
};
