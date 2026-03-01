/**
 * Build a list of human-readable activities from rrweb events for the right panel.
 * rrweb: type 2=FullSnapshot, 3=IncrementalSnapshot, 4=Meta, 5=Custom
 * IncrementalSource: MouseInteraction=2, Scroll=3, ViewportResize=4, Input=5
 * MouseInteractionType: Click=0, etc.
 */
const EventType = { FullSnapshot: 2, IncrementalSnapshot: 3, Meta: 4, Custom: 5 };
const IncrementalSource = { MouseInteraction: 2, Input: 5 };

function formatActivityTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function buildActivityList(events) {
  if (!Array.isArray(events) || events.length === 0) return [];
  const baseTime = events[0].timestamp || 0;
  const activities = [];

  for (const e of events) {
    const offset = (e.timestamp || 0) - baseTime;
    const timeStr = formatActivityTime(offset);

    if (e.type === EventType.Meta && e.data?.href) {
      activities.push({
        type: "url",
        label: "URL",
        time: timeStr,
        timeMs: offset,
        detail: e.data.href,
        icon: "url",
      });
    } else if (e.type === EventType.Custom && e.data) {
      const name = e.data.name || e.data.tag || "Custom";
      activities.push({
        type: "custom",
        label: "Custom",
        time: timeStr,
        timeMs: offset,
        detail: name,
        icon: "code",
      });
    } else if (e.type === EventType.IncrementalSnapshot && e.data) {
      const src = e.data.source;
      if (src === IncrementalSource.MouseInteraction) {
        const t = e.data.type;
        if (t === 0) {
          activities.push({
            type: "click",
            label: "Click",
            time: timeStr,
            timeMs: offset,
            detail: e.data.id != null ? `node #${e.data.id}` : "",
            icon: "click",
          });
        }
      } else if (src === IncrementalSource.Input) {
        activities.push({
          type: "input",
          label: "Input",
          time: timeStr,
          timeMs: offset,
          detail: "",
          icon: "input",
        });
      }
    }
  }

  return activities;
}

/**
 * Compress only long idle gaps so replay stays at 1x through short activity bursts.
 * Gaps longer than thresholdMs are replaced by compressedMs (e.g. skip 5 min → 2 s).
 * Use with skipInactive: false in rrweb so we control skip behavior.
 * @param {Array} events - rrweb events (will be shallow-cloned; timestamps modified)
 * @param {number} thresholdMs - only compress gaps larger than this (e.g. 30000 = 30 s)
 * @param {number} compressedMs - replace long gaps with this (e.g. 2000 = 2 s)
 * @returns {Array} new event array with adjusted timestamps
 */
export function compressLongGaps(events, thresholdMs = 30 * 1000, compressedMs = 2 * 1000) {
  if (!Array.isArray(events) || events.length === 0) return events;
  const baseline = events[0].timestamp ?? 0;
  let logicalTime = 0;
  return events.map((event, i) => {
    const prevTimestamp = i === 0 ? baseline : events[i - 1].timestamp ?? baseline;
    const ts = event.timestamp ?? baseline;
    if (i > 0) {
      const gap = Math.max(0, ts - prevTimestamp);
      logicalTime += gap > thresholdMs ? compressedMs : gap;
    }
    const newTimestamp = baseline + logicalTime;
    return { ...event, timestamp: newTimestamp };
  });
}

/** Get duration in ms from first to last event timestamp */
export function getEventsDurationMs(events) {
  if (!Array.isArray(events) || events.length < 2) return 0;
  const first = events[0].timestamp || 0;
  const last = events[events.length - 1].timestamp || 0;
  return Math.max(0, last - first);
}

/** Get sorted unique timeMs for all notable events (URL, click, input, custom) for timeline marks. Limited to maxMarks. */
export function getEventMarksFromEvents(events, maxMarks = 150) {
  if (!Array.isArray(events)) return [];
  const activities = buildActivityList(events);
  const timeSet = new Set(activities.map((a) => a.timeMs));
  const sorted = Array.from(timeSet).sort((a, b) => a - b);
  if (sorted.length <= maxMarks) return sorted;
  const step = (sorted.length - 1) / (maxMarks - 1);
  return Array.from({ length: maxMarks }, (_, i) => sorted[Math.round(i * step)]);
}

/** Event type for timeline mark styling */
export const EVENT_MARK_TYPES = { URL: "url", CLICK: "click", INPUT: "input", CUSTOM: "custom" };

/** Get timeline marks with type for styling (bigger, colored per type). Returns { timeMs, type }[], limited to maxMarks, no duplicate positions. */
export function getEventMarksWithTypes(events, maxMarks = 150) {
  if (!Array.isArray(events)) return [];
  const activities = buildActivityList(events);
  const byTime = new Map();
  for (const a of activities) {
    if (!byTime.has(a.timeMs)) byTime.set(a.timeMs, a.type);
  }
  const sorted = Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timeMs, type]) => ({ timeMs, type }));
  if (sorted.length <= maxMarks) return sorted;
  const step = (sorted.length - 1) / (maxMarks - 1);
  const result = [];
  const seen = new Set();
  for (let i = 0; i < maxMarks; i++) {
    const item = sorted[Math.min(Math.round(i * step), sorted.length - 1)];
    if (!seen.has(item.timeMs)) {
      seen.add(item.timeMs);
      result.push(item);
    }
  }
  return result;
}

/** Normalize URL to page only (origin + pathname), no search or hash. Used for exclusion matching. */
export function urlPageKey(url) {
  if (!url || typeof url !== "string") return url || "";
  try {
    const u = new URL(url);
    return u.origin + (u.pathname || "/");
  } catch {
    return url;
  }
}

/** Get list of page (URL) changes for navigation: { timeMs, url } */
export function getPagesFromEvents(events) {
  if (!Array.isArray(events)) return [];
  const baseTime = events[0]?.timestamp || 0;
  const pages = [];
  for (const e of events) {
    if (e.type === 4 && e.data?.href) {
      pages.push({
        timeMs: (e.timestamp || 0) - baseTime,
        url: e.data.href,
      });
    }
  }
  return pages;
}
