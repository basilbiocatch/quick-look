import { setupQueue } from "./shim.js";
import { createQuicklook } from "./init.js";
import { getSessionId } from "./session.js";

const api = createQuicklook();

function dispatch(cmd, ...args) {
  if (api[cmd]) return api[cmd](...args);
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
    return dispatch(arguments[0], ...Array.prototype.slice.call(arguments, 1));
  }
}

if (typeof window !== "undefined") {
  setupQueue();
  const prev = window.quicklook;
  const prevQ = (prev && prev.q) || [];
  window.quicklook = quicklookGlobal;
  window.quicklook.q = prevQ;
  Object.defineProperty(window.quicklook, "sessionId", {
    get() {
      return getSessionId();
    },
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(window.quicklook, "identity", {
    get() {
      return api.getIdentity();
    },
    configurable: true,
    enumerable: true,
  });
  quicklookGlobal();
}

export { quicklookGlobal as quicklook };
