# QuickLook — Support & Product Reference

This document is the single source of truth for **support inquiries**, **documentation**, and **bot/FAQ integration**. It covers what QuickLook is, how it works, pricing, billing, the SDK, analytics, and every piece of data users see in the product.

---

## 1. What is QuickLook?

**QuickLook** is a **session recording and UX analytics** product. It consists of:

- **SDK** — A JavaScript library that runs in the customer’s website, records user interactions (DOM, clicks, scrolls, navigation) using [rrweb](https://www.rrweb.io/), and sends compressed chunks to the API.
- **Server (quicklook-server)** — Node/Express API. Handles auth, projects, sessions, chunk storage (MongoDB or GCS), billing (Stripe), and retention.
- **App (quicklook-app)** — React dashboard. Users log in, create projects, view sessions list, and replay sessions with an rrweb-based player. Pro users get AI summary, DevTools in replay, and higher limits.
- **Analytics (quicklook-analytics)** — Python/FastAPI service. Processes closed sessions: rule-based friction detection, optional Gemini root-cause and AI summary, behavior clustering, insights, and reports. Can be triggered by Pub/Sub or HTTP.

---

## 2. Technical Overview

### 2.1 High-level flow

1. **Recording**  
   Customer adds the SDK script to their site and calls `quicklook('init', projectKey, options)`. The SDK captures device meta, starts recording DOM + interactions, and uploads chunks to the server (start session → save chunks → close session).

2. **Storage**  
   Sessions and metadata live in MongoDB (`quicklook_sessions`, `quicklook_projects`, etc.). Event chunks can be stored in **MongoDB** or **Google Cloud Storage (GCS)** per `CHUNK_STORAGE` env. Session count and plan enforce **session cap** (e.g. 1,000 free, 5,000 pro per 30-day window).

3. **Retention**  
   Retention is **plan-based** (e.g. 30 days free, 90 days pro). It’s set on the project when the owner’s plan is set; sessions get `expiresAt` and can be purged by a retention job.

4. **Analytics (optional)**  
   When a session is **closed**, the analytics service can process it: rule-based friction (rage clicks, hover/scroll confusion, etc.), then optionally Gemini for root-cause and AI summary. Results are written back to the session document. Insights, clusters, and reports are generated from processed sessions.

5. **Dashboard**  
   Users open the app, pick a project, filter sessions, open a replay. Replay loads session + events (chunks), and for Pro, can request **AI summary** and **root cause** on demand from the analytics service.

### 2.2 Main components

| Component            | Role |
|----------------------|------|
| **quicklook-server** | API: auth, projects, sessions CRUD, chunk upload/download, Stripe checkout/portal/webhooks, plan limits (session cap, project limit, retention). |
| **quicklook-app**    | SPA: login, projects, sessions list with filters, replay player, right panel (user, device, AI summary, activity list, related sessions). |
| **quicklook-sdk**     | Browser: init with project key, record rrweb events, compress (optional worker), upload chunks, optional identify/stop/sessionId. |
| **quicklook-analytics** | Process closed sessions: friction detection, root cause (Gemini), AI summary (Gemini), clustering, insights, reports; HTTP and Pub/Sub. |

### 2.3 Session lifecycle

- **active** — Recording in progress; chunks are still being uploaded.
- **closed** — Recording ended (tab close, navigate away, or explicit stop). Session is then eligible for analytics processing.
- **expiresAt** — Set from `createdAt + retentionDays`; after that the session can be deleted by retention jobs.

Sessions can be **chained**: long sessions (e.g. 60 min) are split into multiple sessions with `sessionChainId`, `parentSessionId`, `sequenceNumber`, `splitReason` (e.g. `duration_limit`). The UI can show “next/previous session in chain.”

---

## 3. Pricing & Plans

Plans are stored in MongoDB (`plan_configurations`). The app and API use **tier** and **planId** (e.g. for A/B pricing tests). Public defaults if DB is empty:

### 3.1 Plan tiers

| Tier         | Typical use |
|--------------|-------------|
| **free**     | Trial / single project, limited sessions and retention. |
| **pro**      | Paid; more sessions, longer retention, AI tools, DevTools, unlimited projects. |
| **enterprise** | Contact sales; custom limits and SLA. |

### 3.2 Default plan limits (from code/config)

**Free**

- **retentionDays:** 30  
- **sessionCap:** 1,000 sessions per 30-day rolling window  
- **projectLimit:** 1 project  
- **features:** recordings only (no AI tools, no DevTools in replay)

**Pro** (from `config/plans/pro.json`)

- **retentionDays:** 90  
- **sessionCap:** 5,000 sessions per 30-day window  
- **projectLimit:** null (unlimited)  
- **features:** recordings, aiTools, devTools

**Enterprise** (default in code)

- **retentionDays:** 365  
- **sessionCap / projectLimit:** null (unlimited)  
- **features:** full

### 3.3 Pro pricing (USD)

- **Monthly:** $29/mo (`displayPrice`: "$29/mo")  
- **Annual:** $290/year (`displayPrice`: "$290/year"), effective monthly $24.17, “Save $58 (2 months free)”  
- **defaultInterval:** annual  
- Stripe price IDs are stored in `plan_configurations.stripe` (monthlyPriceId, annualPriceId, productId). Configured via seed/scripts (e.g. `seedBilling.js`, `seedPlanConfig.js`).

Pricing can be varied by **planId** (e.g. pro variants for A/B tests). The UI shows the plan assigned to the user (or visitorId for anonymous).

---

## 4. Billing

### 4.1 Provider

- **Payment provider:** Stripe (configurable via `PAYMENT_PROVIDER=stripe`).  
- **Checkout:** Redirect to Stripe Checkout (subscription mode).  
- **Billing portal:** Stripe Customer Portal for managing subscription, payment method, invoices.

### 4.2 Key flows

1. **Subscribe (Pro)**  
   User clicks upgrade → API `POST /api/subscription/create-checkout` with `tier`, `interval` (monthly|annual), optional `couponCode` → server creates or reuses Stripe customer, creates Checkout Session → returns `redirectUrl` → user completes payment on Stripe → redirect to `APP_URL/account/payment-success?session_id=...`.

2. **Confirm after redirect**  
   App calls `POST/GET /api/subscription/confirm-checkout` with `session_id`. Server reads Stripe session, gets subscription, normalizes status, calls `handleSubscriptionEvents`. User’s `plan` is set to `pro`, `sessionCap` to 5,000, `billing.*` updated; all projects of the user get `retentionDays: 90`.

3. **Webhooks**  
   Stripe sends `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Server verifies signature, maps to internal events (`subscription.created`, `subscription.updated`, `subscription.canceled`, etc.) and runs `handleSubscriptionEvents` so User and project retention stay in sync even if confirm-checkout wasn’t called.

4. **Cancel**  
   User can cancel from app → `POST /api/subscription/cancel` → server sets `cancel_at_period_end` on Stripe subscription. Access continues until `currentPeriodEnd`; then a grace-period job can set plan back to free and `sessionCap` to 1,000.

5. **Invoices**  
   `GET /api/subscription/invoices` returns recent Stripe invoices (id, amount, status, createdAt, invoicePdfUrl).

6. **Status**  
   `GET /api/subscription/status` returns `plan`, `sessionCap`, and subscription details (status, interval, currentPeriodEnd, cancelAtPeriodEnd).

### 4.3 Subscription statuses (normalized from Stripe)

- **active**, **trialing** → treated as active (user gets Pro).  
- **past_due**, **unpaid** → normalized to `past_due`.  
- **canceled**, **unpaid**, **incomplete_expired**, **paused** → normalized to `canceled`.

### 4.4 Coupons / promo codes

- Validated via Stripe (`validatePromoCode`).  
- Optional app-side checks (e.g. first-time only, redemption limits) in `couponService`.  
- If valid, `promoCodeId` is passed into Checkout Session; metadata can store `couponId` for redemption tracking.

### 4.5 Grace period

- When subscription is canceled, a **grace period** (e.g. 3 days) can be set (`gracePeriodEnd` on User).  
- A cleanup job can downgrade users to free when `gracePeriodEnd < now` (set `plan` to free, `sessionCap` to 1,000).

---

## 5. SDK

### 5.1 Installation

Customer adds one script (and optionally the compression worker):

```html
<script src="https://your-cdn.com/quicklook-sdk.js" async></script>
<!-- If using compression: compress.worker.js same origin or pass workerUrl in init -->
```

### 5.2 Init

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY");
// or with options
window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "https://your-api.com",
  retentionDays: 30,
  captureStorage: false,
  workerUrl: "/path/to/compress.worker.js",
  excludedUrls: ["/privacy", "/admin"],
  includedUrls: ["/checkout", "/pricing"],
  inactivityTimeout: 300000,
  pauseOnHidden: true,
  maxSessionDuration: 3600000,
  region: "eu",
});
```

- **apiUrl** — Backend base URL (e.g. quicklook-server).  
- **retentionDays** — Override (server may still enforce plan retention).  
- **excludedUrls** — URL substrings where recording is disabled; can also be set per project in dashboard.  
- **includedUrls** — If set, only these URL substrings are recorded; others are skipped (SPA: pause when leaving, resume when returning).  
- **inactivityTimeout** — Ms of no activity (mouse, keyboard, scroll, touch) before pausing (default 5 min); 0 = disable.  
- **pauseOnHidden** — Pause when tab is hidden (default true).  
- **maxSessionDuration** — Ms before auto-splitting session (default 60 min); 0 = no split.  
- Any other option keys are stored as **attributes** on the session (e.g. region).

### 5.3 Commands

- **init(projectKey, options?)** — Start recording; required first.  
- **identify({ firstName?, lastName?, email?, ...custom })** — Set user identity (stored in session.user).  
- **getIdentity()** — Return current identity (debugging).  
- **stop()** — Stop recording and flush.  
- **getSessionId(callback?)** — Return or callback with current session ID.

### 5.4 Session ID and identity

- **window.quicklook.sessionId** — Current session ID (may be null before start).  
- **window.quicklook.identity** or **quicklook('getIdentity')** — Current identify payload.

### 5.5 Data sent to the server

- **Session start:** projectKey, meta (device, viewport, etc.), user (from identify), ip (set by server), optional attributes, retentionDays (from project/plan), optional deviceId/deviceFingerprint, and for chained splits: parentSessionId, sessionChainId, sequenceNumber, splitReason.  
- **Chunks:** Batches of rrweb events (type 3 incremental, type 4 full snapshot/meta, etc.), optionally gzip-compressed.  
- **Session close:** Implicit when tab closes or on stop; server sets status to `closed`, `closedAt`, and may compute `duration`, `pageCount`, `pages`.

---

## 6. Analytics

The **quicklook-analytics** service reads/writes the same MongoDB (e.g. `quicklook_sessions`). It does not run automatically unless triggered (e.g. Cloud Scheduler → Pub/Sub → POST /process, or internal cron).

### 6.1 Session processing (batch)

- **POST /process** — Fetches closed, not-yet-aiProcessed sessions (or reprocess/all with query params). For each session: load events, run **rule-based friction detection**, optionally **root cause** (Gemini, per friction point), write back `frictionScore`, `frictionPoints`, `aiProcessed`, `aiProcessedAt`.  
- **Query params:** `reprocess=1`, `all=1`, `include_active=1`, `limit`, `root_cause=0` (rule-only, no Gemini).

### 6.2 Friction detection (rule-based)

- **Rage click** — 3+ clicks on same element within 1 s.  
- **Hover confusion** — Long hover (e.g. 3–5 s) before click.  
- **Scroll confusion** — Multiple scroll changes in a short window.  
- **Long hesitation** — Delay before first meaningful action.  
- Output: **frictionScore** (0–100) and **frictionPoints** array: type, timestamp, element, severity, duration, context.

### 6.3 Root cause (on-demand or batch)

- **GET /session/{session_id}/ensure-root-cause** — Ensures each friction point has a Gemini-generated **root cause** explanation. Writes back to session `frictionPoints[].root_cause`.  
- **force=1** re-runs root cause for all points (e.g. to fix truncated text).

### 6.4 AI summary (on-demand)

- **GET /session/{session_id}/ensure-summary** — If session has no `aiSummary`, loads events + friction, calls Gemini, writes **aiSummary**: narrative, emotionalScore (1–10), intent (buyer|researcher|comparison|support|explorer), dropOffReason, keyMoment, generatedAt.  
- Used when user opens a replay in the app (Pro only in UI).

### 6.5 Other analytics endpoints (overview)

- **POST /cluster** — Behavior clustering for a project (DBScan/KMeans, optional LLM labels).  
- **GET /cluster** — List clusters for project.  
- **POST /insights/generate** — Group sessions by friction pattern, impact estimation, write to `quicklook_insights`.  
- **POST /patterns/*** — Sync/update pattern library from insights and A/B results.  
- **POST /reports/generate** — Generate UX report (daily/weekly/monthly, optional LLM).  
- **GET /reports**, **GET /reports/{id}** — List/get reports.

---

## 7. Data dictionary — What users see and what it means

### 7.1 Projects (dashboard)

| Data | Meaning |
|------|--------|
| **Project name** | User-defined. |
| **Project key** | Unique key used in SDK `init(projectKey)`. Shown in setup snippet. |
| **Thumbnail** | Optional cover image (e.g. from a random session replay). |
| **Settings** | allowedDomains, excludedUrls, retentionDays (from plan), deviceIdEnabled, goals, aiSettings. |

### 7.2 Sessions list (per project)

| Column / filter | Meaning |
|-----------------|--------|
| **Session ID** | Unique ID (UUID); truncated in list (e.g. first 8 chars). |
| **Date / time** | `createdAt` (session start). |
| **Duration** | Session length in ms, shown as human-readable (e.g. 2m 30s). |
| **Pages** | `pageCount` or number of unique URLs (from `pages[]`). |
| **User** | From `user.email` or `user.firstName/lastName`; “Unidentified” if not set. |
| **Location** | From `meta.countryCode`, `meta.city`, `meta.location` (IP-based geo). |
| **Device / OS / Browser** | Parsed from `meta.userAgent`. |
| **Landing URL** | First URL in `pages[]`. |
| **Exit URL** | Last URL in `pages[]`. |
| **Visited URL** | Any URL in `pages[]` (filter “contains”). |
| **IP** | `ipAddress` (for filters/support). |
| **Status** | active | closed (list usually shows closed). |
| **Session chain** | If `sessionChainId` present, UI can show “Part of chain” / next-previous. |

Filters use the same fields (visitedUrl, landingUrl, exitUrl, duration, pageCount, country, city, region, ipAddress, userEmail, userName, browser, device).

### 7.3 Replay page — left (player)

| Element | Meaning |
|--------|--------|
| **Video area** | rrweb-player replay of events (DOM snapshots + incremental events). |
| **Current URL** | URL at current replay time (from type-4 meta events). |
| **Play / Pause / Speed** | Playback controls. |
| **Timeline** | Seek bar; may show “skip inactivity” and event marks (clicks, navigations, etc.). |
| **Session chain** | “Previous / Next session in chain” when `sessionChainId` is set. |

### 7.4 Replay page — right panel

| Section | Data | Meaning |
|--------|------|--------|
| **User properties** | Email, Name, Custom | From `session.user` (identify). |
| | ID | Truncated sessionId. |
| | Total events | Event count for this session. |
| | “How to set up” | Link/snippet to add SDK to site. |
| **Related sessions** | By Device | Same `deviceId` (if project has deviceId enabled). |
| | By IP | Same `ipAddress`. |
| | By User | Same `user.email` in this project. |
| **AI Summary** (Pro) | Narrative | Short 2–3 sentence summary (Gemini). |
| | Intent | buyer | researcher | comparison | support | explorer. |
| | Emotional score | 1–10. |
| | Key moment | Notable moment in session. |
| | Drop-off reason | confusion | price | technical | alternative | unknown or empty. |
| **Session properties** | Date | `createdAt`. |
| | Duration | `duration` (ms). |
| | Pages | `pageCount`. |
| | Device / OS / Browser | From `meta.userAgent`. |
| | Viewport, Screen | From `meta.viewport`, `meta.screen`. |
| | Location | Country, city from `meta`. |
| **Activity list** | Clicks, inputs, URLs, custom events | Derived from rrweb events; clickable to seek. |
| **Session properties (all)** | Full session + meta keys | Raw session and meta for debugging. |

Friction points (and root cause) are computed by analytics and stored on the session; the replay UI may show them in the activity list or a dedicated section (e.g. “Friction” with type, time, severity, root cause).

### 7.5 Subscription / account

| Data | Meaning |
|------|--------|
| **Plan** | free | pro | enterprise (from User.plan). |
| **Session cap** | Max closed sessions in rolling 30 days (e.g. 1,000 free, 5,000 pro). |
| **Subscription status** | active | trialing | past_due | canceled. |
| **Interval** | monthly | annual. |
| **Current period end** | When current billing period ends. |
| **Cancel at period end** | If true, subscription will not renew. |
| **Invoices** | List of past invoices (amount, status, PDF link). |

### 7.6 Session document (backend) — quick reference

- **sessionId**, **projectKey**, **status**, **createdAt**, **closedAt**, **retentionDays**, **expiresAt**  
- **ipAddress**, **deviceId**, **deviceFingerprint**  
- **sessionChainId**, **parentSessionId**, **sequenceNumber**, **splitReason**  
- **meta**: userAgent, platform, language, screen, viewport, timezone, countryCode, city, location, connection…  
- **user**: firstName, lastName, email, custom  
- **attributes**: custom key-value from init options  
- **pages[]**, **pageCount**, **duration**, **chunkCount**, **storageType**  
- **aiSummary**: narrative, emotionalScore, intent, dropOffReason, keyMoment, generatedAt  
- **frictionScore**, **frictionPoints[]**: type, timestamp, element, severity, duration, context, root_cause  
- **behaviorCluster**, **converted**, **conversionValue**, **goalEvents**  
- **aiProcessed**, **aiProcessedAt**

---

## 8. How limits and enforcement work

- **Session cap:** Count of **closed** sessions in the last 30 days across all projects of the owner. If at or above `User.sessionCap`, `startSession` returns “Session limit reached.”  
- **Project limit:** Free = 1 project; Pro = unlimited. Enforced on project creation.  
- **Retention:** Set per project from plan (e.g. 30 free, 90 pro). Session gets `expiresAt = createdAt + retentionDays`. Jobs or retention logic can delete or archive expired sessions.  
- **AI features:** Gated by plan (e.g. Pro for AI summary, DevTools in replay). API can return 403 “Upgrade required” for protected endpoints.

---

## 9. Glossary

- **Session** — One recording from start (tab/session start) to end (close or stop). Uniquely identified by `sessionId`.  
- **Chunk** — A batch of rrweb events uploaded in one request; sessions have one or more chunks.  
- **Session chain** — Multiple sessions linked by `sessionChainId` when a long session is split (e.g. after 60 min).  
- **Friction** — Rule- or AI-detected UX issue (rage click, hover/scroll confusion, hesitation).  
- **Friction point** — Single occurrence: type, time, element, severity, optional root cause text.  
- **AI summary** — Short narrative + intent, emotional score, drop-off reason, key moment (Gemini).  
- **Root cause** — Gemini-generated explanation for a friction point.  
- **Plan / tier** — free | pro | standard | premium | enterprise.  
- **Session cap** — Max closed sessions per 30-day rolling window for the account.  
- **Project key** — Public identifier for a project, used in SDK init.  
- **Project limit** — Max projects allowed (free: 1; pro: unlimited).

---

## 10. Common support answers

- **“Sessions not showing”** — Check project key in SDK matches project in dashboard; check allowedDomains; ensure server is receiving startSession and chunks; check session cap and retention.  
- **“Session limit reached”** — User hit session cap for the plan (1,000 free / 5,000 pro in 30 days). Upgrade to Pro or wait for older sessions to age out of the window.  
- **“Can’t create second project”** — Free plan allows 1 project; upgrade to Pro.  
- **“AI summary not loading”** — Pro-only; ensure user has Pro and analytics service is reachable; check ensure-summary endpoint and plan gate in app.  
- **“Payment went through but still on Free”** — Use “Sync subscription” or re-open payment-success so confirm-checkout runs; webhooks should also fix state; check Stripe customer and subscription IDs on user.  
- **“Where are recordings stored?”** — Metadata in MongoDB; event chunks in MongoDB or GCS depending on `CHUNK_STORAGE`.  
- **“How long are sessions kept?”** — By plan: 30 days (free), 90 (pro), 365 (enterprise); set per project from owner’s plan.  
- **“What is a session chain?”** — One long visit split into multiple sessions (e.g. after 60 min); they share `sessionChainId` so the full journey can be viewed in order.

---

*This support README is intended for support staff, documentation, and bot/FAQ integration. For developer setup and repo structure, see the main README.md in the repo root.*
