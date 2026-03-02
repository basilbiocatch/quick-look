# Quicklook Analytics

Python service for AI UX analytics: FastAPI, MongoDB (Motor), Pub/Sub handler.

**Deploy to GCP:** see [RELEASE.md](./RELEASE.md).

## Phase 2: Friction detection & root cause

**Database:** The same MongoDB as quicklook-server (`QUICKLOOK_DB`). No new collections are created. Analytics **reads** from `quicklook_chunks` and **updates** existing documents in `quicklook_sessions` (sets `frictionScore`, `frictionPoints`, `aiProcessed`, `aiProcessedAt`). Look for these fields on session documents in `quicklook_sessions`.

- **Event fetcher:** Loads rrweb events from MongoDB `quicklook_chunks` or from **GCS** when `storageType` is `gcs` (set **GCS_BUCKET** in `.env` to the same bucket name as quicklook-server).
- **Friction detector** (`friction_detector.py`): Rule-based detection of rage clicks (3+ on same element &lt;1s), hover confusion (3+ s before click), scroll confusion (back-and-forth).
- **Root cause analyzer** (`root_cause_analyzer.py`): DOM extraction from rrweb full snapshot + Gemini to explain why the user struggled; writes `root_cause`, `evidence`, `confidence` per friction point.
- **Session updates:** Each processed session gets `frictionScore` (0–100), `frictionPoints` (each with optional `root_cause`), `aiProcessed`, `aiProcessedAt`.

Set **GEMINI_API_KEY** in `.env` (or Cloud Run) for root cause explanations; without it, root cause falls back to rule-based context only.

### Scaling: when not to run Gemini for every session

By default, each processed session gets **Gemini root-cause** for up to 5 friction points. That works for small backlogs but **does not scale** to thousands of sessions (e.g. 10k sessions/month ⇒ up to 50k Gemini calls, cost and time).

**Recommended approach:**

1. **Batch with rule-only (no Gemini)**  
   Run the batch with `root_cause=0` so only **rule-based friction** is computed (fast, no API cost):
   ```bash
   curl -X POST "http://localhost:8080/process?limit=2000&root_cause=0"
   ```
   All sessions get `frictionScore`, `frictionPoints` with context; `root_cause` is the rule-based context only.

2. **Add Gemini only where it matters**  
   - **Option A (future):** On-demand when a user opens a session in the UI: call analytics to run root cause for that one session, then show the result.  
   - **Option B:** A separate, smaller batch with `root_cause=1` (default) and a lower `limit` (e.g. last 100 closed sessions or only high `frictionScore`), so only a subset gets Gemini.  
   - **Option C:** Scheduler runs rule-only daily (e.g. `limit=5000&root_cause=0`); you manually or periodically run a “premium” pass with Gemini on a cap (e.g. `limit=200`).

Use **root_cause=0** for “process everything”; use default **root_cause=1** for small batches or when you need AI explanations on a subset.

## Phase 3: Session summaries & clustering

- **ensure-summary:** `GET /session/{sessionId}/ensure-summary` (on-demand; batch does not run it).
- **clustering:** `POST /cluster?projectKey=X&limit=500`, `GET /cluster?projectKey=X`. New collection `quicklook_behavior_clusters`.

## Local check (Phase 1)

Use the **same MongoDB** as `quicklook-server` so the analytics service can read/update sessions.

### 1. Environment

```bash
cd quicklook-analytics

# Option A: Copy DB URL from quicklook-server
cp ../quicklook-server/.env .env
# Or copy only: grep QUICKLOOK_DB ../quicklook-server/.env and set in .env

# Option B: Create .env from example (local MongoDB)
cp .env.example .env
# Edit .env and set QUICKLOOK_DB to your MongoDB URL (same as server)
```

### 2. Install and run

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

