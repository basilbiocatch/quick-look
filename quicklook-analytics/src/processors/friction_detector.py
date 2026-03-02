"""
Rule-based friction detection from rrweb events.
Detects: rage clicks, hover confusion, scroll confusion, long hesitation before click.
"""
from typing import Any

from src.utils.event_parser import TYPE_INCREMENTAL

# rrweb incremental event data.source (IncrementalSource)
SOURCE_MOUSE_MOVE = 1
SOURCE_MOUSE_INTERACTION = 2
SOURCE_SCROLL = 3

# Thresholds (plan-aligned)
HOVER_HESITATION_MS = 3000
HOVER_HESITATION_HIGH_MS = 5000
RAGE_CLICK_COUNT = 3
RAGE_CLICK_WINDOW_MS = 1000
SCROLL_CONFUSION_MIN_CHANGES = 3
SCROLL_WINDOW_MIN_EVENTS = 4


def _incremental_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Events with type 3 (incremental), with data."""
    return [e for e in events if e.get("type") == TYPE_INCREMENTAL and isinstance(e.get("data"), dict)]


def _clicks(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mouse interaction events that are clicks (source 2, type 'click' or similar)."""
    out = []
    for e in events:
        d = e.get("data") or {}
        if d.get("source") != SOURCE_MOUSE_INTERACTION:
            continue
        # rrweb: type can be 0 (click) or string 'click'
        t = d.get("type")
        if t == 0 or t == "click" or (isinstance(t, int) and t <= 2):
            out.append(e)
    return out


