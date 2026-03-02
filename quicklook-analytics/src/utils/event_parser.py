"""Parse rrweb events (types 3=incremental, 4=meta, etc.) and return structured list."""
from typing import Any


# rrweb event type constants
TYPE_INCREMENTAL = 3
TYPE_META = 4
TYPE_FULL_SNAPSHOT = 2
TYPE_SNAPSHOT = 0


def parse_rrweb_events(raw_events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Parse rrweb events and return a structured list.
    - type 3: incremental (mutations, etc.)
    - type 4: meta (e.g. href, width, height)
    - type 2: full snapshot
    - type 0: snapshot
    """
    if not raw_events or not isinstance(raw_events, list):
        return []
    result = []
    for ev in raw_events:
        if not isinstance(ev, dict):
            continue
        event_type = ev.get("type")
        if event_type is None:
            continue
        result.append({
            "type": event_type,
            "data": ev.get("data"),
            "timestamp": ev.get("timestamp"),
        })
    return result
