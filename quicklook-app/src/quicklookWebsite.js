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

const STORAGE_KEY = "quicklook_website_identity";

export function initQuicklookWebsite() {
  if (typeof window === "undefined") return;

  const sdkBase = getSdkBase();

  const script = document.createElement("script");
  script.src = `${sdkBase}/quicklook-sdk.js`;
  script.async = true;
  script.onload = () => {
    try {
      if (window.quicklook) {
        window.quicklook("init", WEBSITE_PROJECT_KEY, {
          apiUrl: sdkBase,
          inlineStylesheet: false,
          collectFonts: false,
          slimDOM: true,
          blockClass: 'ql-block',        // Don't record elements with this class
          blockSelector: '[data-ql-block]', // Don't record elements matching this
          ignoreClass: 'ql-ignore',      // Don't record these elements
          maskTextClass: 'ql-mask',      // Mask text in these elements
          maskAllInputs: true,           // Mask all input values
          maskInputOptions: {            // Fine-grained input masking
            password: true,
            email: true,
          },
          sampling: {
            mousemove: true,             // Sample mouse movements
            mouseInteraction: true,      // Sample clicks
            scroll: 150,                 // Sample scroll every 150ms
            input: 'last',               // Only record last input value
          },
          // Don't record these tags:
          slimDOMOptions: {
            script: true,                // Don't record <script> content
            comment: true,               // Don't record HTML comments
            headFavicon: true,           // Don't record favicons
            headWhitespace: true,        // Remove whitespace in <head>
            headMetaDescKeywords: true,  // Remove meta description/keywords
            headMetaSocial: true,        // Remove social meta tags (og:, twitter:)
          },
        });
        // Apply persisted identity so it's available after refresh (auth restores user after SDK loads)
        try {
          const stored = typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_KEY);
          if (stored) {
            const data = JSON.parse(stored);
            if (data && typeof data === "object" && window.quicklook) {
              window.quicklook("identify", data);
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  };
  document.head.appendChild(script);
}

export function setQuicklookWebsiteIdentity(identity) {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
  if (identity && (identity.email || identity.firstName || identity.lastName)) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    if (window.quicklook) {
      window.quicklook("identify", identity);
    }
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
    if (window.quicklook) {
      window.quicklook("identify", {});
    }
  }
}
