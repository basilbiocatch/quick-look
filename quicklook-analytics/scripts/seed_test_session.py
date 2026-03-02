"""
Seed one closed session with one chunk of rrweb events (rage-click pattern)
so you can test the Phase 2 pipeline: POST /process then check frictionScore/frictionPoints.

Usage (from quicklook-analytics/ with .env set):
  python scripts/seed_test_session.py
"""
import asyncio
import os
import uuid
from pathlib import Path

# Load .env from quicklook-analytics root
_root = Path(__file__).resolve().parent.parent
_env = _root / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

os.chdir(_root)
# Ensure package imports work
import sys
sys.path.insert(0, str(_root))

from src.db.connection import get_database
from datetime import datetime, timezone

SESSION_COLLECTION = "quicklook_sessions"
CHUNKS_COLLECTION = "quicklook_chunks"


def make_test_events(session_id: str):
    """One meta, one full snapshot (minimal), then incremental rage-click pattern (type 3, source 2)."""
    base_ts = 1000000
    return [
        {"type": 4, "data": {"href": "https://example.com/test"}, "timestamp": base_ts},
        {
            "type": 2,
            "data": {
                "nodes": [
                    [1, 0, "button", {"id": "submit-btn", "class": "btn"}, []],
                ]
            },
            "timestamp": base_ts + 1,
        },
        {"type": 3, "data": {"source": 2, "type": 0, "id": 1, "x": 100, "y": 200}, "timestamp": base_ts + 100},
        {"type": 3, "data": {"source": 2, "type": 0, "id": 1, "x": 100, "y": 200}, "timestamp": base_ts + 250},
        {"type": 3, "data": {"source": 2, "type": 0, "id": 1, "x": 100, "y": 200}, "timestamp": base_ts + 400},
    ]


async def main():
    db = get_database()
    session_id = f"test-phase2-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    await db[SESSION_COLLECTION].insert_one({
        "sessionId": session_id,
        "projectKey": "test-project",
        "status": "closed",
        "closedAt": now,
        "createdAt": now,
        "aiProcessed": False,
    })
    await db[CHUNKS_COLLECTION].insert_one({
        "sessionId": session_id,
        "index": 0,
        "events": make_test_events(session_id),
    })
    print(f"Created closed session: {session_id}")
    print("Run: curl -X POST http://127.0.0.1:8080/process -H 'Content-Type: application/json' -d '{}'")
    print(f"Then check session {session_id} in DB for frictionScore and frictionPoints.")


if __name__ == "__main__":
    asyncio.run(main())
