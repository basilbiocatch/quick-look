# Scheduled endpoints (Cloud Scheduler → Pub/Sub → Analytics)

All scheduled work hits the **analytics service** base URL (e.g. `https://quicklook-analytics-xxx.run.app`). Use one Pub/Sub topic and dispatch by **path** and **message body**, or use separate topics per task.

---

## Runtime limits and “too many records”

### Where limits apply

| Layer | Limit | What to do |
|-------|--------|------------|
| **Cloud Run** | Request timeout: **default 5 min**, **max 60 min**. | Set timeout to 15–30 min for batch jobs. In Cloud Run: *Edit & deploy new revision → Request timeout*. |
| **Pub/Sub** | Ack deadline (how long the subscriber has to finish before the message is redelivered). Default ~10 s. | Set subscription **ack deadline to at least your request timeout** (e.g. 1800 s = 30 min). Otherwise the message is redelivered and you may process the same batch twice. |
| **Analytics `/process`** | `limit` query param: **max 2000** sessions per run. | Don’t max it out in one go; use a **safe batch size** so one run finishes well under the request timeout. |

### “Too many records” – you’re not limited to one run

- You **don’t** need to process all unprocessed sessions in a single request.
- Each scheduled run processes **one batch** (e.g. 300–500 sessions with `root_cause=0`). When the next run fires (e.g. 6 hours later), it processes the **next** batch of unprocessed sessions.
- So a backlog of 50k sessions is fine: every 6h you process another chunk until the queue drains. No need to increase batch size to “finish everything in one job.”

### Recommended batch sizes (stay within ~15–20 min per run)

| Mode | Recommended `limit` | Why |
|------|---------------------|-----|
| **`root_cause=0`** (rule-only, no Gemini) | **300–500** | Each session: fetch events (GCS or Mongo) + friction detection. With concurrency 5–10, 500 sessions ≈ 10–20 min depending on event size. |
| **`root_cause=1`** (Gemini per session) | **50–100** | Gemini adds ~3–10 s per session. Only use for small batches or on-demand; avoid in scheduled production jobs. |

Suggested production URL for the 6h job:

`POST <ANALYTICS_URL>/process?limit=400&root_cause=0&concurrency=5`

Set **Cloud Run request timeout** to **30 min** and **Pub/Sub ack deadline** to **30 min** (1800 s) so the run can finish and ack before redelivery.

### When a user (or total traffic) has more than ~1000 sessions every 6 hours

If you process 400 per run every 6h, you only clear 400 sessions in that window. So **&gt;400 new closed sessions per 6h** means the backlog grows. For **&gt;1000 every 6h** you need to process more in that same window. Options:

| Option | What to do | Throughput (per 6h) |
|--------|------------|----------------------|
| **A. Run more often** | Keep `limit=400`, run the same job **every 2 hours** (or every 1 hour). | 3 runs × 400 = **1200** per 6h (every 2h). 6 runs × 400 = **2400** per 6h (every 1h). |
| **B. Bigger batch + 60 min timeout** | Use **60 min** request timeout and ack deadline. Raise `limit=1000` and `concurrency=8`. One run every 6h. | **~1000–1500** per run (depends on GCS/DB latency). If each session averages ~20 s, 8 concurrent → ~1440 in 60 min. |
| **C. Both** | Run every 2h with `limit=800`, timeout 60 min. | 3 × 800 = **2400** per 6h. |

**Recommendation:** Start with **A** (e.g. run every 2h, `limit=400`). No config change to Cloud Run timeout; you just add more Cloud Scheduler triggers. If one customer (or total) consistently exceeds that, add **B** (single run with higher limit and 60 min timeout) or **C**.

If you ever need more than a few thousand per 6h, the next step is **parallel workers**: e.g. one Pub/Sub message per project (or per shard), so multiple Cloud Run instances each process a different slice of work. That requires the dispatcher or scheduler to send multiple messages (e.g. one per `projectKey`) so batches don’t overlap.

