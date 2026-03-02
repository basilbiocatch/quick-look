"""Process a single session: fetch events, run friction detection + root cause, update session."""
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from src.db.connection import get_database
from src.processors.dom_extractor import build_dom_cache
from src.processors.event_fetcher import get_events_for_session
from src.processors.friction_detector import analyze_session as run_friction_detection
from src.processors.root_cause_analyzer import analyze as run_root_cause_analysis
from src.processors.session_summarizer import (
    build_ai_summary_with_generated_at,
    summarize_session,
)

logger = logging.getLogger(__name__)

SESSION_COLLECTION = "quicklook_sessions"
MAX_ROOT_CAUSE_PER_SESSION = 5


async def _analyze_one_root_cause(
    fp: dict, events: list, session_doc: dict, session_id: str, dom_cache: dict | None = None
) -> dict:
    """Run root cause for one friction point; return fallback on error. dom_cache avoids rescanning events."""
    try:
        return await run_root_cause_analysis(fp, events, session_doc, dom_cache=dom_cache)
    except Exception as e:
        logger.warning("Root cause analysis failed for session %s fp %s: %s", session_id, fp.get("type"), e)
        return {"root_cause": fp.get("context", ""), "evidence": {}, "confidence": 0.0}


def _rule_only_root_cause(fp: dict) -> dict:
    """Rule-based root_cause only (no Gemini). Use for batch when run_root_cause=False."""
    return {"root_cause": fp.get("context", ""), "evidence": {}, "confidence": 0.0}


async def process_session(session_doc: dict, run_root_cause: bool = True) -> None:
    """
    Load events, run rule-based friction detection; optionally run root cause (DOM + Gemini) for
    up to 5 friction points. Updates session with frictionScore, frictionPoints, aiProcessed, aiProcessedAt.
    When run_root_cause=False, only rule-based context is stored (no Gemini calls; scales to large batches).
    """
    db = get_database()
    coll = db[SESSION_COLLECTION]
    session_id = session_doc.get("sessionId")
    if not session_id:
        return

    t0 = time.perf_counter()
    events = await get_events_for_session(session_id, session_doc)
    t_fetch = time.perf_counter() - t0
    t1 = time.perf_counter()
    friction_result = run_friction_detection(events)
    friction_score = friction_result["friction_score"]
    friction_points = friction_result["friction_points"]
    t_friction = time.perf_counter() - t1
    logger.info("session %s: fetch_events=%.2fs (n=%d), friction=%.2fs", session_id[:8], t_fetch, len(events), t_friction)

    if run_root_cause:
        to_analyze = friction_points[:MAX_ROOT_CAUSE_PER_SESSION]
        if to_analyze:
            t2 = time.perf_counter()
            dom_cache = build_dom_cache(events)
            results = await asyncio.gather(
                *[_analyze_one_root_cause(fp, events, session_doc, session_id, dom_cache) for fp in to_analyze],
                return_exceptions=False,
            )
            t_root = time.perf_counter() - t2
            logger.info("session %s: root_cause=%.2fs (points=%d)", session_id[:8], t_root, len(to_analyze))
            for fp, root in zip(to_analyze, results):
                fp["root_cause"] = root
        for fp in friction_points[MAX_ROOT_CAUSE_PER_SESSION:]:
            fp["root_cause"] = _rule_only_root_cause(fp)
    else:
        for fp in friction_points:
            fp["root_cause"] = _rule_only_root_cause(fp)

    now = datetime.now(timezone.utc)
    await coll.update_one(
        {"sessionId": session_id},
        {
            "$set": {
                "frictionScore": friction_score,
                "frictionPoints": friction_points,
                "aiProcessed": True,
                "aiProcessedAt": now,
            }
        },
    )


def _has_full_root_cause(fp: dict) -> bool:
    """True if friction point already has Gemini-style root_cause (dict with confidence)."""
    rc = fp.get("root_cause")
    return isinstance(rc, dict) and "confidence" in rc


async def ensure_root_cause_for_session(session_id: str) -> tuple[list[dict], bool]:
    """
    On-demand: ensure session's friction points have Gemini root cause. If they already do, return
    immediately. Otherwise load events, run Gemini for each point (up to MAX_ROOT_CAUSE_PER_SESSION),
    persist to session, return. Returns (friction_points, generated) where generated=True if we ran Gemini.
    """
    db = get_database()
    coll = db[SESSION_COLLECTION]
    session_doc = await coll.find_one({"sessionId": session_id})
    if not session_doc:
        return [], False

    friction_points = list(session_doc.get("frictionPoints") or [])
    if not friction_points:
        return friction_points, False

    to_analyze = [fp for fp in friction_points[:MAX_ROOT_CAUSE_PER_SESSION] if not _has_full_root_cause(fp)]
    if not to_analyze:
        return friction_points, False

    t0 = time.perf_counter()
    events = await get_events_for_session(session_id, session_doc)
    logger.info("ensure_root_cause %s: fetch_events=%.2fs (n=%d)", session_id[:8], time.perf_counter() - t0, len(events))
    t1 = time.perf_counter()
    dom_cache = build_dom_cache(events)
    results = await asyncio.gather(
        *[_analyze_one_root_cause(fp, events, session_doc, session_id, dom_cache) for fp in to_analyze],
        return_exceptions=False,
    )
    for fp, root in zip(to_analyze, results):
        fp["root_cause"] = root
    logger.info("ensure_root_cause %s: root_cause=%.2fs (points=%d)", session_id[:8], time.perf_counter() - t1, len(to_analyze))
    # Points beyond MAX_ROOT_CAUSE_PER_SESSION or already full are unchanged

    await coll.update_one(
        {"sessionId": session_id},
        {"$set": {"frictionPoints": friction_points}},
    )
    return friction_points, True


async def ensure_summary_for_session(session_id: str) -> tuple[dict[str, Any] | None, bool]:
    """
    On-demand: ensure session has aiSummary. If it already exists, return it and generated=False.
    Otherwise load events, run Gemini summarizer, write aiSummary to session, return (aiSummary, True).
    Uses friction data already on session (frictionScore, frictionPoints); if session not yet
    aiProcessed, runs friction detection from events for context.
    """
    db = get_database()
    coll = db[SESSION_COLLECTION]
    session_doc = await coll.find_one({"sessionId": session_id})
    if not session_doc:
        return None, False

    existing = session_doc.get("aiSummary")
    if existing and isinstance(existing, dict) and existing.get("generatedAt"):
        return existing, False

    t0 = time.perf_counter()
    events = await get_events_for_session(session_id, session_doc)
    logger.info("ensure_summary %s: fetch_events=%.2fs (n=%d)", session_id[:8], time.perf_counter() - t0, len(events))

    friction_score = session_doc.get("frictionScore") or 0
    friction_points = list(session_doc.get("frictionPoints") or [])
    if not friction_points and events:
        # Session not yet processed for friction; run rule-based friction for summary context only
        friction_result = run_friction_detection(events)
        friction_score = friction_result["friction_score"]
        friction_points = friction_result["friction_points"]

    t1 = time.perf_counter()
    summary = await summarize_session(
        session_doc,
        events,
        friction_score,
        friction_points,
    )
    ai_summary = build_ai_summary_with_generated_at(summary)
    logger.info("ensure_summary %s: summarizer=%.2fs", session_id[:8], time.perf_counter() - t1)

    await coll.update_one(
        {"sessionId": session_id},
        {"$set": {"aiSummary": ai_summary}},
    )
    return ai_summary, True
