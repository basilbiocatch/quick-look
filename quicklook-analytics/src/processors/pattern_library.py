"""
Pattern library: storage and matching for friction patterns.
Builds quicklook_patterns from historical friction data; matches insights to patterns.
Plan: Section 3 (quicklook_patterns), Feature 8 (Pattern Library & Lift Prediction).
"""
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

PATTERNS_COLLECTION = "quicklook_patterns"
INSIGHTS_COLLECTION = "quicklook_insights"


def _pattern_id(project_key: str, friction_type: str, page: str) -> str:
    raw = f"{project_key}:{friction_type}:{page}"
    h = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
    return f"pat_{h}"


def _signature_from_insight(friction_type: str, page: str, element: dict | None) -> dict[str, Any]:
    """Build a minimal signature for matching. Plan: frictionType, pageType, element."""
    sig: dict[str, Any] = {
        "frictionType": friction_type,
        "pageType": "unknown",
        "page": page[:500] if page else "unknown",
    }
    if element and isinstance(element, dict):
        sig["element"] = {
            "type": element.get("type", "unknown"),
            "selector": (element.get("selector") or element.get("tagName") or "")[:200],
        }
    return sig


async def find_matching_patterns(
    db,
    project_key: str,
    friction_type: str,
    page: str,
    *,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Find patterns that match this friction context (same project, same frictionType, same or similar page).
    Returns patterns sorted by occurrences descending.
    """
    coll = db[PATTERNS_COLLECTION]
    # Match by project and friction type; page can be exact or we take any pattern for that type
    cursor = (
        coll.find(
            {
                "projectKey": project_key,
                "signature.frictionType": friction_type,
            }
        )
        .sort("occurrences", -1)
        .limit(limit * 2)
    )
    patterns = [doc async for doc in cursor]
    # Prefer exact page match, then any
    for p in patterns:
        p.pop("_id", None)
    # Sort: exact page first, then by occurrences
    def key(p: dict) -> tuple:
        page_match = 0 if (p.get("signature") or {}).get("page") == page else 1
        return (page_match, -(p.get("occurrences") or 0))

    patterns.sort(key=key)
    return patterns[:limit]


async def upsert_pattern_from_insight(
    db,
    project_key: str,
    friction_type: str,
    page: str,
    *,
    suggested_fixes: list[dict[str, Any]],
    affected_conversion_rate: float | None = None,
    normal_conversion_rate: float | None = None,
    occurrence_count: int = 1,
    element: dict | None = None,
) -> str:
    """
    Create or update a pattern from an insight. Idempotent by (projectKey, frictionType, page).
    suggested_fixes: list of { description, predictedLift: { min, max }, confidence, priority?, source? }.
    Returns patternId.
    """
    coll = db[PATTERNS_COLLECTION]
    pattern_id = _pattern_id(project_key, friction_type, page)
    signature = _signature_from_insight(friction_type, page, element)
    now = datetime.now(timezone.utc)

    # Normalize suggested fixes shape for storage
    fixes_doc = []
    for f in suggested_fixes or []:
        if isinstance(f, str):
            fixes_doc.append({"description": f[:1000], "expectedLift": {"min": 0, "max": 0}, "confidence": 0.5})
        elif isinstance(f, dict):
            lift = f.get("predictedLift") or f.get("expectedLift") or {}
            if isinstance(lift, (int, float)):
                lift = {"min": float(lift) * 0.8, "max": float(lift)}
            fixes_doc.append({
                "description": (f.get("description") or "")[:1000],
                "expectedLift": {"min": lift.get("min", 0), "max": lift.get("max", 0)},
                "confidence": float(f.get("confidence", 0.5)),
                "priority": f.get("priority", "medium"),
                "source": f.get("source", "ml_prediction"),
            })
        else:
            continue

    existing = await coll.find_one({"patternId": pattern_id})
    if existing:
        # Update: merge suggestedFixes (dedupe by description), bump occurrences
        existing_fixes = list(existing.get("suggestedFixes") or [])
        seen_desc = {f.get("description", "").strip()[:200] for f in existing_fixes if isinstance(f, dict)}
        for f in fixes_doc:
            d = (f.get("description") or "").strip()[:200]
            if d and d not in seen_desc:
                existing_fixes.append(f)
                seen_desc.add(d)
        await coll.update_one(
            {"patternId": pattern_id},
            {
                "$set": {
                    "name": existing.get("name") or f"{friction_type} on {page[:80]}",
                    "signature": signature,
                    "suggestedFixes": existing_fixes[:20],
                    "occurrences": (existing.get("occurrences") or 0) + occurrence_count,
                    "affectedConversionRate": affected_conversion_rate if affected_conversion_rate is not None else existing.get("affectedConversionRate"),
                    "normalConversionRate": normal_conversion_rate if normal_conversion_rate is not None else existing.get("normalConversionRate"),
                    "updatedAt": now,
                }
            },
        )
        return pattern_id

    doc = {
        "patternId": pattern_id,
        "projectKey": project_key,
        "name": f"{friction_type} on {page[:80]}" if page and page != "unknown" else friction_type,
        "signature": signature,
        "occurrences": occurrence_count,
        "affectedConversionRate": affected_conversion_rate,
        "normalConversionRate": normal_conversion_rate,
        "suggestedFixes": fixes_doc[:20],
        "abTestResults": [],
        "updatedAt": now,
    }
    await coll.insert_one(doc)
    return pattern_id


async def sync_patterns_from_insights(
    get_database_fn,
    project_key: str,
    *,
    limit_insights: int = 200,
) -> dict[str, Any]:
    """
    Sync quicklook_patterns from existing quicklook_insights: for each insight with suggestedFixes,
    upsert a pattern so future matching can reuse them. Also upsert patterns for insights that have
    no suggestedFixes yet (so we have a pattern record for matching).
    Returns { upserted, skipped }.
    """
    db = get_database_fn()
    insights_coll = db[INSIGHTS_COLLECTION]
    cursor = insights_coll.find({"projectKey": project_key}).limit(limit_insights)
    insights = [doc async for doc in cursor]
    upserted = 0
    skipped = 0
    for ins in insights:
        friction_type = ins.get("frictionType") or "unknown"
        page = ins.get("page") or "unknown"
        fixes = ins.get("suggestedFixes") or []
        impact = ins.get("impact") or {}
        aff_cr = impact.get("affectedConversionRate")
        norm_cr = impact.get("normalConversionRate")
        count = len(ins.get("affectedSessions") or [])
        if count == 0:
            skipped += 1
            continue
        await upsert_pattern_from_insight(
            db,
            project_key,
            friction_type,
            page,
            suggested_fixes=fixes,
            affected_conversion_rate=aff_cr,
            normal_conversion_rate=norm_cr,
            occurrence_count=count,
            element=ins.get("element"),
        )
        upserted += 1
    return {"upserted": upserted, "skipped": skipped}
