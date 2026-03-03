# Next Phase Handoff: Phase 5 (A/B Test Suggestions & Pattern Library)

---

## Phase 5 implementation status (done)

- **pattern_library.py** – Pattern storage and matching: `find_matching_patterns()`, `upsert_pattern_from_insight()`, `sync_patterns_from_insights()`. Patterns keyed by (projectKey, frictionType, page); signature includes frictionType, page, element.
- **quicklook_patterns** – Collection used by analytics; schema: patternId, projectKey, name, signature, occurrences, affectedConversionRate, normalConversionRate, suggestedFixes (array of { description, expectedLift: { min, max }, confidence, priority, source }), abTestResults, updatedAt. Server model (quicklookPatternModel.js) has projectKey and suggestedFixes as Mixed.
- **lift_predictor.py** – Rule-based lift prediction from impact `estimated_lift_if_fixed` and/or pattern fix expectedLift; optional sklearn `GradientBoostingRegressor` when training data (abTestResults) available. `predict_lift_rule_based()`, `LiftPredictor` with `predict()`, `train()`, `load()`.
- **ab_suggester.py** – `suggest_fixes_for_insight()`: matches friction to patterns, collects suggested fixes, predicts lift per fix via lift_predictor; optional `use_llm_novel=True` for Gemini-generated suggestions. Returns list of { description, predictedLift: { min, max }, confidence, priority, source }.
- **insight_generator.py** – Calls `suggest_fixes_for_insight()` per insight and sets `suggestedFixes` on new and updated insights (use_llm_novel=False by default).
- **POST /patterns/sync** (analytics) – Syncs quicklook_patterns from existing quicklook_insights (projectKey, limit=200).
- **Frontend** – InsightsPage detail panel shows “Suggested fixes (A/B ideas)” with cards: description, predicted lift range, confidence, priority chip.

---

## Phase 4 implementation status (done)

- **impact_estimator.py** – Conversion impact (affected vs unaffected), chi-squared test, Wilson confidence interval, estimated_lift_if_fixed. Min sample size guard (5 affected, 5 unaffected).
- **insight_generator.py** – Groups sessions by (frictionType, page), runs impact estimation, upserts to `quicklook_insights`. No Gemini; uses session friction/root_cause data. `run_insight_generation_for_project(get_db, project_key, limit_sessions=500, period_days=7)`.
- **POST /insights/generate** (analytics) – Query: projectKey (required), limit=500, period_days=7.
- **quicklook_insights** – Schema aligned in server (impact, suggestedFixes as Mixed; status enum; index projectKey+status+createdAt).
- **API** – GET /api/quicklook/insights?projectKey=...&status=...&limit=50, GET /api/quicklook/insights/:insightId, PATCH /api/quicklook/insights/:insightId (status, notes), POST /api/quicklook/insights/generate (proxy to analytics when QUICKLOOK_ANALYTICS_URL set).
- **InsightsPage.jsx** – Main AI dashboard: summary cards (critical count, affected sessions, total insights), filter by status, list of insight cards, detail panel (root cause, Mark resolved / Ignore, View sessions), Generate insights button.

**Note:** Session `converted` is used for impact; can be set from goals/URL in a follow-up (not implemented in Phase 4).

---

## Previous: Phase 3 (Session Summaries & Clustering)

