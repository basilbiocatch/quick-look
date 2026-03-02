# Quicklook Analytics (Phase 1)

Python service for AI UX analytics: FastAPI, MongoDB (Motor), Pub/Sub handler.

**Deploy to GCP:** see [RELEASE.md](./RELEASE.md).

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

POST `/process` finds closed sessions that are not yet `aiProcessed` and marks them processed (Phase 1 stub only updates the flag).

```bash
curl -X POST http://127.0.0.1:8080/process -H "Content-Type: application/json" -d '{}'
# Expected: {"success":true}
```

If you have closed sessions in the DB, some will get `aiProcessed: true` and `aiProcessedAt` set. Check in MongoDB or via quicklook-server’s session API.

### 5. Using the server’s .env

To reuse the exact same DB as the Node server without copying secrets:

```bash
cd quicklook-analytics
export $(grep -v '^#' ../quicklook-server/.env | xargs)
uvicorn src.main:app --reload --port 8080
```

Then run the `curl` commands above.