---

## 1. Process sessions (batch)

| Item | Value |
|------|--------|
| **Endpoint** | `POST /process` |
| **Purpose** | Process closed, unprocessed sessions: friction detection, optional root cause (Gemini), session summary. Writes to `quicklook_sessions`. |
| **Suggested schedule** | Every 6 hours (e.g. `0 */6 * * *`) |
| **Query params** | `limit=400` (recommended for batch; max 2000), `root_cause=0` (rule-only, no Gemini), `concurrency=5` (optional) |
| **Body** | Pub/Sub push: can send `{}` or `{"task":"process_sessions"}`. Service ignores body for this path. |
| **Notes** | This is the main batch job. Keep `root_cause=0` in production. Use a limit that finishes in &lt;30 min so you stay under Cloud Run timeout and Pub/Sub ack deadline (see “Runtime limits” above). |

**Example Cloud Scheduler message:**  
`POST <ANALYTICS_URL>/process?limit=400&root_cause=0&concurrency=5`

---

## 2. Generate insights

| Item | Value |
|------|--------|
| **Endpoint** | `POST /insights/generate` |
| **Purpose** | Per project: group sessions by friction, run impact estimation, upsert `quicklook_insights`, attach suggested fixes. |
| **Suggested schedule** | After process (e.g. same 6h trigger, or 30 min after process). **Per project** (see below). |
| **Query params** | `projectKey` (required), `limit=500`, `period_days=7` |
| **Body** | Not used. |
| **Notes** | Requires `projectKey`. For “all projects” you need either a wrapper that lists projects and calls this per project, or a single job that receives a list of project keys in the message. |

**Example:**  
`POST <ANALYTICS_URL>/insights/generate?projectKey=my-project&limit=500&period_days=7`

---

## 3. Run clustering

| Item | Value |
|------|--------|
| **Endpoint** | `POST /cluster` |
| **Purpose** | Per project: extract features from sessions, run DBSCAN/K-Means, write `quicklook_behavior_clusters`, set `behaviorCluster` on sessions. |
| **Suggested schedule** | After process (or with insights). **Per project**. |
| **Query params** | `projectKey` (required), `limit=500`, `method=dbscan`, `llm_labels=0` (optional labels) |
| **Body** | Not used. |
| **Notes** | Same “per project” consideration as insights. |

**Example:**  
`POST <ANALYTICS_URL>/cluster?projectKey=my-project&limit=500&method=dbscan`

---

## 4. Generate reports

| Item | Value |
|------|--------|
| **Endpoint** | `POST /reports/generate` |
| **Purpose** | Per project: aggregate metrics, top insights, clusters, anomalies; one Gemini call for narrative; store in `quicklook_reports`. |
| **Suggested schedule** | Daily: 6 AM UTC. Weekly: Monday 6 AM UTC. **Per project**. |
| **Query params** | `projectKey` (required), `type=weekly` or `daily` or `monthly`, `use_llm=1` |
| **Body** | Not used. |
| **Notes** | Uses Gemini (one call per report). For “all projects” you need a job that calls this once per project. |

**Examples:**  
- Daily: `POST <ANALYTICS_URL>/reports/generate?projectKey=my-project&type=daily`  
- Weekly: `POST <ANALYTICS_URL>/reports/generate?projectKey=my-project&type=weekly`

---

## 5. Sync pattern library

| Item | Value |
|------|--------|
| **Endpoint** | `POST /patterns/sync` |
| **Purpose** | Per project: build/update `quicklook_patterns` from existing `quicklook_insights`. |
| **Suggested schedule** | After insights (e.g. same job or weekly). **Per project**. |
| **Query params** | `projectKey` (required), `limit=200` |
| **Body** | Not used. |
| **Notes** | Optional; pattern library can also be updated from “update-from-insight” and “update-from-ab-test” when users resolve insights or complete A/B tests. |