uvicorn src.main:app --reload --host 127.0.0.1 --port 8080
```

### 3. Health check

In another terminal:

```bash
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok"}
```

### 4. Test batch process (optional)

POST `/process` finds closed sessions that are not yet `aiProcessed`, loads their events from MongoDB chunks, runs friction detection and root cause (Gemini), then updates each session with `frictionScore`, `frictionPoints`, `aiProcessed`, `aiProcessedAt`.

**Run on all sessions you have:** To process every session in the DB (including already-processed and active), use query params:

```bash
curl -X POST http://127.0.0.1:8080/process -H "Content-Type: application/json" -d '{}'
# Expected: {"success":true,"processed":N}
```

```bash
# Process all sessions, up to 500, with 5 in parallel (faster)
curl -X POST "http://127.0.0.1:8080/process?all=1&limit=500&concurrency=5" -H "Content-Type: application/json" -d '{}'
```
Use `concurrency=3` (default) to `10` to process multiple sessions at once; root-cause calls within each session run in parallel.

If you have closed sessions in the DB, some will get `aiProcessed: true` and `aiProcessedAt` set. Check in MongoDB or via quicklook-server’s session API.

### 5. Using the server’s .env

To reuse the exact same DB as the Node server without copying secrets:

```bash
cd quicklook-analytics
export $(grep -v '^#' ../quicklook-server/.env | xargs)
uvicorn src.main:app --reload --port 8080
```

Then run the `curl` commands above.

---

## How to test Phase 2

### Option A: Friction detector only (no DB, no Gemini)

Run the detector on mock events to confirm rage-click and scoring:

```bash
cd quicklook-analytics
source .venv/bin/activate
python -c "
from src.processors.friction_detector import analyze_session
# Empty → score 0
print(analyze_session([]))
# 3 quick clicks on same element → rage_click
events = [
    {'type': 3, 'data': {'source': 2, 'type': 0, 'id': 1, 'x': 10, 'y': 20}, 'timestamp': 1000},
    {'type': 3, 'data': {'source': 2, 'type': 0, 'id': 1, 'x': 10, 'y': 20}, 'timestamp': 1100},
    {'type': 3, 'data': {'source': 2, 'type': 0, 'id': 1, 'x': 10, 'y': 20}, 'timestamp': 1200},
]
r = analyze_session(events)
print('score', r['friction_score'], 'points', [p['type'] for p in r['friction_points']])
assert r['friction_score'] > 0 and any(p['type'] == 'rage_click' for p in r['friction_points'])
print('OK')
"
```

### Option B: Full pipeline (DB + optional Gemini)

1. **Same DB as server**  
   Use the same `QUICKLOOK_DB` in `quicklook-analytics/.env` as `quicklook-server` (copy from `quicklook-server/.env` or set manually).

2. **Get a closed session with events**  
   - Either **record a session** in the app (visit a page, click around, then close/leave so it becomes `status: "closed"`),  
   - Or **seed a test session** (see script below).

3. **Start analytics and trigger process**
   ```bash
   cd quicklook-analytics
   source .venv/bin/activate
   export $(grep -v '^#' .env | xargs)   # or use .env from quicklook-server
   uvicorn src.main:app --reload --host 127.0.0.1 --port 8080
   ```
   In another terminal:
   ```bash
   curl -X POST http://127.0.0.1:8080/process -H "Content-Type: application/json" -d '{}'
   # → {"success":true}
   ```

4. **Check the result**  
   - In **MongoDB Compass** (or shell): open `quicklook_sessions`, find a closed session that was unprocessed; after the run it should have `aiProcessed: true`, `frictionScore`, and `frictionPoints`.  
   - Or call the **server API** that returns session by id and inspect `frictionScore` / `frictionPoints` in the response.

**Note:** If sessions have `storageType: "gcs"`, set **GCS_BUCKET** in `.env` to the same bucket as quicklook-server. Otherwise the service cannot read events and you’ll get `frictionScore: 0` and empty `frictionPoints`.

**Why don’t I see any new data?**  
Analytics does **not** create new collections. It only **updates** documents in the existing **`quicklook_sessions`** collection (adds/overwrites `frictionScore`, `frictionPoints`, `aiProcessed`, `aiProcessedAt`). So:

1. **Same DB** – `quicklook-analytics` must use the **same** `QUICKLOOK_DB` as quicklook-server (same database name in the URI). In Compass, open that database and the **`quicklook_sessions`** collection.
2. **Only processed sessions change** – The batch processes documents where `status === "closed"` and `aiProcessed` is not `true`. After processing, those documents get the new fields. Filter for `aiProcessed: true` to see them.
3. **Run the batch** – You must `POST /process` (or have Pub/Sub trigger it). Until then, no session document is updated.
4. **GCS sessions** – If sessions have **`storageType: "gcs"`**, set **GCS_BUCKET** in analytics `.env` to the same bucket name as the server. Without it, events are not read and you get `frictionScore: 0` and empty `frictionPoints`.

### Option C: Seed a test session (script)

From repo root or `quicklook-analytics/`:

```bash
cd quicklook-analytics
source .venv/bin/activate
export $(grep -v '^#' .env | xargs)
python scripts/seed_test_session.py
```

Then run `curl -X POST http://127.0.0.1:8080/process -H "Content-Type: application/json" -d '{}'` and check that session in the DB (see Option B step 4). The script creates one closed session and one chunk with rage-click-style events so the pipeline can detect friction.
