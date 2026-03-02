"""Process a single session: fetch unprocessed, run pipeline (stub), mark processed."""
from datetime import datetime, timezone

from src.db.connection import get_database


SESSION_COLLECTION = "quicklook_sessions"


async def get_events_for_session(session_id: str) -> list:
    """
    Get rrweb events for a session.
    Phase 1: stub that returns [] (events from existing API or DB/GCS in later phases).
    """
    return []


async def process_session(session_doc: dict) -> None:
    """
    Process one session: get events (stub), run feature extraction (stub), mark aiProcessed.
    Phase 1: only updates session with aiProcessed=True and aiProcessedAt=now.
    """
    db = get_database()
    coll = db[SESSION_COLLECTION]
    session_id = session_doc.get("sessionId")
    if not session_id:
        return
    # Stub: get events (empty for Phase 1)
    events = await get_events_for_session(session_id)
    # Optional: parse and extract features when events exist (no-op for stub)
    now = datetime.now(timezone.utc)
    await coll.update_one(
        {"sessionId": session_id},
        {"$set": {"aiProcessed": True, "aiProcessedAt": now}},
    )
