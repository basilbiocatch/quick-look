"""
Model retraining pipeline: collect training data from resolved insights and completed A/B tests,
then retrain the lift predictor. No Gemini; cost-effective. Plan Phase 7.
"""
import logging
from typing import Any, Callable

from src.models.lift_predictor import get_lift_predictor

logger = logging.getLogger(__name__)

INSIGHTS_COLLECTION = "quicklook_insights"
AB_TESTS_COLLECTION = "quicklook_ab_tests"


def _severity_to_num(severity: Any) -> int:
    m = {"low": 1, "medium": 2, "high": 3, "critical": 3}
    if severity is None:
        return 1
    if isinstance(severity, int):
        return max(1, min(3, severity))
    return m.get((str(severity) or "").lower(), 1)


def _row_from_insight(doc: dict) -> dict | None:
    """Build one training row from a resolved insight with actualLift."""
    actual = doc.get("actualLift")
    if actual is None:
        return None
    try:
        impact = doc.get("impact") or {}
        conv_drop = impact.get("conversionDrop")
        if conv_drop is None:
            conv_drop = 0
        aff_pct = doc.get("affectedPercentage")
        if aff_pct is None and isinstance(doc.get("affectedSessions"), list):
            aff_pct = 0  # will be normalized elsewhere; we don't have total here
        if aff_pct is None:
            aff_pct = 0
        pat_min = pat_max = 0.0
        fixes = doc.get("suggestedFixes") or []
        if fixes and isinstance(fixes[0], dict):
            lift = fixes[0].get("predictedLift") or fixes[0].get("expectedLift") or {}
            if isinstance(lift, dict):
                pat_min = float(lift.get("min", 0))
                pat_max = float(lift.get("max", 0))
        return {
            "frictionType": doc.get("frictionType") or "unknown",
            "conversion_drop_percent": float(conv_drop),
            "affected_percentage": float(aff_pct),
            "severity": doc.get("severity") or "medium",
            "pattern_lift_min": pat_min,
            "pattern_lift_max": pat_max,
            "actualLift": float(actual),
        }
    except (TypeError, ValueError, KeyError) as e:
        logger.debug("Skip insight for training row: %s", e)
        return None


def _row_from_ab_test(doc: dict, insight_doc: dict | None) -> dict | None:
    """Build one training row from a completed A/B test; optional insight for context."""
    results = doc.get("results") or {}
    actual = results.get("actualLift")
    if actual is None:
        return None
    try:
        conv_drop = 0.0
        aff_pct = 0.0
        severity = "medium"
        pat_min = pat_max = 0.0
        if insight_doc:
            impact = insight_doc.get("impact") or {}
            conv_drop = float(impact.get("conversionDrop", 0))
            aff_pct = float(insight_doc.get("affectedPercentage", 0))
            severity = insight_doc.get("severity") or "medium"
            fixes = insight_doc.get("suggestedFixes") or []
            if fixes and isinstance(fixes[0], dict):
                lift = fixes[0].get("predictedLift") or fixes[0].get("expectedLift") or {}
                if isinstance(lift, dict):
                    pat_min = float(lift.get("min", 0))
                    pat_max = float(lift.get("max", 0))
        exp = doc.get("expectedLift") or {}
        if isinstance(exp, dict) and (exp.get("min") is not None or exp.get("max") is not None):
            pat_min = float(exp.get("min", 0))
            pat_max = float(exp.get("max", 0))
        return {
            "frictionType": (insight_doc or {}).get("frictionType") or "unknown",
            "conversion_drop_percent": conv_drop,
            "affected_percentage": aff_pct,
            "severity": severity,
            "pattern_lift_min": pat_min,
            "pattern_lift_max": pat_max,
            "actualLift": float(actual),
        }
    except (TypeError, ValueError, KeyError) as e:
        logger.debug("Skip ab_test for training row: %s", e)
        return None


async def run_retrain(
    get_database_fn: Callable,
    project_key: str | None = None,
) -> dict[str, Any]:
    """
    Collect training data from resolved insights (with actualLift) and completed A/B tests,
    then retrain the lift predictor. Optional project_key to limit to one project.
    Returns { success, trained: bool, trainingRows: int, message }.
    """
    db = get_database_fn()
    insights_coll = db[INSIGHTS_COLLECTION]
    ab_coll = db[AB_TESTS_COLLECTION]

    # Resolved insights with actualLift
    query_insights = {"status": "resolved", "actualLift": {"$exists": True, "$ne": None}}
    if project_key:
        query_insights["projectKey"] = project_key
    cursor_i = insights_coll.find(query_insights).limit(500)
    rows = []
    async for doc in cursor_i:
        doc.pop("_id", None)
        row = _row_from_insight(doc)
        if row:
            rows.append(row)

    # Completed A/B tests with results.actualLift
    query_ab = {"status": "completed", "results.actualLift": {"$exists": True, "$ne": None}}
    if project_key:
        query_ab["projectKey"] = project_key
    cursor_ab = ab_coll.find(query_ab).limit(500)
    insight_ids = set()
    ab_docs = []
    async for doc in cursor_ab:
        doc.pop("_id", None)
        ab_docs.append(doc)
        if doc.get("insightId"):
            insight_ids.add(doc["insightId"])

    # Load insights for ab_tests that have insightId
    insight_map = {}
    if insight_ids:
        cursor_ins = insights_coll.find({"insightId": {"$in": list(insight_ids)}})
        async for doc in cursor_ins:
            doc.pop("_id", None)
            insight_map[doc.get("insightId")] = doc

    for doc in ab_docs:
        insight_doc = insight_map.get(doc.get("insightId")) if doc.get("insightId") else None
        row = _row_from_ab_test(doc, insight_doc)
        if row:
            rows.append(row)

    if len(rows) < 5:
        return {
            "success": True,
            "trained": False,
            "trainingRows": len(rows),
            "message": f"Not enough training data (need at least 5, got {len(rows)}). Resolve insights with actual lift or complete A/B tests with results.",
        }
    predictor = get_lift_predictor()
    trained = predictor.train(rows)
    return {
        "success": True,
        "trained": trained,
        "trainingRows": len(rows),
        "message": f"Retrained lift predictor with {len(rows)} rows." if trained else f"Collected {len(rows)} rows but training failed (check logs).",
    }