**Example:**  
`POST <ANALYTICS_URL>/patterns/sync?projectKey=my-project`

---

## 6. Retrain lift model

| Item | Value |
|------|--------|
| **Endpoint** | `POST /models/retrain` |
| **Purpose** | Collect training data from resolved insights (with `actualLift`) and completed A/B tests; retrain lift predictor; persist model. |
| **Suggested schedule** | Weekly or monthly (e.g. Sunday 3 AM UTC). Optional `projectKey` to limit to one project. |
| **Query params** | `projectKey` (optional; omit to use all projects) |
| **Body** | Not used. |
| **Notes** | No Gemini. Needs enough resolved insights or completed A/B tests with actual lift (e.g. ≥5 rows) to train. |

**Example:**  
`POST <ANALYTICS_URL>/models/retrain`  
or  
`POST <ANALYTICS_URL>/models/retrain?projectKey=my-project`

---

## 7. Issues aggregation (bugs dashboard)

| Item | Value |
|------|--------|
| **Endpoint** | `POST /issues/run` |
| **Purpose** | Aggregate JS errors and warnings from session events into `quicklook_issues` and `quicklook_issue_occurrences` for the Issues (bugs) dashboard. Reads closed sessions since last run, fetches events (Mongo or GCS), extracts `ql_console` error/warn, normalizes signatures, upserts issues and occurrences. |
| **Suggested schedule** | Every 6 hours (e.g. `0 */6 * * *`), same cadence as `/process`. |
| **Query params** | `projectKey` (optional; omit to run for all projects) |
| **Body** | Not used. |
| **Notes** | Uses same MongoDB collections as quicklook-server (`quicklook_issues`, `quicklook_issue_occurrences`, `quicklook_issue_job_state`). No Gemini. |

**Example:**  
`POST <ANALYTICS_URL>/issues/run`  
or  
`POST <ANALYTICS_URL>/issues/run?projectKey=my-project`

### Making the issues job run on schedule

The **same** Cloud Scheduler job (every 6h) that triggers session processing can trigger the issues job by using **two push subscriptions** on the same topic:

1. **analytics-subscription** → push to `<ANALYTICS_URL>/` or `<ANALYTICS_URL>/process` (session processing).
2. **analytics-issues-subscription** → push to `<ANALYTICS_URL>/issues/run` (bugs aggregation).

When you run `quicklook-analytics/infra/setup-pubsub.sh` with `CLOUD_RUN_URL` set, it creates/updates both subscriptions. Each time the scheduler publishes one message, both endpoints are invoked. No second scheduler job is required.

If you only ran Pub/Sub setup before the issues feature existed, **re-run** `setup-pubsub.sh` so the second subscription is created:

```bash
export CLOUD_RUN_URL=https://quicklook-analytics-xxxx.run.app
cd quicklook-analytics/infra && ./setup-pubsub.sh
```

### Verifying the issues job

1. **Trigger manually (local)**  
   With the analytics service running locally (same MongoDB as your app):
   ```bash
   curl -X POST "http://localhost:8080/issues/run"
   ```
   Response should include `success: true`, `sessionsProcessed`, `issuesCreated`, `occurrencesInserted`. If `sessionsProcessed === 0`, either there are no closed sessions in the lookback window or none have console error/warn events (`ql_console`).

2. **Trigger manually (production)**  
   ```bash
   curl -X POST "https://<ANALYTICS_URL>/issues/run" -H "Authorization: Bearer $(gcloud auth print-identity-token)"
   ```
   (Use the same auth as for other protected analytics endpoints.)

3. **Check data**  
   - MongoDB: `quicklook_issues`, `quicklook_issue_occurrences`, `quicklook_issue_job_state` (per-project `lastProcessedClosedAt`).
   - App: Issues (bugs) dashboard should list issues and occurrences after the job has run and sessions with JS errors/warnings exist.

