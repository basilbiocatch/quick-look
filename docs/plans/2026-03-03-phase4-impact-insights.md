# Phase 4: Impact Estimation & Insights – Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add conversion impact estimation (affected vs unaffected, statistical significance), project-level insights (aggregated friction, ranked), `quicklook_insights` collection, Insights API, and InsightsPage so the app can consume and show insights.

**Architecture:** Analytics service gains `impact_estimator.py` (chi-squared, confidence intervals) and an insight generation pipeline that groups sessions by friction pattern, runs impact estimation, and writes to `quicklook_insights`. Server exposes GET/PATCH (and optional DELETE) for insights; frontend adds InsightsPage with filters and links to sessions. No Gemini in the insight pipeline (use existing session friction/root_cause data) to keep cost and latency low.

**Tech Stack:** Python (scipy for chi2, Wilson CI), Motor (MongoDB), Node/Express (quicklook-server), React (quicklook-app).

**Prerequisites (already in place):** `quicklook_sessions` has `converted`, `conversionValue`, `goalEvents`; `quicklook_insights` model exists in server (schema to be aligned with plan Section 3). Phases 1–3: friction detection, root cause (on-demand), session summaries, behavior clustering.

---

## Phase 4 Checklist (double-check vs plan)

- [ ] Sessions: `converted` used for impact (already in schema; can be set from goals/URL in Phase 4 or later).
- [ ] impact_estimator.py: conversion impact, confidence intervals, chi-squared (plan Feature 4 & Section 10).
- [ ] Insight pipeline: friction/clusters → insight records → quicklook_insights (plan Section 3 schema).
- [ ] quicklook_insights: schema aligned (impact, suggestedFixes as objects; server model uses Mixed where needed).
- [ ] API: GET /api/quicklook/insights, GET /api/quicklook/insights/:id, PATCH /api/quicklook/insights/:id (plan Section 5).
- [ ] InsightsPage.jsx: main AI dashboard (insight cards, filters, links to sessions) (plan Section 8).

---

## Task 1: impact_estimator.py (Analytics)

**Files:**
- Create: `quicklook-analytics/src/processors/impact_estimator.py`
- Test: `quicklook-analytics/tests/test_impact_estimator.py` (optional but recommended)

**Step 1: Add impact_estimator module**

Implement per plan Section 10 "Impact Estimation with Statistical Significance":

- `estimate_conversion_impact(affected_sessions: list[dict], all_sessions: list[dict]) -> dict`:
  - Affected = sessions with the friction pattern; unaffected = rest.
  - Build 2x2 contingency: affected converted / not, unaffected converted / not.
  - Use `scipy.stats.chi2_contingency` for chi2, p_value, dof, expected.
  - Conversion rates: cr_affected = converted/len(affected), cr_unaffected = converted/len(unaffected).
  - conversion_drop_percent = (cr_unaffected - cr_affected) * 100.
  - Wilson score interval for affected proportion (optional; or simple CI).
  - Return: `affected_percentage`, `conversion_drop_percent`, `statistical_significance` (p_value < 0.05), `p_value`, `confidence_interval` (for affected CR), `estimated_lift_if_fixed` (min/max as percent, e.g. 0.6 * drop to 1.0 * drop).
- Guard: if len(affected) < 5 or len(unaffected) < 5, return same shape with `statistical_significance: False` and a note.
- Use sessions with `converted` field (boolean); treat missing as False if not set.

**Step 2: Add scipy to requirements**

- File: `quicklook-analytics/requirements.txt`
- Ensure `scipy>=1.10` (or current) is present.

**Step 3: Commit**

```bash
git add quicklook-analytics/src/processors/impact_estimator.py quicklook-analytics/requirements.txt
git commit -m "feat(analytics): add impact_estimator for conversion impact and statistical significance"
```

---

## Task 2: Insight generation pipeline (Analytics)

