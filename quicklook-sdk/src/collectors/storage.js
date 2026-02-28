const VALUE_MAX = 200;
const BLOCKLIST = ["token", "password", "secret", "auth", "key"];

function blockKey(key) {
  const k = String(key).toLowerCase();
  return BLOCKLIST.some((b) => k.includes(b));
}

export function captureStorageSnapshot() {
  if (typeof localStorage === "undefined") return null;
  try {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !blockKey(key)) {
        const v = localStorage.getItem(key);
        out[key] = v != null ? String(v).slice(0, VALUE_MAX) : "";
      }
    }
    return out;
  } catch {
    return null;
  }
}