4. **Confirm it’s scheduled**  
   - **Pub/Sub:** In GCP Console → Pub/Sub → Subscriptions, confirm `analytics-issues-subscription` exists and its push endpoint is `https://<your-analytics-url>/issues/run`.
   - **Scheduler:** One job (e.g. `process-analytics`) publishing to the topic every 6h is enough; both subscriptions receive the message and invoke their endpoints.

---

## Summary: what to schedule

| # | Endpoint | Suggested frequency | Per project? |
|---|----------|---------------------|--------------|
| 1 | `POST /process` | Every 6 hours | No (all sessions in DB) |
| 2 | `POST /insights/generate` | After process (e.g. 6h or 1x/day) | **Yes** |
| 3 | `POST /cluster` | After process (e.g. 6h or 1x/day) | **Yes** |
| 4 | `POST /reports/generate` | Daily 6 AM + Weekly Mon 6 AM | **Yes** |
| 5 | `POST /patterns/sync` | After insights or weekly | **Yes** |
| 6 | `POST /models/retrain` | Weekly or monthly | No (optional project filter) |
| 7 | `POST /issues/run` | Every 6 hours | No (optional projectKey) |

---

## “All projects” jobs

Endpoints 2–5 require a `projectKey`. Two options:

1. **Single topic + dispatcher**  
   One Cloud Scheduler job sends a message to Pub/Sub. The analytics service has a **single scheduled entrypoint** (e.g. `POST /schedule` or `POST /process`) that:
   - Reads message body (e.g. `{"task":"insights_generate"}` or `{"task":"reports_generate","type":"weekly"}`).
   - Loads list of project keys (e.g. from `quicklook_projects` or distinct `projectKey` in `quicklook_sessions`).
   - For each project, calls the right internal logic or HTTP to itself (e.g. insights/generate, cluster, reports/generate, patterns/sync).

2. **Per-project scheduler jobs**  
   You create one Cloud Scheduler job per project (or a small script that creates jobs from a project list). Each job POSTs to the same endpoint with the right `projectKey` query param.

For a small number of projects, (2) is simple. For many projects, (1) is easier to maintain.

### Implemented: `POST /schedule` dispatcher

The analytics service exposes **`POST /schedule`** for “all projects” jobs. It is invoked by a **separate topic** `quicklook-analytics-schedule` and one push subscription → `/schedule`. Message body (JSON, or Pub/Sub `message.data` base64): `{"task":"cluster"|"patterns_sync"|"reports"|"retrain", "type":"daily"|"weekly"|"monthly"}` (for `reports`, `type` is required). The handler lists project keys from closed sessions and runs the task per project (except `retrain`, which runs once for all).

| task           | Effect |
|----------------|--------|
| `cluster`      | Run behavior clustering for each project (limit 500, dbscan). |
| `patterns_sync` | Sync pattern library from insights for each project. |
| `reports`      | Generate report per project; use `type`: daily, weekly, or monthly. |
| `retrain`      | Retrain lift model once (all projects). |

**Infra:** Run `quicklook-analytics/infra/setup-pubsub.sh` (creates the schedule topic and subscription) and `setup-scheduler-schedule.sh` (creates Cloud Scheduler jobs: `analytics-cluster`, `analytics-patterns-sync` every 6h; `analytics-reports-daily` daily 6 AM UTC; `analytics-reports-weekly` Mon 6 AM UTC; `analytics-retrain` Sun 3 AM UTC). See `infra/README.md`.

---

## Endpoints that should NOT be scheduled (on-demand only)

- `GET /session/{id}/ensure-root-cause` – when user opens a session (ReplayPage).
- `GET /session/{id}/ensure-summary` – when user opens a session.
- `POST /patterns/update-from-insight` – when user marks an insight resolved (server calls this).
- `POST /patterns/update-from-ab-test` – when user completes an A/B test (server calls this).
- `GET /health` – health checks only.
