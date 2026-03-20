import { record } from "@rrweb/record";
import { pushEvent } from "./upload.js";
import { startSession } from "./session.js";

let stopFn = null;
let recordingOptions = {
  inlineStylesheet: false,
  collectFonts: false,
  slimDOM: true,
};

export function setRecordingOptions(options) {
  recordingOptions = { ...recordingOptions, ...options };
}

export function startRecording() {
  if (stopFn) {
    return;
  }
  
  const slimDOMOptions = recordingOptions.slimDOM ? {
    script: true,
    comment: true,
    headFavicon: true,
    headWhitespace: true,
    headMetaDescKeywords: true,
    headMetaSocial: true,
    headMetaRobots: true,
    headMetaHttpEquiv: true,
    headMetaAuthorship: true,
    headMetaVerification: true,
  } : {};
  
  stopFn = record({
    emit(event) {
      pushEvent(event);
    },
    checkoutEveryNms: 30000,
    inlineStylesheet: recordingOptions.inlineStylesheet,
    collectFonts: recordingOptions.collectFonts,
    recordCSSVariables: recordingOptions.inlineStylesheet,
    inlineImages: false,
    maskInputOptions: { password: true },
    blockSelector: "[data-ql-block]",
    ignoreSelector: "[data-ql-ignore]",
    sampling: {
      mousemove: 50,
      scroll: 100,
      input: "last",
    },
    slimDOMOptions,
  });
}

export function stopRecording() {
  if (stopFn && typeof stopFn === "function") {
    try {
      stopFn();
    } catch (e) {
      // rrweb cleanup can throw SecurityError when removing listeners in cross-origin iframes
      // or when the document is in a restricted state (e.g. during visibilitychange).
      if (e?.name === "SecurityError" || (e?.message && String(e.message).toLowerCase().includes("security"))) {
        // Recording is effectively stopped; swallow so visibility/inactivity flow doesn't break
      } else {
        throw e;
      }
    }
    stopFn = null;
  }
}

export async function ensureSessionStarted() {
  return await startSession();
}
