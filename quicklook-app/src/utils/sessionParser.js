export function parseDevice(ua) {
  if (!ua) return "Unknown";
  if (/Mobile|Android|iPhone/.test(ua)) return "Mobile";
  if (/iPad|Tablet/.test(ua)) return "Tablet";
  return "Desktop";
}

export function parseOS(ua) {
  if (!ua) return "Unknown";
  if (/Mac OS X/.test(ua)) return "Mac OS X";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/Linux/.test(ua)) return "Linux";
  if (/iPhone|iPad/.test(ua)) return "iOS";
  return "Unknown";
}

export function parseBrowser(ua) {
  if (!ua) return "Unknown";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

export function formatTimecode(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function formatDuration(ms) {
  const s = Math.floor((ms || 0) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Country code (ISO 3166-1 alpha-2) to flag emoji */
export function getCountryFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return null;
  const a = 0x1f1e6; // 'A' regional indicator
  const code = countryCode.toUpperCase();
  const first = a + (code.charCodeAt(0) - 65);
  const second = a + (code.charCodeAt(1) - 65);
  if (first < 0x1f1e6 || first > 0x1f1ff || second < 0x1f1e6 || second > 0x1f1ff) return null;
  return String.fromCodePoint(first, second);
}
