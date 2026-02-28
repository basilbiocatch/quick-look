/**
 * One-time device/browser meta capture.
 */
export function captureDeviceMeta() {
  const conn = typeof navigator !== "undefined" && navigator.connection;
  return {
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    platform: typeof navigator !== "undefined" ? navigator.platform : "",
    language: typeof navigator !== "undefined" ? navigator.language : "",
    languages: typeof navigator !== "undefined" && Array.isArray(navigator.languages) ? navigator.languages : [],
    screen:
      typeof screen !== "undefined"
        ? { width: screen.width, height: screen.height, colorDepth: screen.colorDepth || 24 }
        : { width: 0, height: 0, colorDepth: 24 },
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 0, height: 0 },
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    timezone:
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "",
    cookieEnabled: typeof navigator !== "undefined" ? navigator.cookieEnabled : false,
    doNotTrack: typeof navigator !== "undefined" ? navigator.doNotTrack : null,
    connection:
      conn && typeof conn === "object"
        ? {
            type: conn.type || "",
            effectiveType: conn.effectiveType || "",
            downlink: conn.downlink,
            rtt: conn.rtt,
          }
        : undefined,
  };
}
