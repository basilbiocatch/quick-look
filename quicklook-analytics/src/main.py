"""FastAPI app: health check and Pub/Sub push handler for session processing."""
import asyncio
import base64
import json
import logging
import os
from typing import Any

from fastapi import FastAPI, Request, Response

from src.db.connection import get_database
from src.processors.behavior_clusterer import run_clustering_for_project
from src.processors.insight_generator import run_insight_generation_for_project
from src.processors.pattern_library import (
    sync_patterns_from_insights,
    append_ab_result_from_insight,
    append_ab_result_from_ab_test,
)
from src.processors.retrain import run_retrain
from src.reports.report_generator import generate_report
from src.processors.issues_aggregator import run_issues_aggregation, run_issues_debug
from src.processors.session_processor import (
    ensure_root_cause_for_session,
    ensure_summary_for_session,
    process_session,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="quicklook-analytics")
SESSION_COLLECTION = "quicklook_sessions"


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check for load balancer and readiness probes."""
    return {"status": "ok"}


@app.get("/session/{session_id}/ensure-root-cause")
async def ensure_root_cause(session_id: str, request: Request) -> dict[str, Any]:
    """
    On-demand: ensure this session's friction points have Gemini root cause. Call when user opens
    a session (e.g. ReplayPage). If already present, returns immediately; otherwise runs Gemini,
    persists to session, then returns. Query param force=1 re-runs root cause for all points (e.g. to fix truncated text).
    """
    force = request.query_params.get("force", "").lower() in ("1", "true", "yes")
    friction_points, generated = await ensure_root_cause_for_session(session_id, force=force)
    return {"frictionPoints": friction_points, "generated": generated}


@app.get("/session/{session_id}/ensure-summary")
async def ensure_summary(session_id: str) -> dict[str, Any]:
    """
    On-demand: ensure this session has aiSummary. If already present, returns it (generated=False).
    Otherwise loads events, runs Gemini summarizer, writes aiSummary to session, returns (generated=True).
    Call when user opens ReplayPage. Batch stays rule-only; no Gemini for summaries in batch.
    """
    ai_summary, generated = await ensure_summary_for_session(session_id)
    if ai_summary is None:
        return {"aiSummary": None, "generated": False}
    return {"aiSummary": ai_summary, "generated": generated}


@app.post("/cluster")
async def cluster(request: Request, response: Response) -> dict[str, Any]:
    """
    Run behavior clustering for a project. Reads last N aiProcessed sessions (default 500, max 1000),
    extracts features, clusters (no AI), writes to quicklook_behavior_clusters and sets behaviorCluster on sessions.
    Query params: projectKey (required), limit=500, method=dbscan|kmeans, llm_labels=0|1 (optional labels).
    """
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        response.status_code = 400
        return {"success": False, "error": "projectKey is required"}
    try:
        limit_val = request.query_params.get("limit", "500")
        limit = min(1000, max(1, int(limit_val)))
    except ValueError:
        limit = 500
    method = request.query_params.get("method", "dbscan").lower()
    if method not in ("dbscan", "kmeans"):
        method = "dbscan"
    use_llm_labels = request.query_params.get("llm_labels", "").lower() in ("1", "true", "yes")
    try:
        result = await run_clustering_for_project(
            get_database,
            project_key,
            limit=limit,
            method=method,
            use_llm_labels=use_llm_labels,
        )
        return {"success": True, **result}
    except Exception as e:
        logger.exception("POST /cluster failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.get("/cluster")
async def list_clusters(request: Request) -> dict[str, Any]:
    """List behavior clusters for a project. Query params: projectKey (required), limit=50."""
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        return {"success": False, "error": "projectKey is required", "clusters": []}
    try:
        limit_val = request.query_params.get("limit", "50")
        limit = min(100, max(1, int(limit_val)))
    except ValueError:
        limit = 50
    db = get_database()
    coll = db["quicklook_behavior_clusters"]
    cursor = coll.find({"projectKey": project_key}).sort("createdAt", -1).limit(limit)
    clusters = [doc async for doc in cursor]
    # Convert datetime and ObjectId for JSON
    for c in clusters:
        c.pop("_id", None)
        if c.get("period"):
            for k in ("start", "end"):
                if hasattr(c["period"].get(k), "isoformat"):
                    c["period"][k] = c["period"][k].isoformat()
        if hasattr(c.get("createdAt"), "isoformat"):
            c["createdAt"] = c["createdAt"].isoformat()
    return {"success": True, "clusters": clusters}


@app.post("/insights/run")
async def insights_run(request: Request, response: Response) -> dict[str, Any]:
    """
    Run insight generation for all projects (or one if projectKey set).
    Same 6h schedule as /process and /issues/run. Query params: projectKey (optional), limit=500, period_days=7.
    """
    project_key = request.query_params.get("projectKey", "").strip() or None
    try:
        limit_val = request.query_params.get("limit", "500")
        limit = min(1000, max(1, int(limit_val)))
    except ValueError:
        limit = 500
    try:
        period_val = request.query_params.get("period_days", "7")
        period_days = min(90, max(1, int(period_val)))
    except ValueError:
        period_days = 7
    db = get_database()
    sessions_coll = db["quicklook_sessions"]
    if project_key:
        project_keys = [project_key]
    else:
        project_keys = await sessions_coll.distinct(
            "projectKey",
            {"status": "closed", "closedAt": {"$exists": True, "$ne": None}},
        )
        project_keys = list(project_keys) if project_keys else []
    projects_ok = 0
    projects_failed = 0
    for pk in project_keys:
        try:
            await run_insight_generation_for_project(
                get_database,
                pk,
                limit_sessions=limit,
                period_days=period_days,
            )
            projects_ok += 1
        except Exception as e:
            logger.exception("insights/run failed for project %s: %s", pk[:8] if pk else "", e)
            projects_failed += 1
    return {
        "success": True,
        "projectsProcessed": projects_ok,
        "projectsFailed": projects_failed,
        "message": f"Insight generation run for {projects_ok} project(s). Failed: {projects_failed}.",
    }


@app.post("/insights/generate")
async def insights_generate(request: Request, response: Response) -> dict[str, Any]:
    """
    Generate insights for a project: group sessions by friction pattern, run impact estimation,
    upsert into quicklook_insights. Query params: projectKey (required), limit=500, period_days=7.
    """
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        response.status_code = 400
        return {"success": False, "error": "projectKey is required"}
    try:
        limit_val = request.query_params.get("limit", "500")
        limit = min(1000, max(1, int(limit_val)))
    except ValueError:
        limit = 500
    try:
        period_val = request.query_params.get("period_days", "7")
        period_days = min(90, max(1, int(period_val)))
    except ValueError:
        period_days = 7
    try:
        result = await run_insight_generation_for_project(
            get_database,
            project_key,
            limit_sessions=limit,
            period_days=period_days,
        )
        return {"success": True, **result}
    except Exception as e:
        logger.exception("POST /insights/generate failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.post("/models/retrain")
async def models_retrain(request: Request, response: Response) -> dict[str, Any]:
    """
    Retrain the lift predictor from resolved insights (with actualLift) and completed A/B tests.
    Query params: projectKey (optional) to limit to one project.
    No Gemini; cost-effective. Returns { success, trained, trainingRows, message }.
    """
    project_key = request.query_params.get("projectKey", "").strip() or None
    try:
        result = await run_retrain(get_database, project_key=project_key)
        return result
    except Exception as e:
        logger.exception("POST /models/retrain failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e), "trained": False, "trainingRows": 0}


@app.post("/patterns/update-from-insight")
async def patterns_update_from_insight(request: Request, response: Response) -> dict[str, Any]:
    """
    After an insight is marked resolved with actualLift, call this to append the outcome to the
    matching pattern's abTestResults. Query params: insightId (required).
    """
    insight_id = request.query_params.get("insightId", "").strip()
    if not insight_id:
        response.status_code = 400
        return {"success": False, "error": "insightId is required"}
    try:
        result = await append_ab_result_from_insight(get_database(), insight_id)
        return {"success": True, **result}
    except Exception as e:
        logger.exception("POST /patterns/update-from-insight failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.post("/patterns/update-from-ab-test")
async def patterns_update_from_ab_test(request: Request, response: Response) -> dict[str, Any]:
    """
    After an A/B test is completed with results, call this to append to the matching pattern's
    abTestResults. Query params: testId (required).
    """
    test_id = request.query_params.get("testId", "").strip()
    if not test_id:
        response.status_code = 400
        return {"success": False, "error": "testId is required"}
    try:
        result = await append_ab_result_from_ab_test(get_database(), test_id)
        return {"success": True, **result}
    except Exception as e:
        logger.exception("POST /patterns/update-from-ab-test failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.post("/patterns/sync")
async def patterns_sync(request: Request, response: Response) -> dict[str, Any]:
    """
    Sync quicklook_patterns from existing quicklook_insights for a project.
    Query params: projectKey (required), limit=200.
    """
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        response.status_code = 400
        return {"success": False, "error": "projectKey is required"}
    try:
        limit_val = request.query_params.get("limit", "200")
        limit_insights = min(500, max(1, int(limit_val)))
    except ValueError:
        limit_insights = 200
    try:
        result = await sync_patterns_from_insights(
            get_database,
            project_key,
            limit_insights=limit_insights,
        )
        return {"success": True, **result}
    except Exception as e:
        logger.exception("POST /patterns/sync failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.get("/issues/debug")
async def issues_debug(request: Request, response: Response) -> dict[str, Any]:
    """
    Debug why a project gets no issues. Query param: projectKey (required).
    Returns window, closed session count, and first session's event/console counts.
    """
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        response.status_code = 400
        return {"success": False, "error": "projectKey is required"}
    try:
        result = await run_issues_debug(get_database, project_key)
        return {"success": True, **result}
    except Exception as e:
        logger.exception("GET /issues/debug failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.post("/issues/run")
async def issues_run(request: Request, response: Response) -> dict[str, Any]:
    """
    Run issues aggregation: extract JS errors/warnings from session events,
    upsert quicklook_issues and quicklook_issue_occurrences.
    Query params: projectKey (optional) to run for one project only; otherwise all projects.
    Suggested schedule: every 6 hours (e.g. 0 */6 * * *).
    """
    project_key = request.query_params.get("projectKey", "").strip() or None
    logger.info("POST /issues/run received projectKey=%s", project_key or "(all)")
    try:
        result = await run_issues_aggregation(get_database, project_key=project_key)
        msg = (
            f"Processed {result['sessionsProcessed']} session(s), "
            f"created {result['issuesCreated']} issue(s), "
            f"inserted {result['occurrencesInserted']} occurrence(s)."
        )
        if result["sessionsProcessed"] == 0:
            msg += " No closed sessions in window or none had console errors/warnings."
        return {"success": True, "message": msg, **result}
    except Exception as e:
        logger.exception("POST /issues/run failed: %s", e)
        response.status_code = 500
        return {
            "success": False,
            "error": str(e),
            "message": f"Run failed: {e}",
            "projectsProcessed": 0,
            "sessionsProcessed": 0,
            "issuesCreated": 0,
            "occurrencesInserted": 0,
        }


@app.post("/reports/generate")
async def reports_generate(request: Request, response: Response) -> dict[str, Any]:
    """
    Generate a UX report for a project. Query params: projectKey (required), type=weekly|daily|monthly, use_llm=1|0.
    """
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        response.status_code = 400
        return {"success": False, "error": "projectKey is required"}
    report_type = (request.query_params.get("type") or "weekly").lower()
    if report_type not in ("daily", "weekly", "monthly"):
        report_type = "weekly"
    use_llm = request.query_params.get("use_llm", "1").lower() in ("1", "true", "yes")
    try:
        report = await generate_report(
            get_database,
            project_key,
            report_type=report_type,
            use_llm=use_llm,
        )
        return {"success": True, "data": report}
    except Exception as e:
        logger.exception("POST /reports/generate failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.get("/reports")
async def list_reports(request: Request) -> dict[str, Any]:
    """List reports for a project. Query params: projectKey (required), limit=20, type=weekly|daily|monthly."""
    project_key = request.query_params.get("projectKey", "").strip()
    if not project_key:
        return {"success": False, "error": "projectKey is required", "data": []}
    try:
        limit_val = request.query_params.get("limit", "20")
        limit = min(50, max(1, int(limit_val)))
    except ValueError:
        limit = 20
    report_type = request.query_params.get("type", "").strip().lower() or None
    db = get_database()
    coll = db["quicklook_reports"]
    query = {"projectKey": project_key}
    if report_type and report_type in ("daily", "weekly", "monthly"):
        query["type"] = report_type
    cursor = coll.find(query).sort("generatedAt", -1).limit(limit)
    reports = [doc async for doc in cursor]
    for r in reports:
        r.pop("_id", None)
        if r.get("period") and isinstance(r["period"], dict):
            r["period"] = {
                k: v.isoformat() if hasattr(v, "isoformat") else v
                for k, v in r["period"].items()
            }
        if hasattr(r.get("generatedAt"), "isoformat"):
            r["generatedAt"] = r["generatedAt"].isoformat()
    return {"success": True, "data": reports}


@app.get("/reports/{report_id}")
async def get_report(report_id: str) -> dict[str, Any]:
    """Get a single report by reportId."""
    db = get_database()
    report = await db["quicklook_reports"].find_one({"reportId": report_id})
    if not report:
        return {"success": False, "error": "Report not found", "data": None}
    report.pop("_id", None)
    if report.get("period") and isinstance(report["period"], dict):
        report["period"] = {
            k: v.isoformat() if hasattr(v, "isoformat") else v
            for k, v in report["period"].items()
        }
    if hasattr(report.get("generatedAt"), "isoformat"):
        report["generatedAt"] = report["generatedAt"].isoformat()
    return {"success": True, "data": report}


def _decode_pubsub_body(body: bytes) -> dict[str, Any]:
    """Decode Pub/Sub push message body (JSON with optional message.data base64)."""
    try:
        data = json.loads(body.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


async def _run_batch(
    reprocess: bool = False,
    include_active: bool = False,
    limit: int = 100,
    concurrency: int = 3,
    run_root_cause: bool = True,
) -> tuple[int, int]:
    """
    Fetch sessions and process each (up to concurrency at a time). Returns (processed_count, total_in_collection).
    Default: closed only, aiProcessed != true, limit 100, concurrency 3, run_root_cause=True (Gemini per session).
    run_root_cause=False: rule-based friction only, no Gemini (use for large batches / 10k+ sessions).
    """
    db = get_database()
    coll = db[SESSION_COLLECTION]
    total_in_collection = await coll.count_documents({})
    logger.info("DB %s collection %s: total documents = %d", db.name, SESSION_COLLECTION, total_in_collection)
    query = {}
    if include_active:
        # All sessions
        pass
    else:
        query["status"] = "closed"
    if not reprocess:
        query["$or"] = [{"aiProcessed": {"$ne": True}}, {"aiProcessed": {"$exists": False}}]
    logger.info("Batch query: %s", query)
    one = await coll.find_one(query)
    logger.info("Batch find_one(query) returned: %s", "doc" if one else "None")
    sessions = [doc async for doc in coll.find(query).limit(limit)]
    logger.info("Batch: found %d sessions to process (reprocess=%s, include_active=%s, concurrency=%s)", len(sessions), reprocess, include_active, concurrency)
    count = 0
    sem = asyncio.Semaphore(max(1, min(concurrency, 10)))

    async def process_one(doc: dict) -> bool:
        nonlocal count
        sid = doc.get("sessionId", "")[:8]
        async with sem:
            try:
                await process_session(doc, run_root_cause=run_root_cause)
                count += 1
                logger.info("Processed %s (%d/%d)", sid, count, len(sessions))
                return True
            except Exception as e:
                logger.exception("process_session failed for sessionId=%s: %s", doc.get("sessionId"), e)
                return False

    await asyncio.gather(*[process_one(doc) for doc in sessions])
    return count, total_in_collection


@app.post("/process")
async def process(request: Request, response: Response) -> dict[str, Any]:
    """
    Process sessions: closed + unprocessed by default (limit 100).
    Query params:
      - reprocess=1  – include closed sessions that are already aiProcessed
      - all=1        – same as reprocess=1 and include_active=1 (all sessions)
      - include_active=1 – process active sessions too
      - limit=500    – max sessions to process (default 100)
      - root_cause=0 – rule-based friction only, no Gemini (for large batches; see README scaling)
    """
    body = await request.body()
    payload = _decode_pubsub_body(body)
    message = payload.get("message") or {}
    if message.get("data"):
        try:
            decoded = base64.b64decode(message["data"]).decode("utf-8")
            logger.info("Pub/Sub message.data (decoded): %s", decoded[:200] if len(decoded) > 200 else decoded)
        except Exception as e:
            logger.warning("Could not decode message.data: %s", e)

    logger.info("POST /process received (reprocess=%s, all=%s, limit=%s)", request.query_params.get("reprocess"), request.query_params.get("all"), request.query_params.get("limit"))
    reprocess = request.query_params.get("reprocess", "").lower() in ("1", "true", "yes")
    all_sessions = request.query_params.get("all", "").lower() in ("1", "true", "yes")
    include_active = all_sessions or request.query_params.get("include_active", "").lower() in ("1", "true", "yes")
    if all_sessions:
        reprocess = True
    try:
        limit_val = request.query_params.get("limit", "")
        limit = int(limit_val) if limit_val.isdigit() else 100
        limit = min(max(1, limit), 2000)
    except ValueError:
        limit = 100
    try:
        conc_val = request.query_params.get("concurrency", "") or os.environ.get("ANALYTICS_CONCURRENCY", "3")
        concurrency = int(conc_val) if str(conc_val).isdigit() else 3
        concurrency = max(1, min(concurrency, 10))
    except (ValueError, TypeError):
        concurrency = 3
    root_cause_param = request.query_params.get("root_cause", "").lower()
    run_root_cause = root_cause_param not in ("0", "false", "no")

    try:
        count, total_in_collection = await _run_batch(reprocess=reprocess, include_active=include_active, limit=limit, concurrency=concurrency, run_root_cause=run_root_cause)
        return {
            "success": True,
            "processed": count,
            "totalInCollection": total_in_collection,
            "message": f"Processed {count} session(s). Total sessions in DB: {total_in_collection}. Check server logs for details.",
        }
    except Exception as e:
        logger.exception("_run_batch failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}


@app.post("/")
async def root_process(request: Request, response: Response) -> dict[str, Any]:
    """
    Pub/Sub push endpoint (root). Same behavior as POST /process so the default
    analytics-subscription push URL (service root) works without changing subscription.
    """
    return await process(request, response)


@app.post("/schedule")
async def schedule(request: Request, response: Response) -> dict[str, Any]:
    """
    Dispatcher for scheduled jobs that run per-project or once: cluster, patterns_sync,
    reports, retrain. Invoked by Pub/Sub push from topic quicklook-analytics-schedule.
    Message body (JSON, or message.data base64): {"task":"cluster"|"patterns_sync"|"reports"|"retrain", "type":"daily"|"weekly"|"monthly"}.
    For "reports", "type" is required. Lists project keys from closed sessions and runs the task per project (except retrain = once for all).
    """
    body = await request.body()
    payload = _decode_pubsub_body(body)
    message = payload.get("message") or {}
    data_str = None
    if message.get("data"):
        try:
            data_str = base64.b64decode(message["data"]).decode("utf-8")
        except Exception as e:
            logger.warning("Could not decode schedule message.data: %s", e)
    if not data_str:
        data_str = body.decode("utf-8") if isinstance(body, bytes) else ""
    try:
        data = json.loads(data_str) if data_str.strip() else {}
    except json.JSONDecodeError:
        data = {}
    task = (data.get("task") or "").strip().lower()
    report_type = (data.get("type") or "weekly").strip().lower()
    if report_type not in ("daily", "weekly", "monthly"):
        report_type = "weekly"

    if not task:
        logger.info("POST /schedule ignored: no task in body")
        return {"success": True, "message": "No task in body", "task": None}

    db = get_database()
    sessions_coll = db[SESSION_COLLECTION]
    project_keys = await sessions_coll.distinct(
        "projectKey",
        {"status": "closed", "closedAt": {"$exists": True, "$ne": None}},
    )
    project_keys = [k for k in project_keys if k]

    if task == "retrain":
        try:
            result = await run_retrain(get_database, project_key=None)
            return {"success": True, "task": "retrain", **result}
        except Exception as e:
            logger.exception("POST /schedule retrain failed: %s", e)
            response.status_code = 500
            return {"success": False, "task": "retrain", "error": str(e)}

    if task == "cluster":
        ok, failed = 0, 0
        for pk in project_keys:
            try:
                await run_clustering_for_project(get_database, pk, limit=500, method="dbscan", use_llm_labels=False)
                ok += 1
            except Exception as e:
                logger.exception("schedule cluster failed for %s: %s", pk[:8], e)
                failed += 1
        return {"success": True, "task": "cluster", "projectsOk": ok, "projectsFailed": failed}

    if task == "patterns_sync":
        ok, failed = 0, 0
        for pk in project_keys:
            try:
                await sync_patterns_from_insights(get_database, pk, limit_insights=200)
                ok += 1
            except Exception as e:
                logger.exception("schedule patterns_sync failed for %s: %s", pk[:8], e)
                failed += 1
        return {"success": True, "task": "patterns_sync", "projectsOk": ok, "projectsFailed": failed}

    if task == "reports":
        ok, failed = 0, 0
        for pk in project_keys:
            try:
                await generate_report(get_database, pk, report_type=report_type, use_llm=True)
                ok += 1
            except Exception as e:
                logger.exception("schedule reports failed for %s: %s", pk[:8], e)
                failed += 1
        return {"success": True, "task": "reports", "type": report_type, "projectsOk": ok, "projectsFailed": failed}

    logger.info("POST /schedule ignored: unknown task=%s", task)
    return {"success": True, "message": f"Unknown task {task}", "task": task}
