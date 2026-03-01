/** Base path for the app (e.g. "" at dev root, "/app" when served under /app). No trailing slash. */
export function getBasePath() {
  return (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";
}

/** URL for a public asset (e.g. logo.png). Works in dev and when app is served under a subpath. */
export function getPublicAssetUrl(path) {
  const base = getBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return base === "/" ? normalized : `${base}${normalized}`;
}
