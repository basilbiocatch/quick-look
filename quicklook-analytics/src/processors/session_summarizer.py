"""
LLM-powered session summary: narrative, emotional score, intent, drop-off reason, key moment.
ON-DEMAND ONLY (called from ensure-summary endpoint when user opens a session).
"""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from src.utils.llm_client import generate

logger = logging.getLogger(__name__)

INTENTS = ("buyer", "researcher", "comparison", "support", "explorer")
NARRATIVE_MAX_LEN = 1200  # 2-3 sentences; truncate at word boundary


def _truncate_at_word(text: str, max_len: int = NARRATIVE_MAX_LEN) -> str:
    """Truncate to max_len, at last space so we don't cut mid-word."""
    if not text or len(text) <= max_len:
        return (text or "").strip()
    s = text[: max_len + 1].rsplit(" ", 1)
    return (s[0] if s else text[:max_len]).strip()
DROP_OFF_REASONS = ("confusion", "price", "technical", "alternative", "unknown", "")


def _action_summary(events: list[dict[str, Any]], max_actions: int = 25) -> str:
    """Summarize key actions from events for the prompt."""
    if not events:
        return "No events"
    steps = []
    for e in events[:200]:  # cap scan
        t = e.get("type")
        d = e.get("data") or {}
        ts = e.get("timestamp") or 0
        if t == 3:
            src = d.get("source")
            if src == 2:
                steps.append(f"@{ts}: click")
            elif src == 3:
                steps.append(f"@{ts}: scroll")
        elif t == 4 and d.get("href"):
            steps.append(f"@{ts}: navigate {str(d.get('href', ''))[:60]}")
    return "\n".join(steps[-max_actions:]) if steps else "No actions"


def _friction_summary(friction_points: list[dict[str, Any]]) -> str:
    """Summarize friction for the prompt."""
    if not friction_points:
        return "No friction detected"
    parts = []
    for fp in friction_points[:15]:
        ctx = fp.get("context") or fp.get("type") or ""
        parts.append(f"- {fp.get('type', '')}: {ctx}")
    return "\n".join(parts)


def _parse_summary_response(raw: str) -> dict[str, Any] | None:
    """Parse Gemini response into aiSummary shape. Handles JSON or loose text."""
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    # Strip markdown code fences (```json\n{...}\n``` or ```\n{...}\n```)
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
    raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()
    # Try JSON block first
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and "narrative" in obj:
                return obj
        except json.JSONDecodeError:
            logger.warning("_parse_summary_response: JSON parse failed, using regex fallback")
    # Fallback: extract fields with regex (allow newlines in string values)
    out = {}
    for key in ("narrative", "keyMoment", "dropOffReason", "intent"):
        pat = rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)"'
        m = re.search(pat, raw, re.I | re.DOTALL)
        if m:
            val = m.group(1).replace("\\n", " ").replace('\\"', '"').strip()
            out[key] = _truncate_at_word(val) if key in ("narrative", "keyMoment") else val
    em = re.search(r'"emotionalScore"\s*:\s*(\d+)', raw, re.I)
    if em:
        try:
            v = int(em.group(1))
            out["emotionalScore"] = max(1, min(10, v))
        except ValueError:
            out["emotionalScore"] = 5
    if not out or not out.get("narrative"):
        logger.warning("_parse_summary_response: no fields extracted, using raw as narrative")
        out = {"narrative": _truncate_at_word(raw) if raw else "No summary", "emotionalScore": 5}
    out.setdefault("narrative", _truncate_at_word(out.get("narrative", "No summary")))
    out.setdefault("emotionalScore", 5)
    out.setdefault("intent", "explorer")
    out.setdefault("dropOffReason", "")
    out.setdefault("keyMoment", "")
    return out


async def summarize_session(
    session_doc: dict[str, Any],
    events: list[dict[str, Any]],
    friction_score: float,
    friction_points: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Call Gemini to produce session summary. Returns dict suitable for session.aiSummary
    with keys: narrative, emotionalScore, intent, dropOffReason, keyMoment.
    Adds generatedAt in the caller.
    """
    pages_visited = _action_summary(events, max_actions=20)
    friction_summary = _friction_summary(friction_points)
    converted = session_doc.get("converted") is True
    outcome = "Converted" if converted else "Abandoned"

    prompt = f"""Summarize this user session in 2-3 sentences.

User actions (recent):
{pages_visited}

Friction detected (rule-based):
{friction_summary}
Friction score (0-100): {friction_score}

Outcome: {outcome}

Respond with a JSON object only (no markdown, no extra text):
{{
  "narrative": "One or two sentence summary of what the user did and what happened.",
  "emotionalScore": <number 1-10, 1=frustrated, 10=smooth>,
  "intent": "<one of: buyer, researcher, comparison, support, explorer>",
  "dropOffReason": "<if abandoned: one of confusion, price, technical, alternative, or empty string>",
  "keyMoment": "Single sentence describing the most important interaction or moment."
}}
"""

    response = await generate(prompt, temperature=0.3, max_tokens=2048)
    if not response:
        return {
            "narrative": "Summary unavailable (no model response).",
            "emotionalScore": 5,
            "intent": "explorer",
            "dropOffReason": "",
            "keyMoment": "",
        }

    parsed = _parse_summary_response(response)
    if not parsed:
        return {
            "narrative": _truncate_at_word(response) if response else "Summary unavailable.",
            "emotionalScore": 5,
            "intent": "explorer",
            "dropOffReason": "",
            "keyMoment": "",
        }

    # Normalize intent and dropOffReason
    intent = (parsed.get("intent") or "explorer").strip().lower()
    if intent not in INTENTS:
        intent = "explorer"
    drop_off = (parsed.get("dropOffReason") or "").strip().lower()
    if drop_off and drop_off not in DROP_OFF_REASONS:
        drop_off = "unknown" if drop_off else ""

    return {
        "narrative": _truncate_at_word(parsed.get("narrative") or ""),
        "emotionalScore": max(1, min(10, int(parsed.get("emotionalScore") or 5))),
        "intent": intent,
        "dropOffReason": drop_off,
        "keyMoment": _truncate_at_word(parsed.get("keyMoment") or ""),
    }


def build_ai_summary_with_generated_at(summary: dict[str, Any]) -> dict[str, Any]:
    """Add generatedAt to summary for storage on session."""
    return {
        **summary,
        "generatedAt": datetime.now(timezone.utc),
    }