**Files:**
- Create: `quicklook-analytics/src/processors/insight_generator.py`
- Modify: `quicklook-analytics/src/main.py` (add POST /insights/generate and optionally call from /process)
- Modify: `quicklook-analytics/src/db/models.py` (add InsightDocument for quicklook_insights if needed)

**Step 1: Implement insight_generator.py**

- `run_insight_generation_for_project(get_db, project_key: str, *, limit_sessions: int = 500, period_days: int = 7) -> dict`:
  - Fetch sessions: `projectKey`, `aiProcessed: true`, `closedAt` in last `period_days`, limit `limit_sessions`.
  - Group sessions by friction pattern: key = (friction_type, page). For each session, iterate `frictionPoints`; normalize `type` (e.g. rage_click, hover_confusion, scroll_confusion); use first `page` from session (e.g. `pages[0]` or "unknown"). So key = (type, page).
  - For each group with at least 3 sessions: call `estimate_conversion_impact(affected_sessions, all_sessions)` (all_sessions = same fetch list). Build impact dict.
  - Build insight document per plan Section 3 (`quicklook_insights`):
    - insightId (UUID), projectKey, type: 'friction', frictionType, severity (e.g. high if conversion_drop > 10 else medium), affectedSessions (ids), affectedPercentage, page, element (optional; from first friction point), impact: { conversionDrop, revenueImpact (optional), affectedUserCount, confidence }, rootCause (from first session’s first friction point root_cause string or dict), evidence (optional), suggestedFixes (optional array of objects; can be empty for now), status: 'active', createdAt, updatedAt, expiresAt (e.g. now + 90 days).
  - Upsert by (projectKey, type, frictionType, page) to update existing or insert. Use `insightId` as stable id for updates (e.g. derive from projectKey+frictionType+page hash or create once and reuse).
  - Return counts: created, updated.

**Step 2: Wire POST /insights/generate in main.py**

- Query params: `projectKey` (required), `limit=500`, `period_days=7`.
- Call `run_insight_generation_for_project(get_database, project_key, limit_sessions=limit, period_days=period_days)`.
- Return `{ "success": true, "created": n, "updated": m }` or error.

**Step 3: Optional – call insight generation after batch**

- In `_run_batch`, after processing sessions, optionally call `run_insight_generation_for_project` for each distinct projectKey in the processed set (with a small limit e.g. 200). Or leave it to explicit POST /insights/generate only (recommended for cost: run on demand or on schedule).

**Step 4: Commit**

```bash
git add quicklook-analytics/src/processors/insight_generator.py quicklook-analytics/src/main.py
git commit -m "feat(analytics): add insight generation pipeline and POST /insights/generate"
```

---

## Task 3: quicklook_insights schema alignment (Server)

**Files:**
- Modify: `quicklook-server/src/models/quicklookInsightModel.js`

**Step 1: Align schema with plan Section 3**

- Ensure: insightId, projectKey, type, frictionType, severity (Number 1-10 or String), affectedSessions, affectedPercentage, page, element (Mixed), impact (Mixed: conversionDrop, revenueImpact, affectedUserCount, confidence), rootCause, evidence (Mixed), suggestedFixes (Array of Mixed so we can store { description, predictedLift: { min, max }, confidence, priority }), status (active|resolved|ignored), createdAt, updatedAt, expiresAt.
- Keep collection name `quicklook_insights`. Add index on (projectKey, status, createdAt) if not present.

**Step 2: Commit**

```bash
git add quicklook-server/src/models/quicklookInsightModel.js
git commit -m "fix(server): align quicklook_insights schema with plan (impact, suggestedFixes)"
```

---

## Task 4: Insights API routes and controller (Server)

**Files:**
- Create: `quicklook-server/src/controllers/insightsController.js`
- Modify: `quicklook-server/src/routes/quicklookRoutes.js`

**Step 1: insightsController.js**

