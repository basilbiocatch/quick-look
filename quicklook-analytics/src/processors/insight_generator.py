"""
Insight generation pipeline: group sessions by friction pattern, run impact estimation,
write to quicklook_insights. Uses session friction/root_cause data; when the copied
root cause looks truncated, one Gemini call per insight completes it.
Plan: Section 3 (quicklook_insights), Phase 4.
"""
import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from src.processors.impact_estimator import estimate_conversion_impact
from src.processors.ab_suggester import suggest_fixes_for_insight

logger = logging.getLogger(__name__)

SESSION_COLLECTION = "quicklook_sessions"
INSIGHTS_COLLECTION = "quicklook_insights"
MIN_SESSIONS_PER_GROUP = 3
INSIGHT_EXPIRY_DAYS = 90

# Normalize friction point type to plan values
FRICTION_TYPE_ALIASES = {
    "rage_click": "rage_click",
    "hover_confusion": "hover_confusion",
    "scroll_confusion": "scroll_confusion",
    "hover": "hover_confusion",
    "scroll": "scroll_confusion",
    "rage": "rage_click",
}


def _normalize_friction_type(t: str) -> str:
    if not t or not isinstance(t, str):
        return "unknown"
    key = (t or "").strip().lower().replace("-", "_")
    return FRICTION_TYPE_ALIASES.get(key, key or "unknown")


def _session_page(session: dict) -> str:
    pages = session.get("pages")
    if pages and len(pages) > 0 and isinstance(pages[0], str):
        return pages[0][:500]  # cap length
    return "unknown"


def _group_sessions_by_friction_pattern(sessions: list[dict]) -> dict[tuple[str, str], list[dict]]:
    """Group sessions by (friction_type, page). A session can appear in multiple groups."""
    groups: dict[tuple[str, str], list[dict]] = {}
    for s in sessions:
        points = s.get("frictionPoints") or []
        page = _session_page(s)
        seen_keys = set()
        for fp in points:
            ft = _normalize_friction_type(fp.get("type"))
            key = (ft, page)
            if key not in seen_keys:
                seen_keys.add(key)
                if key not in groups:
                    groups[key] = []
                groups[key].append(s)
    return groups


def _stable_insight_id(project_key: str, friction_type: str, page: str) -> str:
    raw = f"{project_key}:{friction_type}:{page}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"ins_{h}"


def _severity_from_impact(impact: dict) -> str:
    drop = impact.get("conversion_drop_percent") or 0
    if drop >= 10:
        return "high"
    if drop >= 5:
        return "medium"
    return "low"


def _first_root_cause_text(session: dict) -> str:
    points = session.get("frictionPoints") or []
    for fp in points:
        rc = fp.get("root_cause")
        if isinstance(rc, dict) and rc.get("root_cause"):
            return str(rc["root_cause"])[:2000]
        if isinstance(rc, str) and rc.strip():
            return rc[:2000]
    return ""


def _looks_truncated(text: str) -> bool:
    """True if root cause appears cut mid-sentence (no final punctuation or ends with incomplete phrase)."""
    if not text or len(text) < 20:
        return False
    t = text.strip()
    # Ends with sentence-ending punctuation => likely complete
    if re.search(r"[.!?]\s*$", t):
        return False
    # Long enough but no sentence end => treat as truncated (covers "or '", "possibly", etc.)
    if len(t) > 40:
        return True
    # Ends with comma or common cut phrases => truncated
    if t.endswith(",") or re.search(r"\b(to|possibly|due to|leading to|or|and)\s*$", t, re.I):
        return True
    return False


async def _complete_root_cause_with_llm(friction_type: str, page: str, truncated: str) -> str:
    """One Gemini call to turn a truncated root cause into a complete 1–2 sentence explanation."""
    try:
        from src.utils.llm_client import generate
    except ImportError:
        return truncated
    prompt = f"""You are a UX analyst. The following root cause explanation was cut off. Rewrite it as one or two complete sentences explaining why users struggled. End with a period.

Friction type: {friction_type}
Page: {page[:200]}
Incomplete text: "{truncated}"

Reply with ONLY the complete rewritten explanation (1-2 sentences), nothing else. Do not include the word "rewrite" or any preamble."""
    out = await generate(prompt, temperature=0.2, max_tokens=512)
    if out and isinstance(out, str) and len(out.strip()) > 10:
        result = out.strip()
        # Remove common preamble patterns
        result = re.sub(r'^(Here is |Here\'s |The |Rewrite: |Rewritten: )', '', result, flags=re.I)
        return result[:1500]
    return truncated