def _scrolls(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Scroll events (source 3)."""
    return [e for e in events if (e.get("data") or {}).get("source") == SOURCE_SCROLL]


def _mouse_moves(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mouse move events (source 1). data may have x, y or positions."""
    return [e for e in events if (e.get("data") or {}).get("source") == SOURCE_MOUSE_MOVE]


def _element_id(click_event: dict[str, Any]) -> int | None:
    d = click_event.get("data") or {}
    return d.get("id") if isinstance(d.get("id"), int) else None


def _same_element(c1: dict, c2: dict) -> bool:
    id1 = _element_id(c1)
    id2 = _element_id(c2)
    if id1 is None or id2 is None:
        # Fallback: same x,y within a few px
        x1, y1 = (c1.get("data") or {}).get("x"), (c1.get("data") or {}).get("y")
        x2, y2 = (c2.get("data") or {}).get("x"), (c2.get("data") or {}).get("y")
        if None in (x1, y1, x2, y2):
            return False
        return abs(x1 - x2) <= 10 and abs(y1 - y2) <= 10
    return id1 == id2


def detect_rage_clicks(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detect 3+ clicks on same element within 1s."""
    clicks = _clicks(events)
    rage = []
    i = 0
    while i <= len(clicks) - RAGE_CLICK_COUNT:
        window = clicks[i : i + RAGE_CLICK_COUNT]
        ts0 = window[0].get("timestamp") or 0
        ts1 = window[-1].get("timestamp") or 0
        if ts1 - ts0 > RAGE_CLICK_WINDOW_MS:
            i += 1
            continue
        if all(_same_element(window[0], c) for c in window):
            rage.append({
                "type": "rage_click",
                "timestamp": ts0,
                "element": {"id": _element_id(window[0]), "x": (window[0].get("data") or {}).get("x"), "y": (window[0].get("data") or {}).get("y")},
                "severity": "critical",
                "duration": 0,
                "context": f"Rapid {len(window)} clicks on same element",
            })
            i += RAGE_CLICK_COUNT
        else:
            i += 1
    return rage


def _hover_duration_ms(mouse_moves: list[dict], click_x: float | None, click_y: float | None, click_ts: int) -> float:
    """Estimate how long the mouse was near (click_x, click_y) before click_ts. Returns ms."""
    if click_x is None or click_y is None:
        return 0.0
    # Look at moves in last 10s before click
    window_ms = 10_000
    relevant = [
        m for m in mouse_moves
        if (m.get("timestamp") or 0) <= click_ts and (click_ts - (m.get("timestamp") or 0)) <= window_ms
    ]
    if not relevant:
        return 0.0
    # Sort by timestamp ascending
    relevant.sort(key=lambda m: m.get("timestamp") or 0)
    # Check positions: rrweb can have data.x/y or data.positions (list of {x,y})
    tolerance = 30
    start_ts = None
    for m in relevant:
        d = m.get("data") or {}
        x, y = d.get("x"), d.get("y")
        if x is None and d.get("positions"):
            pos = d["positions"]
            if pos and isinstance(pos[0], dict):
                x, y = pos[0].get("x"), pos[0].get("y")
            elif pos and isinstance(pos[0], (list, tuple)) and len(pos[0]) >= 2:
                x, y = pos[0][0], pos[0][1]
        if x is not None and y is not None and abs(x - click_x) <= tolerance and abs(y - click_y) <= tolerance:
            if start_ts is None:
                start_ts = m.get("timestamp") or 0
        else:
            if start_ts is not None:
                return (click_ts - start_ts) / 1.0  # timestamps in ms
            start_ts = None
    if start_ts is not None:
        return (click_ts - start_ts) / 1.0
    return 0.0


def detect_hover_confusion(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detect long hover (3+ s) before a click."""
    inc = _incremental_events(events)
    mouse_moves = _mouse_moves(inc)
    clicks = _clicks(inc)
    friction = []
    for c in clicks:
        d = c.get("data") or {}
        x, y = d.get("x"), d.get("y")
        ts = c.get("timestamp") or 0
        duration_ms = _hover_duration_ms(mouse_moves, x, y, ts)
        if duration_ms >= HOVER_HESITATION_MS:
            severity = "high" if duration_ms >= HOVER_HESITATION_HIGH_MS else "medium"
            friction.append({
                "type": "hover_confusion",
                "timestamp": ts,
                "element": {"id": _element_id(c), "x": x, "y": y},
                "severity": severity,
                "duration": round(duration_ms / 1000.0, 2),
                "context": f"Hovered for {duration_ms/1000:.1f}s before clicking",
            })
    return friction


def detect_scroll_confusion(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Detect back-and-forth scrolling in a short window."""
    scrolls = _scrolls(events)
    friction = []
    for i in range(len(scrolls) - SCROLL_WINDOW_MIN_EVENTS + 1):
        window = scrolls[i : i + SCROLL_WINDOW_MIN_EVENTS]
        ys = [(e.get("data") or {}).get("y") for e in window]
        if any(y is None for y in ys):
            continue
        directions = []
        for j in range(1, len(ys)):
            directions.append("down" if ys[j] > ys[j - 1] else "up")
        if len(set(directions)) >= 2 and len(directions) >= SCROLL_CONFUSION_MIN_CHANGES:
            friction.append({
                "type": "scroll_confusion",
                "timestamp": window[0].get("timestamp") or 0,
                "element": None,
                "severity": "medium",
                "duration": 0,
                "context": "Back-and-forth scrolling in same area",
            })
    return friction


def analyze_session(events: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Run all rule-based detectors and return friction_score (0-100), friction_points, top_issues.
    """
    if not events:
        return {"friction_score": 0, "friction_points": [], "top_issues": []}

    inc = _incremental_events(events)
    all_points = []
    all_points.extend(detect_rage_clicks(inc))
    all_points.extend(detect_hover_confusion(events))
    all_points.extend(detect_scroll_confusion(events))

    # Dedupe by type+timestamp (rough)
    seen = set()
    unique = []
    for p in all_points:
        key = (p["type"], p.get("timestamp"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)

    # Score 0-100: critical=25, high=15, medium=10 each; cap at 100
    severity_weight = {"critical": 25, "high": 15, "medium": 10, "low": 5}
    score = min(100, sum(severity_weight.get(p.get("severity"), 10) for p in unique))

    # Top issues by severity order
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    top = sorted(unique, key=lambda p: (order.get(p.get("severity"), 4), -p.get("timestamp", 0)))[:10]

    return {
        "friction_score": score,
        "friction_points": unique,
        "top_issues": top,
    }
