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
async def ensure_root_cause(session_id: str) -> dict[str, Any]:
    """
    On-demand: ensure this session's friction points have Gemini root cause. Call when user opens
    a session (e.g. ReplayPage). If already present, returns immediately; otherwise runs Gemini,
    persists to session, then returns. Next open is fast (cached on session).
    """
    friction_points, generated = await ensure_root_cause_for_session(session_id)
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
