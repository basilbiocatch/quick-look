"""
Anomaly detection: time-series on friction and conversion to flag behavioral shifts.
Plan: Feature 9, Phase 6.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

SESSION_COLLECTION = "quicklook_sessions"
# Threshold: flag if metric is beyond mean ± (multiplier * std)
STD_MULTIPLIER = 2.0
MIN_DAYS_FOR_ANOMALY = 3


async def detect_anomalies(
    get_database_fn,
    project_key: str,
    start_date: datetime,
    end_date: datetime,
) -> list[dict[str, Any]]:
    """
    Aggregate sessions by day (friction score, conversion rate, session count),
    compute mean/std over the period, flag days beyond threshold.
    Returns list of { metric, date, value, expected_range, message }.
    """
    db = get_database_fn()
    coll = db[SESSION_COLLECTION]
    anomalies: list[dict[str, Any]] = []

    # Daily aggregates: date_str -> { friction_sum, friction_count, converted, total }
    daily: dict[str, dict[str, float]] = {}
    cursor = coll.find(
        {
            "projectKey": project_key,
            "aiProcessed": True,
            "closedAt": {"$gte": start_date, "$lte": end_date},
        },
        {"closedAt": 1, "frictionScore": 1, "converted": 1},
    )
    async for doc in cursor:
        closed = doc.get("closedAt")
        if not closed:
            continue
        if hasattr(closed, "date"):
            date_key = closed.date().isoformat()
        else:
            date_key = str(closed)[:10]
        if date_key not in daily:
            daily[date_key] = {"friction_sum": 0.0, "friction_count": 0, "converted": 0, "total": 0}
        daily[date_key]["total"] += 1
        if doc.get("converted") is True:
            daily[date_key]["converted"] += 1
        fs = doc.get("frictionScore")
        if fs is not None:
            daily[date_key]["friction_sum"] += float(fs)
            daily[date_key]["friction_count"] += 1

    if len(daily) < MIN_DAYS_FOR_ANOMALY:
        return anomalies

    # Per-day metrics
    friction_avgs: list[float] = []
    conversion_rates: list[float] = []
    counts: list[int] = []
    for v in daily.values():
        if v["friction_count"] > 0:
            friction_avgs.append(v["friction_sum"] / v["friction_count"])
        if v["total"] > 0:
            conversion_rates.append((v["converted"] / v["total"]) * 100)
        counts.append(v["total"])

    def _mean_stderr(xs: list[float]) -> tuple[float, float]:
        if not xs:
            return 0.0, 0.0
        n = len(xs)
        mean = sum(xs) / n
        variance = sum((x - mean) ** 2 for x in xs) / n if n > 1 else 0.0
        std = variance ** 0.5
        return mean, std

    # Friction anomaly: day with unusually high avg friction
    if friction_avgs:
        mu_f, std_f = _mean_stderr(friction_avgs)
        upper_f = mu_f + STD_MULTIPLIER * std_f
        for date_key, v in daily.items():
            if v["friction_count"] > 0:
                avg = v["friction_sum"] / v["friction_count"]
                if std_f > 0 and avg > upper_f:
                    anomalies.append({
                        "metric": "friction_score",
                        "date": date_key,
                        "value": round(avg, 2),
                        "expected_range": f"≤ {upper_f:.1f}",
                        "message": f"Friction score spike: {avg:.1f} (expected ≤ {upper_f:.1f})",
                    })

    # Conversion anomaly: day with unusually low conversion
    if conversion_rates:
        mu_c, std_c = _mean_stderr(conversion_rates)
        lower_c = mu_c - STD_MULTIPLIER * std_c
        for date_key, v in daily.items():
            if v["total"] > 5:
                cr = (v["converted"] / v["total"]) * 100
                if std_c > 0 and cr < lower_c:
                    anomalies.append({
                        "metric": "conversion_rate",
                        "date": date_key,
                        "value": round(cr, 2),
                        "expected_range": f"≥ {lower_c:.1f}%",
                        "message": f"Conversion drop: {cr:.1f}% (expected ≥ {lower_c:.1f}%)",
                    })

    return anomalies