def _first_element(session: dict) -> dict[str, Any] | None:
    points = session.get("frictionPoints") or []
    for fp in points:
        el = fp.get("element")
        if el and isinstance(el, dict):
            return el
    return None


async def run_insight_generation_for_project(
    get_database_fn,
    project_key: str,
    *,
    limit_sessions: int = 500,
    period_days: int = 7,
) -> dict[str, Any]:
    """
    Fetch recent aiProcessed sessions for project_key, group by friction pattern,
    run impact estimation, upsert into quicklook_insights.
    Returns { created, updated, totalInsights }.
    """
    db = get_database_fn()
    sessions_coll = db[SESSION_COLLECTION]
    insights_coll = db[INSIGHTS_COLLECTION]

    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    cursor = sessions_coll.find(
        {
            "projectKey": project_key,
            "aiProcessed": True,
            "closedAt": {"$gte": since},
        }
    ).sort("closedAt", -1).limit(min(limit_sessions, 1000))
    session_docs = [doc async for doc in cursor]
    if len(session_docs) < MIN_SESSIONS_PER_GROUP:
        return {"created": 0, "updated": 0, "totalInsights": 0, "message": "Not enough sessions"}

    groups = _group_sessions_by_friction_pattern(session_docs)
    created = 0
    updated = 0
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=INSIGHT_EXPIRY_DAYS)

    for (friction_type, page), affected_list in groups.items():
        if len(affected_list) < MIN_SESSIONS_PER_GROUP:
            continue
        impact_result = estimate_conversion_impact(affected_list, session_docs)
        affected_ids = [s.get("sessionId") for s in affected_list if s.get("sessionId")]
        first_session = affected_list[0]
        root_cause = _first_root_cause_text(first_session)
        if root_cause and _looks_truncated(root_cause):
            root_cause = await _complete_root_cause_with_llm(friction_type, page, root_cause)
        element = _first_element(first_session)
        severity = _severity_from_impact(impact_result)
        insight_id = _stable_insight_id(project_key, friction_type, page)

        impact_doc = {
            "conversionDrop": impact_result.get("conversion_drop_percent"),
            "revenueImpact": None,  # optional: require project AOV and formula
            "affectedUserCount": len(affected_ids),
            "confidence": 1 - impact_result.get("p_value", 0) if impact_result.get("statistical_significance") else 0,
        }
        estimated_lift = impact_result.get("estimated_lift_if_fixed") or {}
        try:
            suggested_fixes = await suggest_fixes_for_insight(
                get_database_fn,
                project_key,
                friction_type,
                page,
                impact_result,
                severity=severity,
                element=element,
                max_suggestions=5,
                use_llm_novel=False,
            )
        except Exception as e:
            logger.warning("ab_suggester failed for %s/%s: %s", friction_type, page, e)
            suggested_fixes = []

        doc = {
            "insightId": insight_id,
            "projectKey": project_key,
            "type": "friction",
            "frictionType": friction_type,
            "severity": severity,
            "affectedSessions": affected_ids,
            "affectedPercentage": impact_result.get("affected_percentage"),
            "page": page,
            "element": element,
            "impact": impact_doc,
            "rootCause": root_cause,
            "evidence": None,
            "suggestedFixes": suggested_fixes,
            "status": "active",
            "createdAt": now,
            "updatedAt": now,
            "expiresAt": expires_at,
        }

        existing = await insights_coll.find_one(
            {"projectKey": project_key, "type": "friction", "frictionType": friction_type, "page": page}
        )
        if existing:
            await insights_coll.update_one(
                {"insightId": existing["insightId"]},
                {
                    "$set": {
                        "affectedSessions": doc["affectedSessions"],
                        "affectedPercentage": doc["affectedPercentage"],
                        "impact": doc["impact"],
                        "severity": doc["severity"],
                        "rootCause": doc["rootCause"],
                        "element": doc["element"],
                        "suggestedFixes": doc["suggestedFixes"],
                        "updatedAt": now,
                        "expiresAt": expires_at,
                    }
                },
            )
            updated += 1
        else:
            await insights_coll.insert_one(doc)
            created += 1

    return {"created": created, "updated": updated, "totalInsights": created + updated}
