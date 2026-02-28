const MAX_CONSOLE_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 1024;
let count = 0;
let pushEvent;

function serializeArgs(args) {
  try {
    const str = JSON.stringify(Array.from(args).map((a) => (typeof a === "object" ? String(a) : a)));
    return str.length > MAX_MESSAGE_LENGTH ? str.slice(0, MAX_MESSAGE_LENGTH) + "…" : str;
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
        timestamp: Date.now(),
      },
    },
    timestamp: Date.now(),
  });
}

export function patchConsole(pushEventFn) {
  pushEvent = pushEventFn;
  if (typeof console === "undefined") return;
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  ["log", "info", "warn", "error"].forEach((level) => {
    console[level] = function (...args) {
      capture(level, args);
      orig[level].apply(console, args);
    };
  });
}
