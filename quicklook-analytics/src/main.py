"""FastAPI app: health check and Pub/Sub push handler for session processing."""
import base64
import json
import logging
from typing import Any

from fastapi import FastAPI, Request, Response

from src.db.connection import get_database
from src.processors.session_processor import process_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="quicklook-analytics")
SESSION_COLLECTION = "quicklook_sessions"


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check for load balancer and readiness probes."""
    return {"status": "ok"}


def _decode_pubsub_body(body: bytes) -> dict[str, Any]:
    """Decode Pub/Sub push message body (JSON with optional message.data base64)."""
    try:
        data = json.loads(body.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


async def _run_batch() -> None:
    """Fetch closed, unprocessed sessions (limit 100) and process each."""
    db = get_database()
    coll = db[SESSION_COLLECTION]
    cursor = coll.find(
        {
            "status": "closed",
            "$or": [{"aiProcessed": {"$ne": True}}, {"aiProcessed": {"$exists": False}}],
        }
    ).limit(100)
    sessions = await cursor.to_list(length=100)
    for doc in sessions:
        try:
            await process_session(doc)
        except Exception as e:
            logger.exception("process_session failed for sessionId=%s: %s", doc.get("sessionId"), e)


@app.post("/process")
async def process(request: Request, response: Response) -> dict[str, Any]:
    """
    Pub/Sub push endpoint: decode message body JSON, then fetch sessions where
    status=closed and aiProcessed != True (or missing), limit 100, and for each
    call session processor (stub marks aiProcessed=True, aiProcessedAt=now).
    """
    body = await request.body()
    payload = _decode_pubsub_body(body)
    # Optional: decode message.data if present (e.g. for subscription-specific payloads)
    message = payload.get("message") or {}
    if message.get("data"):
        try:
            decoded = base64.b64decode(message["data"]).decode("utf-8")
            logger.info("Pub/Sub message.data (decoded): %s", decoded[:200] if len(decoded) > 200 else decoded)
        except Exception as e:
            logger.warning("Could not decode message.data: %s", e)
    try:
        await _run_batch()
    except Exception as e:
        logger.exception("_run_batch failed: %s", e)
        response.status_code = 500
        return {"success": False, "error": str(e)}
    return {"success": True}
