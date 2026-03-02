"""Fetch rrweb events for a session from MongoDB chunks or GCS (when storageType is gcs)."""
import asyncio
import gzip
import json
import logging
import re
from typing import Any

from src import config
from src.db.connection import get_database

CHUNKS_COLLECTION = "quicklook_chunks"
CHUNK_PATTERN = re.compile(r"^[^/]+/chunk-(\d+)\.json\.gz$")
logger = logging.getLogger(__name__)

_gcs_client = None


def _get_gcs_bucket():
    """Lazy init GCS bucket; returns None if GCS_BUCKET not set or import fails."""
    global _gcs_client
    bucket_name = getattr(config, "GCS_BUCKET", "") or ""
    if not bucket_name:
        return None
    try:
        # Prefer direct module path to avoid namespace conflict with google-generativeai
        import importlib.util
        spec = importlib.util.find_spec("google.cloud.storage")
        if spec is None or spec.origin is None or spec.loader is None:
            raise ImportError("google.cloud.storage not found")
        storage_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(storage_module)
        if _gcs_client is None:
            _gcs_client = storage_module.Client()
        return _gcs_client.bucket(bucket_name)
    except Exception as e:
        try:
            from google.cloud import storage
            if _gcs_client is None:
                _gcs_client = storage.Client()
            return _gcs_client.bucket(bucket_name)
        except Exception as e2:
            logger.warning(
                "GCS client init failed. Install: pip install google-cloud-storage google-cloud-core. Error: %s",
                e2,
            )
            return None


def _download_and_parse_chunk_sync(blob_name: str, index: int) -> tuple[int, list[dict[str, Any]] | None]:
    """Download one blob, decompress, parse. Returns (index, events) or (index, None) on failure. Sync for to_thread."""
    bucket = _get_gcs_bucket()
    if bucket is None:
        return (index, None)
    try:
        raw = bucket.blob(blob_name).download_as_bytes()
    except Exception as e:
        logger.warning("GCS download failed for %s: %s", blob_name, e)
        return (index, None)
    try:
        decompressed = gzip.decompress(raw)
        events = json.loads(decompressed.decode("utf-8"))
    except gzip.BadGzipFile:
        try:
            events = json.loads(raw.decode("utf-8"))
        except Exception as e:
            logger.warning("GCS chunk parse failed %s: %s", blob_name, e)
            return (index, None)
    except Exception as e:
        logger.warning("GCS chunk decompress/parse failed %s: %s", blob_name, e)
        return (index, None)
    return (index, events) if isinstance(events, list) else (index, None)


async def _get_events_from_gcs(session_id: str) -> list[dict[str, Any]]:
    """List blobs, then download and parse chunks in parallel (much faster than sequential)."""
    bucket = _get_gcs_bucket()
    if bucket is None:
        return []
    prefix = f"{session_id}/"
    try:
        blobs = await asyncio.to_thread(lambda: list(bucket.list_blobs(prefix=prefix)))
    except Exception as e:
        logger.warning("GCS list_blobs failed for session %s: %s", session_id[:8], e)
        return []
    # Build (index, blob_name) for each chunk
    chunk_specs: list[tuple[int, str]] = []
    for blob in blobs:
        match = CHUNK_PATTERN.match(blob.name)
        if not match:
            continue
        index = int(match.group(1), 10)
        chunk_specs.append((index, blob.name))
    if not chunk_specs:
        return []
    # Limit concurrent GCS downloads per session to avoid "connection pool is full" (urllib3 default 10)
    max_concurrent = 8
    sem = asyncio.Semaphore(max_concurrent)

    async def download_one(idx: int, name: str):
        async with sem:
            return await asyncio.to_thread(_download_and_parse_chunk_sync, name, idx)

    results = await asyncio.gather(*[download_one(idx, name) for idx, name in chunk_specs])
    chunks = [(idx, ev) for idx, ev in results if ev is not None]
    chunks.sort(key=lambda x: x[0])
    out = []
    for _, chunk_events in chunks:
        out.extend(chunk_events)
    return out


async def _get_events_from_mongo(session_id: str) -> list[dict[str, Any]]:
    """Load events from quicklook_chunks (MongoDB)."""
    db = get_database()
    coll = db[CHUNKS_COLLECTION]
    cursor = coll.find(
        {"sessionId": session_id},
        {"index": 1, "events": 1},
    ).sort("index", 1)
    docs = await cursor.to_list(length=1000)
    events = []
    for c in docs:
        chunk_events = c.get("events")
        if isinstance(chunk_events, list):
            events.extend(chunk_events)
    return events


async def get_events_for_session(
    session_id: str,
    session_doc: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Load rrweb events for a session.
    - If session_doc has storageType "gcs" and GCS_BUCKET is set, fetches from GCS.
    - Otherwise fetches from MongoDB quicklook_chunks.
    Returns list of raw event dicts (type, data, timestamp).
    """
    storage_type = (session_doc or {}).get("storageType", "").strip().lower()
    if storage_type == "gcs" and getattr(config, "GCS_BUCKET", ""):
        return await _get_events_from_gcs(session_id)
    return await _get_events_from_mongo(session_id)
