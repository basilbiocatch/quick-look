/**
 * Loads and initializes the QuickLook SDK on the QuickLook marketing/dashboard website
 * so we record sessions on quicklook.io itself. Runs once at app bootstrap; applies to all pages (SPA).
 * On localhost: uses local API so sessions/start and recording go to your local server.
 * On quicklook.io: uses production server for SDK script and apiUrl.
 */
const WEBSITE_PROJECT_KEY = "05cd44c5df21f06b6c59a666";

/** Production server that serves quicklook-sdk.js and the recording API. */
const PRODUCTION_SDK_BASE = "https://quicklook.io";

function getSdkBase() {
  if (typeof window === "undefined") return PRODUCTION_SDK_BASE;
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:3080`;
  }
  return PRODUCTION_SDK_BASE;
}

export function initQuicklookWebsite() {
  if (typeof window === "undefined") return;

  const sdkBase = getSdkBase();

  const script = document.createElement("script");
  script.src = `${sdkBase}/quicklook-sdk.js`;
  script.async = true;
  script.onload = () => {
    try {
      if (window.quicklook) {
        window.quicklook("init", WEBSITE_PROJECT_KEY, { apiUrl: sdkBase });
      }
    } catch (_) {}
  };
  document.head.appendChild(script);
}
