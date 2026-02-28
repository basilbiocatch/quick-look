import { record } from "@rrweb/record";
import { pushEvent } from "./upload.js";
import { startSession } from "./session.js";

let stopFn = null;

export function startRecording() {
  if (stopFn) return;
  stopFn = record({
    emit(event) {
      pushEvent(event);
    },
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
      input: "last",
    },
  });
}

export function stopRecording() {
  if (stopFn && typeof stopFn === "function") {
    stopFn();
    stopFn = null;
  }
}

export async function ensureSessionStarted() {
  await startSession();
}
