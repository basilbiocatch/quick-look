"""
UX report generator: aggregate metrics, insights, clusters, anomalies; Gemini narrative; store in quicklook_reports.
Plan: Feature 5 (AI-Generated UX Reports), Phase 6.
"""
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from src.processors.anomaly_detector import detect_anomalies
from src.utils.llm_client import generate

logger = logging.getLogger(__name__)

SESSION_COLLECTION = "quicklook_sessions"
INSIGHTS_COLLECTION = "quicklook_insights"
CLUSTERS_COLLECTION = "quicklook_behavior_clusters"
REPORTS_COLLECTION = "quicklook_reports"


async def _get_metrics(
    db,
    project_key: str,
    start_date: datetime,
    end_date: datetime,
) -> dict[str, Any]:
    """Aggregate session metrics for the period."""
    coll = db[SESSION_COLLECTION]
    cursor = coll.find(
        {
            "projectKey": project_key,
            "aiProcessed": True,
            "closedAt": {"$gte": start_date, "$lte": end_date},
        },
        {"frictionScore": 1, "converted": 1},
    )
    total = 0
    converted = 0
    friction_sum = 0.0
    friction_count = 0
    async for doc in cursor:
        total += 1
        if doc.get("converted") is True:
            converted += 1
        fs = doc.get("frictionScore")
        if fs is not None:
            friction_sum += float(fs)
            friction_count += 1
    conversion_rate = (converted / total * 100) if total else 0
    avg_friction = (friction_sum / friction_count) if friction_count else None
    return {
        "totalSessions": total,
        "conversionRate": round(conversion_rate, 2),
        "avgFrictionScore": round(avg_friction, 2) if avg_friction is not None else None,
    }


async def _get_top_insights(db, project_key: str, start_date: datetime, limit: int = 5) -> list[dict]:
    coll = db[INSIGHTS_COLLECTION]
    cursor = (
        coll.find(
            {
                "projectKey": project_key,
                "createdAt": {"$gte": start_date},
                "status": "active",
            }
        )
        .sort("impact.conversionDrop", -1)
        .limit(limit)
    )
    out = []
    async for doc in cursor:
        doc.pop("_id", None)
        out.append(doc)
    return out


async def _get_clusters(db, project_key: str, start_date: datetime, limit: int = 10) -> list[dict]:
    coll = db[CLUSTERS_COLLECTION]
    cursor = (
        coll.find({"projectKey": project_key, "createdAt": {"$gte": start_date}})
        .sort("createdAt", -1)
        .limit(limit)
    )
    out = []
    async for doc in cursor:
        doc.pop("_id", None)
        if doc.get("period"):
            for k in ("start", "end"):
                if hasattr(doc["period"].get(k), "isoformat"):
                    doc["period"][k] = doc["period"][k].isoformat()
        if hasattr(doc.get("createdAt"), "isoformat"):
            doc["createdAt"] = doc["createdAt"].isoformat()
        out.append(doc)
    return out


def _serialize_for_llm(obj: Any) -> str:
    """Safe JSON for LLM prompt (truncate long lists)."""
    if isinstance(obj, list) and len(obj) > 10:
        obj = obj[:10] + [f"... and {len(obj) - 10} more"]
    try:
        return json.dumps(obj, default=str)[:8000]
    except Exception:
        return str(obj)[:8000]