- `getInsights(req, res)`: Query params projectKey (required), status (optional: active|resolved|ignored), limit (default 50). Use QuicklookInsight.find({ projectKey, ...status }).sort({ createdAt: -1 }).limit(limit). Return { success: true, data: insights }.
- `getInsightById(req, res)`: Params insightId. Find one by insightId. 404 if not found. Return { success: true, data: insight }.
- `patchInsight(req, res)`: Params insightId; body { status, notes }. Update only status (and notes if you add the field). Return updated document.
- Use same auth pattern as other routes: requireAuth, getProjectForUser(projectKey from insight) to ensure user owns project.

**Step 2: quicklookRoutes.js**

- Add: `router.get("/insights", requireAuth, quicklookController.getInsights)` – but getInsights needs projectKey from query; ensure controller validates projectKey and ownership via getProjectForUser(projectKey).
- Add: `router.get("/insights/:insightId", requireAuth, insightsController.getInsightById)` and resolve projectKey from insight for ownership.
- Add: `router.patch("/insights/:insightId", requireAuth, insightsController.patchInsight)`.
- Import insightsController (e.g. * as insightsController from "../controllers/insightsController.js").

Note: For getInsights, projectKey is required in query; validate and check ownership with getProjectForUser(projectKey). For getInsightById/patchInsight, load insight first, then getProjectForUser(insight.projectKey).

**Step 3: Commit**

```bash
git add quicklook-server/src/controllers/insightsController.js quicklook-server/src/routes/quicklookRoutes.js
git commit -m "feat(server): add GET/PATCH /api/quicklook/insights and insightsController"
```

---

## Task 5: Insights API proxy from server to analytics (optional)

If insights are generated by analytics and stored in MongoDB, the server reads from the same DB (quicklook_insights). No proxy needed for GET/PATCH. For triggering generation from the app, either:
- Add POST /insights/generate in quicklook-server that proxies to analytics POST /insights/generate (when QUICKLOOK_ANALYTICS_URL is set), or
- Frontend calls analytics URL directly (not recommended from browser due to CORS/auth). Prefer server proxy: add POST /api/quicklook/insights/generate that forwards to analytics.

**Files:**
- Modify: `quicklook-server/src/routes/quicklookRoutes.js`
- Modify: `quicklook-server/src/controllers/insightsController.js` or quicklookController

**Step 1: Add POST /insights/generate**

- Route: POST /insights/generate, requireAuth, body or query projectKey. Call analytics service POST /insights/generate?projectKey=... (use QUICKLOOK_ANALYTICS_URL env). Return success/error from analytics. If QUICKLOOK_ANALYTICS_URL not set, return 501 with message.

**Step 2: Commit**

```bash
git add quicklook-server/src/controllers/insightsController.js quicklook-server/src/routes/quicklookRoutes.js
git commit -m "feat(server): proxy POST /insights/generate to analytics"
```

---

## Task 6: Frontend – API client and InsightsPage

**Files:**
- Create: `quicklook-app/src/pages/InsightsPage.jsx`
- Modify: `quicklook-app/src/api/quicklookApi.js` (add getInsights, getInsight, patchInsight, postInsightsGenerate)
- Modify: `quicklook-app/src/App.jsx` (add route projects/:projectKey/insights)
- Modify: `quicklook-app/src/components/MainNavBar.jsx` (add Insights tab/link)

**Step 1: quicklookApi.js**

- `getInsights(projectKey, params)` → GET /insights?projectKey=...&status=...&limit=...
- `getInsight(insightId)` → GET /insights/:insightId
- `patchInsight(insightId, { status })` → PATCH /insights/:insightId
- `postInsightsGenerate(projectKey)` → POST /insights/generate (with projectKey)

**Step 2: InsightsPage.jsx**

