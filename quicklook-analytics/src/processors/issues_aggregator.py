"""
Aggregate JavaScript errors and warnings from session events into quicklook_issues
and quicklook_issue_occurrences. Uses same MongoDB collections as quicklook-server.
Run on a schedule (e.g. every 6h) via POST /issues/run.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Callable

from src.processors.event_fetcher import get_events_for_session

logger = logging.getLogger(__name__)

ISSUES_COLLECTION = "quicklook_issues"
OCCURRENCES_COLLECTION = "quicklook_issue_occurrences"
JOB_STATE_COLLECTION = "quicklook_issue_job_state"
SESSION_COLLECTION = "quicklook_sessions"
MAX_SIGNATURE_LENGTH = 200
MAX_SESSIONS_PER_PROJECT_PER_RUN = 200
INITIAL_LOOKBACK_HOURS = 48
# Fetch events for this many sessions in parallel (I/O bound)
CONCURRENCY = 10


def _normalize_signature(args: Any) -> str:
    if args is None:
        return ""
    s = str(args).strip()
    return s[:MAX_SIGNATURE_LENGTH] if len(s) > MAX_SIGNATURE_LENGTH else s


def _get_segment_for_session(pages: list | None, goal_events: list | None) -> str | None:
    if pages and any("checkout" in str(p).lower() for p in pages):
        return "checkout"
    if goal_events and any("checkout" in str(g).lower() for g in goal_events):
        return "checkout"
    return None


def _extract_console_errors_and_warnings(events: list[dict]) -> list[dict]:
    out = []
    for e in events or []:
        if e.get("type") != 5:
            continue
        data = e.get("data") or {}
        if data.get("tag") != "ql_console":
            continue
        payload = data.get("payload") or {}
        level = (payload.get("level") or "log").lower()
        if level not in ("error", "warn"):
            continue
        args = payload.get("args")
        ts = e.get("timestamp") or (int(datetime.now(timezone.utc).timestamp() * 1000))
        out.append({"level": level, "args": args, "timestamp": ts})
    return out


async def _process_project(
    get_db: Callable,
    project_key: str,
) -> dict[str, int]:
    db = get_db()
    sessions_coll = db[SESSION_COLLECTION]
    issues_coll = db[ISSUES_COLLECTION]
    occurrences_coll = db[OCCURRENCES_COLLECTION]
    job_state_coll = db[JOB_STATE_COLLECTION]

    state_doc = await job_state_coll.find_one({"projectKey": project_key})
    since = state_doc.get("lastProcessedClosedAt") if state_doc else None
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(hours=INITIAL_LOOKBACK_HOURS)
    until = datetime.now(timezone.utc)

    cursor = sessions_coll.find(
        {
            "projectKey": project_key,
            "status": "closed",
            "closedAt": {"$gt": since, "$lte": until},
        },
        projection={"sessionId": 1, "closedAt": 1, "pages": 1, "goalEvents": 1, "storageType": 1},
    ).sort("closedAt", 1).limit(MAX_SESSIONS_PER_PROJECT_PER_RUN)

    sessions = await cursor.to_list(length=MAX_SESSIONS_PER_PROJECT_PER_RUN)
    logger.info(
        "issues_aggregator project=%s: since=%s until=%s sessions_found=%d",
        project_key[:8] if project_key else "",
        since,
        until,
        len(sessions),
    )
    if not sessions:
        return {"processed": 0, "issuesCreated": 0, "occurrencesInserted": 0}

    # Fetch events for many sessions in parallel (main bottleneck is I/O)
    sem = asyncio.Semaphore(CONCURRENCY)

    async def fetch_events(sess: dict) -> tuple[dict, list]:
        sid = sess.get("sessionId")
        if not sid:
            return (sess, [])
        async with sem:
            try:
                events = await get_events_for_session(sid, sess)
                return (sess, events)
            except Exception as e:
                logger.warning("issues_aggregator: fetch failed %s: %s", (sid or "")[:8], e)
                return (sess, [])

    session_events_list = await asyncio.gather(*[fetch_events(s) for s in sessions])

    processed = 0
    issues_created = 0
    occurrences_inserted = 0
    updated_issue_ids: set[str] = set()
    max_closed_at = since

    # Cache issue lookup by (type, signature) to avoid repeated find_one for same signature
    issue_cache: dict[tuple[str, str], dict] = {}

    for session, events in session_events_list:
        session_id = session.get("sessionId")
        if not session_id:
            continue
        try:
            items = _extract_console_errors_and_warnings(events)
            segment = _get_segment_for_session(
                session.get("pages"),
                session.get("goalEvents"),
            )
            for item in items:
                severity = "error" if item["level"] == "error" else "warning"
                itype = "javascript_error" if item["level"] == "error" else "javascript_warning"
                signature = _normalize_signature(item["args"])
                if not signature:
                    continue

                cache_key = (itype, signature)
                issue = issue_cache.get(cache_key)
                if issue is None:
                    issue = await issues_coll.find_one({
                        "projectKey": project_key,
                        "type": itype,
                        "signature": signature,
                    })
                    if not issue:
                        issue_id = str(uuid.uuid4())
                        ts = datetime.fromtimestamp(item["timestamp"] / 1000.0, tz=timezone.utc)
                        await issues_coll.insert_one({
                            "issueId": issue_id,
                            "projectKey": project_key,
                            "type": itype,
                            "severity": severity,
                            "signature": signature,
                            "message": signature,
                            "firstSeen": ts,
                            "lastSeen": ts,
                            "occurrenceCount": 0,
                            "affectedSessionCount": 0,
                        })
                        issue = {"issueId": issue_id}
                        issues_created += 1
                    else:
                        issue_id = issue["issueId"]
                    issue_cache[cache_key] = issue
                else:
                    issue_id = issue["issueId"]

                updated_issue_ids.add(issue_id)
                ts_dt = datetime.fromtimestamp(item["timestamp"] / 1000.0, tz=timezone.utc)
                await occurrences_coll.insert_one({
                    "issueId": issue_id,
                    "sessionId": session_id,
                    "projectKey": project_key,
                    "timestamp": ts_dt,
                    "segment": segment,
                    "payload": {"message": item["args"]},
                })
                occurrences_inserted += 1

                await issues_coll.update_one(
                    {"issueId": issue_id},
                    {
                        "$inc": {"occurrenceCount": 1},
                        "$min": {"firstSeen": ts_dt},
                        "$max": {"lastSeen": ts_dt},
                    },
                )

            processed += 1
            closed_at = session.get("closedAt")
            if closed_at and (max_closed_at is None or closed_at > max_closed_at):
                max_closed_at = closed_at
        except Exception as e:
            logger.warning(
                "issues_aggregator: failed session %s: %s",
                (session_id or "")[:8],
                e,
            )

    # Single aggregation for all affectedSessionCounts instead of one per issue
    if updated_issue_ids:
        pipeline = [
            {"$match": {"issueId": {"$in": list(updated_issue_ids)}}},
            {"$group": {"_id": "$issueId", "sessionIds": {"$addToSet": "$sessionId"}}},
            {"$project": {"count": {"$size": "$sessionIds"}}},
        ]
        agg_cursor = occurrences_coll.aggregate(pipeline)
        agg_docs = await agg_cursor.to_list(length=len(updated_issue_ids) + 100)
        for doc in agg_docs:
            await issues_coll.update_one(
                {"issueId": doc["_id"]},
                {"$set": {"affectedSessionCount": doc["count"]}},
            )

    if processed > 0 and max_closed_at:
        await job_state_coll.update_one(
            {"projectKey": project_key},
            {"$set": {"lastProcessedClosedAt": max_closed_at}},
            upsert=True,
        )

    return {
        "processed": processed,
        "issuesCreated": issues_created,
        "occurrencesInserted": occurrences_inserted,
    }


async def run_issues_aggregation(
    get_db: Callable,
    project_key: str | None = None,
) -> dict[str, Any]:
    """
    Run issues aggregation for all projects (or one if project_key is set).
    Returns { projectsProcessed, sessionsProcessed, issuesCreated, occurrencesInserted }.
    """
    db = get_db()
    sessions_coll = db[SESSION_COLLECTION]
    if project_key:
        project_keys = [project_key]
    else:
        project_keys = await sessions_coll.distinct(
            "projectKey",
            {"status": "closed", "closedAt": {"$exists": True, "$ne": None}},
        )
        project_keys = list(project_keys) if project_keys else []

    total_processed = 0
    total_issues_created = 0
    total_occurrences = 0

    for pk in project_keys:
        try:
            result = await _process_project(get_db, pk)
            total_processed += result["processed"]
            total_issues_created += result["issuesCreated"]
            total_occurrences += result["occurrencesInserted"]
        except Exception as e:
            logger.exception("issues_aggregator failed for project %s: %s", pk, e)

    if total_processed or total_occurrences:
        logger.info(
            "issues_aggregator: run complete projects=%d sessions=%d issues_created=%d occurrences=%d",
            len(project_keys),
            total_processed,
            total_issues_created,
            total_occurrences,
        )

    return {
        "projectsProcessed": len(project_keys),
        "sessionsProcessed": total_processed,
        "issuesCreated": total_issues_created,
        "occurrencesInserted": total_occurrences,
    }


async def run_issues_debug(
    get_db: Callable,
    project_key: str,
) -> dict[str, Any]:
    """
    For a single project: return window (since/until), closed session count,
    and for the first session: events fetched, console error/warn counts.
    Helps explain why POST /issues/run produces no issues.
    """
    db = get_db()
    sessions_coll = db[SESSION_COLLECTION]
    job_state_coll = db[JOB_STATE_COLLECTION]

    state_doc = await job_state_coll.find_one({"projectKey": project_key})
    since = state_doc.get("lastProcessedClosedAt") if state_doc else None
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(hours=INITIAL_LOOKBACK_HOURS)
    until = datetime.now(timezone.utc)

    count = await sessions_coll.count_documents(
        {
            "projectKey": project_key,
            "status": "closed",
            "closedAt": {"$gt": since, "$lte": until},
        }
    )
    total_closed = await sessions_coll.count_documents(
        {"projectKey": project_key, "status": "closed", "closedAt": {"$exists": True, "$ne": None}}
    )
    first = await sessions_coll.find_one(
        {
            "projectKey": project_key,
            "status": "closed",
            "closedAt": {"$gt": since, "$lte": until},
        },
        projection={"sessionId": 1, "closedAt": 1, "storageType": 1},
        sort=[("closedAt", 1)],
    )
    out = {
        "projectKey": project_key,
        "since": since.isoformat() if since else None,
        "until": until.isoformat() if until else None,
        "closedSessionsInWindow": count,
        "totalClosedSessions": total_closed,
        "firstSessionId": None,
        "firstSessionStorageType": None,
        "eventsFetched": 0,
        "consoleErrors": 0,
        "consoleWarnings": 0,
    }
    if not first:
        return out
    out["firstSessionId"] = first.get("sessionId")
    out["firstSessionStorageType"] = first.get("storageType") or "mongo"
    events = await get_events_for_session(first.get("sessionId"), first)
    out["eventsFetched"] = len(events)
    items = _extract_console_errors_and_warnings(events)
    for item in items:
        if item["level"] == "error":
            out["consoleErrors"] += 1
        else:
            out["consoleWarnings"] += 1
    return out