async def _generate_report_narrative(
    metrics: dict,
    insights: list[dict],
    clusters: list[dict],
    anomalies: list[dict],
    period_label: str,
) -> dict[str, Any]:
    """One Gemini call: executive summary + sections (plain text)."""
    prompt = f"""Generate a professional UX insights report for {period_label}.

Data:
- Total sessions: {metrics.get('totalSessions', 0)}
- Conversion rate: {metrics.get('conversionRate', 0)}%
- Avg friction score: {metrics.get('avgFrictionScore') or 'N/A'}
- Top friction insights: {_serialize_for_llm(insights)}
- Behavior clusters: {_serialize_for_llm(clusters)}
- Anomalies detected: {_serialize_for_llm(anomalies)}

Write a concise UX report with these sections (plain text, no JSON, no markdown):

1. EXECUTIVE SUMMARY (2-4 sentences highlighting the most critical finding)

2. CRITICAL ISSUES (Top 3 from insights data, each with: title, impact, root cause, suggested fix)

3. BEHAVIORAL INSIGHTS (Key patterns from clusters)

4. RECOMMENDED ACTIONS (Prioritized list of fixes)

Write naturally as a professional UX analyst. Use clear headings. Be concise and actionable."""

    out = await generate(prompt, temperature=0.3, max_tokens=3000)
    if not out or not isinstance(out, str):
        return {
            "summary": "Report generation failed (no LLM response).",
            "sections": [
                {"title": "Critical Issues", "content": "No data available."},
                {"title": "Recommended Actions", "content": "Run insights generation and review the Insights dashboard."},
            ],
        }
    
    out = out.strip()
    
    # Parse sections from plain text (split by numbered headings or all-caps headings)
    lines = out.split("\n")
    sections = []
    current_title = None
    current_content = []
    summary_text = ""
    in_summary = False
    
    for line in lines:
        stripped = line.strip()
        # Check for section headers (1. TITLE or TITLE: or ## TITLE)
        if stripped and (
            (stripped[0].isdigit() and ". " in stripped[:5] and stripped.split(". ", 1)[1].isupper()) or
            (stripped.isupper() and len(stripped.split()) <= 5) or
            stripped.startswith("##")
        ):
            # Save previous section
            if current_title and current_content:
                sections.append({"title": current_title, "content": "\n".join(current_content).strip()})
            elif in_summary and current_content:
                summary_text = "\n".join(current_content).strip()
            
            # Start new section
            title = stripped
            if title[0].isdigit() and ". " in title[:5]:
                title = title.split(". ", 1)[1]
            title = title.replace("##", "").strip().strip(":")
            
            if "EXECUTIVE" in title.upper() or "SUMMARY" in title.upper():
                in_summary = True
                current_title = None
            else:
                in_summary = False
                current_title = title.title() if title.isupper() else title
            current_content = []
        else:
            if stripped:
                current_content.append(line)
    
    # Save last section
    if current_title and current_content:
        sections.append({"title": current_title, "content": "\n".join(current_content).strip()})
    elif in_summary and current_content:
        summary_text = "\n".join(current_content).strip()
    
    # If parsing failed, use the whole text
    if not summary_text and not sections:
        summary_text = out[:500]
        sections = [{"title": "Report", "content": out}]
    elif not summary_text:
        summary_text = sections[0]["content"][:500] if sections else "Report generated."
    
    return {"summary": summary_text[:2000], "sections": sections[:10]}


async def generate_report(
    get_database_fn,
    project_key: str,
    report_type: str = "weekly",
    *,
    use_llm: bool = True,
) -> dict[str, Any]:
    """
    Generate a UX report for the project. report_type: 'daily' | 'weekly' | 'monthly'.
    Writes to quicklook_reports. Returns the stored report document (without _id).
    """
    db = get_database_fn()
    now = datetime.now(timezone.utc)
    if report_type == "daily":
        start_date = now - timedelta(days=1)
    elif report_type == "monthly":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(days=7)
    end_date = now
    period_label = f"{start_date.date()} to {end_date.date()} ({report_type})"

    metrics = await _get_metrics(db, project_key, start_date, end_date)
    insights = await _get_top_insights(db, project_key, start_date, limit=5)
    clusters = await _get_clusters(db, project_key, start_date, limit=10)
    anomalies = await detect_anomalies(get_database_fn, project_key, start_date, end_date)

    if use_llm:
        content = await _generate_report_narrative(
            metrics, insights, clusters, anomalies, period_label
        )
    else:
        content = {
            "summary": f"UX report for {period_label}. Sessions: {metrics.get('totalSessions', 0)}, Conversion: {metrics.get('conversionRate', 0)}%.",
            "sections": [
                {"title": "Critical Issues", "content": f"Top insights: {len(insights)}. See Insights dashboard for details."},
                {"title": "Anomalies", "content": f"{len(anomalies)} anomaly(ies) detected." if anomalies else "No anomalies."},
            ],
        }

    report_id = str(uuid.uuid4())
    report = {
        "reportId": report_id,
        "projectKey": project_key,
        "type": report_type,
        "period": {"start": start_date, "end": end_date},
        "title": f"UX Insights Report - {report_type.capitalize()} of {start_date.strftime('%b %d')}",
        "summary": content["summary"],
        "sections": content["sections"],
        "metrics": {
            **metrics,
            "topFriction": [{"insightId": i.get("insightId"), "frictionType": i.get("frictionType"), "conversionDrop": i.get("impact", {}).get("conversionDrop")} for i in insights[:5]],
            "behaviorShifts": anomalies,
        },
        "generatedAt": now,
        "viewedAt": None,
    }
    await db[REPORTS_COLLECTION].insert_one(report)
    # Serialize for JSON response
    out = dict(report)
    if out.get("period") and isinstance(out["period"], dict):
        out["period"] = {
            k: v.isoformat() if hasattr(v, "isoformat") else v
            for k, v in out["period"].items()
        }
    if hasattr(out.get("generatedAt"), "isoformat"):
        out["generatedAt"] = out["generatedAt"].isoformat()
    return out