- Use useParams() for projectKey. Require projectKey; redirect to home if missing.
- State: insights list, selected insight (detail), loading, error, filters (status).
- Fetch insights on mount: getInsights(projectKey, { status: filterStatus, limit: 50 }).
- Summary cards (optional): critical count (status active and severity high), total affected sessions (sum of affectedSessions lengths), estimated revenue impact (sum impact.revenueImpact if present).
- Table or card list: columns/cards show Issue (frictionType + page), Impact (conversionDrop %), Affected Users (affectedSessions.length), Priority (severity), Status. Click row → set selected insight and show detail panel.
- Detail panel: rootCause, affected session count, link to sessions list (e.g. navigate to sessions with query or filter by sessionIds), suggestedFixes if any. Buttons: Mark Resolved, Ignore (patch status).
- "Generate insights" button: call postInsightsGenerate(projectKey), then refetch list.
- Use MUI (Box, Card, Table, Chip, Button, Typography) consistent with SessionsPage.

**Step 3: App.jsx route**

- Add `<Route path="projects/:projectKey/insights" element={<PageTransition><InsightsPage /></PageTransition>} />` inside the RootLayout routes.
- Import InsightsPage.

**Step 4: MainNavBar.jsx**

- Add a nav item for Insights (e.g. Lightbulb or Insights icon) that navigates to `/projects/${projectKey}/insights` when a project is selected, or to first project’s insights. Match pattern used for Sessions and Settings (e.g. same list item style).

**Step 5: Commit**

```bash
git add quicklook-app/src/pages/InsightsPage.jsx quicklook-app/src/api/quicklookApi.js quicklook-app/src/App.jsx quicklook-app/src/components/MainNavBar.jsx
git commit -m "feat(app): add InsightsPage, insights API client, route and nav"
```

---

## Task 7: Verification and handoff doc

**Files:**
- Modify: `quicklook-analytics/docs/NEXT_PHASE_HANDOFF.md` (add Phase 4 done, Phase 5 next)

**Step 1: Update handoff**

- Under "Phase 4 implementation status (done)" list: impact_estimator.py, insight_generator.py, POST /insights/generate (analytics), quicklook_insights schema and API (GET/PATCH, optional POST generate proxy), InsightsPage.jsx.
- Note: Session `converted` is used for impact; can be set from goals/URL in a follow-up.
- "After Phase 4: Phase 5" = A/B suggestions, pattern library (per plan).

**Step 2: Run quick checks**

- Analytics: Start service, POST /insights/generate?projectKey=... with a project that has aiProcessed sessions with frictionPoints and some with converted. Check quicklook_insights in DB.
- Server: GET /api/quicklook/insights?projectKey=... (with auth). PATCH an insight status.
- App: Open projects/:projectKey/insights, see list, click Generate if needed, open detail, mark resolved.

**Step 3: Commit**

```bash
git add quicklook-analytics/docs/NEXT_PHASE_HANDOFF.md
git commit -m "docs: Phase 4 handoff and verification"
```

---

## Cost & Performance (Phase 4)

- **No Gemini** in the insight pipeline: use existing session friction and rule-based root_cause text. Impact estimation is pure math (chi-squared, rates).
- Run insight generation **on demand** (POST /insights/generate) or on a schedule (e.g. after nightly batch), with a **limit** (e.g. 500 sessions) and **period_days** (e.g. 7) to bound work.
- Indexes: projectKey + status + createdAt on quicklook_insights for fast list and filters.

---

## Execution options

1. **Subagent-driven (this session):** One subagent per task (or per track: analytics, server, frontend), review between tasks.
2. **Parallel agents:** Track A = Tasks 1+2 (analytics). Track B = Tasks 3+4+5 (server). Track C = Task 6 (frontend). Track B and C can start after Task 3 schema is done; Track A can run first.

Recommendation: Run Task 1 (impact_estimator), then Task 2 (insight_generator + endpoint), then Task 3 (schema), then Task 4+5 (server API and proxy) in parallel with Task 6 (frontend), then Task 7 (handoff).