**Plan reference:** [ai_ux_analytics_system_30811035.plan.md](file:///Users/basil.farraj/.cursor/plans/ai_ux_analytics_system_30811035.plan.md)

---

## Phase 3 implementation status (done)

- **session_summarizer.py** – Gemini summary (narrative, emotionalScore, intent, dropOffReason, keyMoment); `ensure_summary_for_session()` in session_processor.
- **GET /session/{sessionId}/ensure-summary** – On-demand only; caches aiSummary on session.
- **behavior_clusterer.py** – Feature extraction from session doc, DBSCAN/K-Means, optional LLM cluster labels; feature caching on session; `run_clustering_for_project()`.
- **POST /cluster** – `projectKey` (required), `limit=500`, `method=dbscan|kmeans`, `llm_labels=0|1`.
- **GET /cluster** – List clusters for a project (`projectKey`, `limit=50`).
- **Schema** – `quicklook_sessions`: aiSummary, optional `features`; new collection `quicklook_behavior_clusters`.
- **quicklook-server** – Proxy routes `GET /sessions/:sessionId/ensure-summary` and `ensure-root-cause` (set `QUICKLOOK_ANALYTICS_URL`).
- **ReplayPage** – Calls ensure-summary when opening session; RightPanel shows AI Summary (narrative, intent, emotional score, key moment, drop-off reason).
- **BehaviorClustersPage** – Not implemented; use GET /cluster from analytics (or add proxy) to build it in a follow-up.

---

## What’s already done (Phase 2)

- **quicklook-analytics** (Python/FastAPI): service running; `POST /process` batch (optional `root_cause=0` for rule-only), `GET /session/{sessionId}/ensure-root-cause` for on-demand Gemini root cause (cached on session).
- **Friction:** `friction_detector.py` (rage clicks, hover confusion, scroll confusion); sessions get `frictionScore`, `frictionPoints` (rule-based context; Gemini `root_cause` filled on first view via ensure-root-cause).
- **Root cause:** `root_cause_analyzer.py` + `dom_extractor.py`; Gemini used only when user opens a session (or batch with `root_cause=1`).
- **Data:** Events from MongoDB `quicklook_chunks` or GCS; session updates in `quicklook_sessions` (`frictionScore`, `frictionPoints`, `aiProcessed`, `aiProcessedAt`).
- **Not done in Phase 2:** Session-level LLM summary (`aiSummary`), behavior clustering, ML classifier training. Frontend: ReplayPage AI panel and ensure-root-cause call are still pending.

---

## What to implement next: Phase 3

Follow **Section 9 → Phase 3** and the referenced sections in the plan.

### Goals

1. **LLM-powered session summaries**  
   One narrative per session: what the user did, intent, emotional score, key moment, drop-off reason (see plan **Feature 6: LLM-Powered Session Summaries** and schema below).

2. **Behavior clustering**  
   Group sessions by behavior (DBSCAN or K-Means); feature extraction from session/events; optional LLM cluster labels (see plan **Feature 1: Automatic Behavior Clustering**).

3. **Schema and storage**  
   - Add `aiSummary` to `quicklook_sessions` (narrative, emotionalScore, intent, dropOffReason, keyMoment, generatedAt).  
   - New collection `quicklook_behavior_clusters` (plan **Section 3 → quicklook_behavior_clusters**).  
   - Optionally set `behaviorCluster` on session docs.

4. **When to run (CRITICAL for cost/speed)**  
   - **aiSummary:** **ON-DEMAND ONLY** (like ensure-root-cause). DO NOT run in batch by default. Use `GET /session/{sessionId}/ensure-summary` that generates if missing, caches on session, returns cached value on repeat. Batch stays rule-only (friction + rule-based context). Only summarize sessions users actually view.
   - **Clustering:** Run on a **sample or subset** (e.g. last 500 sessions per project, or N% sample) to avoid processing 10k+ sessions. Clustering is cheap (no AI), but feature extraction from events can be slow if done for every session. Cache extracted features on sessions if needed. Optional: LLM cluster labels (1 call per cluster, not per session).

### Deliverables (from plan Phase 3)

- **`session_summarizer.py`**  
  - Input: session doc, events, friction result (or at least frictionScore / frictionPoints).  
  - Output: `{ narrative, emotionalScore, intent, dropOffReason, keyMoment }`; store in session as `aiSummary` (+ `generatedAt`).  
  - Use existing `src.utils.llm_client.generate()` (Gemini).  
  - Plan example prompt: **Feature 6** (summarize in 2–3 sentences, emotional score 1–10, intent: buyer|researcher|comparison|support|explorer, drop-off reason, key moment).

- **`behavior_clusterer.py`**  
  - Extract features from session/events (e.g. scroll, clicks, rage indicators, time per page, pages visited; plan **Feature 1** and **Section 10 → Behavior Clustering Algorithm**).  
  - Cluster sessions (DBSCAN or K-Means; scikit-learn).  
  - Optional: LLM to label clusters (e.g. “Confused Checkout Users”).  
  - Write to `quicklook_behavior_clusters`; optionally set `behaviorCluster` on sessions.

- **Schema**  
  - Sessions: `aiSummary: { narrative, emotionalScore, intent, dropOffReason, keyMoment, generatedAt }`.  
  - New collection: `quicklook_behavior_clusters` (plan **Section 3 → quicklook_behavior_clusters**).

- **Integration**  
  - **aiSummary:** ON-DEMAND endpoint only: `GET /session/{sessionId}/ensure-summary` (or similar) that checks if `aiSummary` exists on session; if not, loads events, calls Gemini, writes `aiSummary`, returns; if yes, returns cached. Frontend (ReplayPage) calls this when user opens a session. DO NOT add to batch by default (keep batch rule-only for scale).
  - **Clustering:** New endpoint `POST /cluster?projectKey=X&limit=500` (or run manually/scheduled). Reads last N `aiProcessed` sessions from `quicklook_sessions`, extracts features, clusters (no AI), writes `quicklook_behavior_clusters`. Optional: 1 LLM call per cluster for label. Keep limit reasonable (500–1000 sessions max per run).

- **Frontend (if in scope)**  
  - ReplayPage: show `aiSummary` (narrative, intent, emotional score, key moment).  
  - BehaviorClustersPage.jsx: list clusters and representative sessions (can be minimal at first).

### Plan sections to read

- **Section 9 → Phase 3** (goals and deliverables).  
- **Feature 6: LLM-Powered Session Summaries** (prompt, output shape, `aiSummary` schema).  
- **Feature 1: Automatic Behavior Clustering** (feature extraction, DBSCAN/K-Means, cluster labels).  
- **Section 3 → quicklook_behavior_clusters** and **quicklook_sessions** (`aiSummary`).  
- **Section 4 → Behavior Clustering Pipeline** (how clustering is triggered and stored).  
- **Section 10 → Behavior Clustering Algorithm** (code-level sketch).

### Repo layout

- Analytics service: `quicklook-analytics/`  
- Add: `src/processors/session_summarizer.py`, `src/processors/behavior_clusterer.py`.  
- Reuse: `src/utils/llm_client.py`, `src/processors/event_fetcher.py`, `src/db/connection.py`, existing config.

---

## Cost & Performance Strategy (CRITICAL)

**Lessons from Phase 2:**

- Gemini calls are **slow** (~2.6–6s per session) and **costly** at scale (10k sessions → 10k calls → $$$ + hours).
- GCS fetch can be slow for large sessions (up to 19s for 3k+ events) but is now parallelized.
- Friction detection is cheap (~0s).

**Phase 3 guidelines:**

1. **Session summaries = ON-DEMAND ONLY**  
   - Batch (POST /process) should stay **rule-only** (no `aiSummary` by default). Only friction + rule-based context.
   - Add `GET /session/{sessionId}/ensure-summary` endpoint that:
     - Checks if session has `aiSummary`; if yes, return it.
     - If no: load events, call Gemini (1 call), write `aiSummary` to session, return.
   - Frontend calls this when user opens ReplayPage. First view = slow (Gemini), next views = instant (cached).
   - For 10k sessions/month, only sessions users actually view get AI summaries (e.g. 100–500 sessions), not all 10k.

2. **Clustering = sample or limit**  
   - Cluster on **last 500 sessions** per project (or smaller sample), not all sessions.
   - Feature extraction (from events) can be slow if done for 10k sessions; keep the cluster batch small.
   - Optional: cache extracted features on sessions (new field `features: {...}`) so clustering reruns are fast.
   - LLM cluster labels: **1 call per cluster** (e.g. 5–10 clusters), not per session. Cheap.

3. **Cost estimate (Phase 3 with on-demand)**  
   - Session summaries: 1 Gemini call per viewed session. If 200 sessions/month viewed → ~$1–2/month.
   - Clustering: 0 Gemini if no cluster labels; 1 call per cluster if using LLM labels (5 clusters → 5 calls, ~$0.01).
   - **Total Phase 3 cost:** <$3/month for typical usage vs $50+ if running summaries in batch for all sessions.

4. **No batch AI by default**  
   - POST /process should **never** call Gemini for aiSummary by default. Keep it rule-only (`root_cause=0` style).
   - Only endpoints for on-demand work (ensure-summary, ensure-root-cause) call Gemini.
   - This keeps batch fast (process 1000 sessions in ~10 minutes instead of hours) and cheap.

---

## Copy-paste prompt for the next agent

```
Implement Phase 3 (Session Summaries & Clustering) of the AI UX Analytics plan.

Plan file: @/Users/basil.farraj/.cursor/plans/ai_ux_analytics_system_30811035.plan.md  
Handoff: @/Users/basil.farraj/Documents/Work/Nobex/Projects/quick-look/quicklook-analytics/docs/NEXT_PHASE_HANDOFF.md

Context:
- Phase 2 is done: friction detection, root cause (on-demand Gemini via GET /session/{id}/ensure-root-cause), batch POST /process with optional root_cause=0.
- quicklook-analytics is Python/FastAPI; events from MongoDB or GCS; sessions in quicklook_sessions.
- **CRITICAL:** Gemini is slow (~3–6s/call) and costly at scale. Batch must stay rule-only. Only on-demand endpoints call AI.

Do the following (per plan Phase 3 and handoff Cost & Performance Strategy):

1) Session summarizer (ON-DEMAND ONLY)
- Add src/processors/session_summarizer.py that, given session doc + events + friction (frictionScore/frictionPoints), calls Gemini to produce: narrative (2–3 sentences), emotionalScore (1–10), intent (buyer|researcher|comparison|support|explorer), dropOffReason, keyMoment. Use src.utils.llm_client.generate(). Return dict suitable for session.aiSummary; include generatedAt.
- Add GET /session/{sessionId}/ensure-summary endpoint: check if session.aiSummary exists; if yes return it; if no, load events, call session_summarizer, write aiSummary to session, return. DO NOT add to batch by default. Keep batch rule-only.
- Frontend (ReplayPage) will call this endpoint when user opens a session. First view = slow (Gemini), next views = instant (cached).

2) Behavior clusterer (sample or limit)
- Add src/processors/behavior_clusterer.py: extract features from sessions/events (scroll, clicks, rage indicators, time per page, pages visited, etc. per plan Feature 1 and Section 10). Use existing src/utils/feature_extractor.py if suitable or extend it. Cluster with DBSCAN or K-Means (scikit-learn). Optionally use LLM to label clusters (1 call per cluster, NOT per session). Write results to new collection quicklook_behavior_clusters; optionally set behaviorCluster on session docs.
- Add POST /cluster?projectKey=X&limit=500 endpoint: reads last N aiProcessed sessions from quicklook_sessions (default limit=500, max=1000), extracts features, clusters, writes clusters. DO NOT process all sessions; keep it a sample or recent subset.
- Optional: cache extracted features on sessions (new field features: {...}) so clustering reruns are cheap.

3) Schema
- quicklook_sessions: add aiSummary: { narrative, emotionalScore, intent, dropOffReason, keyMoment, generatedAt }. Optional: features (for cached feature extraction).
- New collection quicklook_behavior_clusters per plan Section 3 (clusterId, projectKey, period, clusterLabel, description, sessionIds, sessionCount, percentage, features, conversionRate, representativeSessions, createdAt).

4) Frontend (if in scope)
- ReplayPage: call GET /session/{sessionId}/ensure-summary when opening session; display aiSummary (narrative, intent, emotional score, key moment).
- Optional: minimal BehaviorClustersPage.jsx listing clusters and links to sessions.

5) Cost discipline
- NO Gemini in batch by default. Batch is rule-only (friction + rule-based context).
- Only on-demand endpoints (ensure-summary, ensure-root-cause) call Gemini.
- Clustering: limit to 500–1000 sessions per run; LLM labels are optional (1 call per cluster).
- This keeps cost <$3/month for typical usage vs $50+ if running AI on all sessions.

Read plan Phase 3, Feature 6, Feature 1, Section 3, Section 4, Section 10, and the handoff Cost & Performance Strategy.
```

---

## After Phase 5: Phase 6

Phase 6 (Automated Reports) will add:

- `report_generator.py` – Daily/weekly UX reports with Gemini narratives.
- `anomaly_detector.py` – Time-series anomaly detection and alerts.
- Email delivery (optional), report viewer in dashboard.
- Frontend: ReportsPage.jsx.
- API routes: `/api/reports`.

Use the main plan file (Section 9 → Phase 6) and this handoff for the next agent.
