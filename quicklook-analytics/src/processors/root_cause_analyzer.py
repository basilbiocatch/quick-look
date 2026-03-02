"""
Root cause analysis for friction points: DOM context + Gemini explanation.
"""
import json
import logging
import re
from typing import Any

from src.processors.dom_extractor import get_element_description, get_current_url
from src.utils.llm_client import generate

logger = logging.getLogger(__name__)


def _extract_root_cause_from_text(raw: str, fallback: str) -> str:
    """When JSON parse fails, try to extract the root_cause value from raw response."""
    if not raw or not isinstance(raw, str):
        return fallback
    # Match "root_cause": "...." (handles escaped quotes; also truncated when closing " missing)
    m = re.search(r'"root_cause"\s*:\s*"((?:[^"\\]|\\.)*)"', raw)
    if m:
        s = m.group(1).replace("\\n", " ").replace("\\\"", '"').strip()
        if s:
            return s[:500]
    # Truncated JSON: "root_cause": "something (no closing quote)
    m2 = re.search(r'"root_cause"\s*:\s*"((?:[^"\\]|\\.)*)', raw)
    if m2:
        s = m2.group(1).replace("\\n", " ").replace("\\\"", '"').strip()
        if s:
            return s[:500]
    return fallback


def _action_summary(events: list[dict[str, Any]], around_ts: int, window_ms: int = 15000) -> str:
    """Summarize user actions near the friction timestamp (before and after)."""
    start = around_ts - window_ms
    end = around_ts + 5000
    relevant = [e for e in events if isinstance(e.get("timestamp"), (int, float)) and start <= e["timestamp"] <= end]
    relevant.sort(key=lambda x: x.get("timestamp") or 0)
    steps = []
    for e in relevant[:30]:
        t = e.get("type")
        d = e.get("data") or {}
        ts = e.get("timestamp")
        if t == 3:
            src = d.get("source")
            if src == 2:
                steps.append(f"@{ts}: click (id={d.get('id')})")
            elif src == 3:
                steps.append(f"@{ts}: scroll y={d.get('y')}")
        elif t == 4 and d.get("href"):
            steps.append(f"@{ts}: navigate {d.get('href')[:60]}")
    return "\n".join(steps[-15:]) if steps else "No actions in window"


async def analyze(
    friction_point: dict[str, Any],
    events: list[dict[str, Any]],
    session_doc: dict[str, Any],
    dom_cache: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Produce root cause explanation for one friction point.
    dom_cache: optional prebuilt from build_dom_cache(events) to avoid rescanning events per point.
    Returns { root_cause: str, evidence: { dom_issue?, ux_issue?, behavioral? }, confidence: float }.
    """
    fp_type = friction_point.get("type", "unknown")
    ts = friction_point.get("timestamp", 0)
    element = friction_point.get("element") or {}
    element_id = element.get("id") if isinstance(element.get("id"), int) else None
    context_str = friction_point.get("context", "")

    dom_desc = get_element_description(events, element_id, dom_cache)
    url = get_current_url(events, dom_cache)
    action_summary = _action_summary(events, ts)

    prompt = f"""You are a UX analyst. Based on the following friction event and context, give a brief root cause explanation.

Friction type: {fp_type}
Severity: {friction_point.get('severity', 'unknown')}
Context: {context_str}
Page URL: {url}
Element (from DOM snapshot): {dom_desc or 'unknown'}

Recent user actions (timestamp @ms):
{action_summary}

Respond with a single valid JSON object only (no markdown, no code block). Keys:
- "root_cause": one or two short sentences, plain text, explaining why the user struggled.
- "evidence": object with optional short strings "dom_issue", "ux_issue", "behavioral".
- "confidence": number between 0 and 1.

Example: {{"root_cause": "Submit button was obscured on mobile.", "evidence": {{"dom_issue": "Button below fold"}}, "confidence": 0.85}}
"""

    text = await generate(prompt, temperature=0.2, max_tokens=512)
    if not text:
        return {
            "root_cause": f"Rule-based: {context_str}",
            "evidence": {"behavioral": context_str},
            "confidence": 0.5,
        }
    # Strip markdown code block if present
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        out = json.loads(text)
        root = out.get("root_cause") or context_str
        if isinstance(root, dict):
            root = root.get("root_cause", context_str) or context_str
        return {
            "root_cause": str(root).strip() if root else context_str,
            "evidence": out.get("evidence") if isinstance(out.get("evidence"), dict) else {},
            "confidence": float(out.get("confidence", 0.6)),
        }
    except json.JSONDecodeError:
        extracted = _extract_root_cause_from_text(text, context_str)
        return {
            "root_cause": extracted[:500] if len(extracted) > 500 else extracted,
            "evidence": {"behavioral": context_str},
            "confidence": 0.5,
        }
