# Releasing quicklook-analytics to GCP

Use the same GCP project as quicklook-server (e.g. `quick-look-488819`). All commands assume you’re in **quicklook-analytics/** unless noted.

---

## 1. Prerequisites

- **gcloud** installed and logged in: `gcloud auth login`
- Default project set: `gcloud config set project quick-look-488819` (or your project ID)
- **APIs** enabled:

```bash
gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com --project=quick-look-488819
```

- **Cloud Build → Cloud Run:** The Cloud Build service account needs permission to deploy. If the first deploy step fails with a permission error, grant it:

```bash
PROJECT_NUMBER=$(gcloud projects describe quick-look-488819 --format='value(projectNumber)')
gcloud projects add-iam-policy-binding quick-look-488819 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
# Optional: so Cloud Build can act as the default compute SA to deploy
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=quick-look-488819
```

---

## 2. Build and deploy in one go (recommended)

From the repo root or from `quicklook-analytics/`:

```bash
cd quicklook-analytics
gcloud builds submit --config=cloudbuild.yaml
```

This will:

- Build the Docker image and push it to `gcr.io/<PROJECT_ID>/quicklook-analytics:<tag>`
- Deploy to Cloud Run and **set env vars in the same step**:
  - **GCP_PROJECT_ID** – from the build project (automatic)
  - **QUICKLOOK_DB** – from Secret Manager secret `quicklook-db-uri:latest` (you must create this once; see below)

First run will fail if the secret doesn’t exist. Create it once (step 3a), then every `gcloud builds submit` will deploy with the correct config.

---

## 3. Env vars in the release (one-time secret setup)

The deploy step in `cloudbuild.yaml` sets **GCP_PROJECT_ID** and **QUICKLOOK_DB** (from Secret Manager) on every release. You only need to create the secret once.

### 3a. Create the Secret Manager secret (one-time)

Use the same MongoDB URL as quicklook-server (e.g. from `quicklook-server/.env`):

```bash
export GCP_PROJECT_ID=quick-look-488819
gcloud services enable secretmanager.googleapis.com --project="$GCP_PROJECT_ID"

# Create secret (paste your real MongoDB URI; the -n avoids a trailing newline)
echo -n "mongodb+srv://user:pass@host/dbname?retryWrites=true" | \
  gcloud secrets create quicklook-db-uri --data-file=- --project="$GCP_PROJECT_ID"
```

Grant the Cloud Run service account access so the service can read it:

```bash
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding quicklook-db-uri \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$GCP_PROJECT_ID"
```

After this, every `gcloud builds submit --config=cloudbuild.yaml` will deploy with **GCP_PROJECT_ID** and **QUICKLOOK_DB** set.

### 3b. Optional: use a plain env var instead of Secret Manager

If you don’t want to use Secret Manager, remove the `--set-secrets` line from `cloudbuild.yaml` and set the DB URL once after the first deploy:

```bash
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-env-vars="QUICKLOOK_DB=<your-mongodb-uri>" \
  --project="$GCP_PROJECT_ID"
```

Later releases will keep existing env vars; only the image will change.

---

## 4. Set or change env vars manually (optional)

If you need to set vars outside the release (e.g. **GEMINI_API_KEY** in Phase 2+), use the **Console** (Cloud Run → quicklook-analytics → Edit & deploy new revision → Variables & Secrets) or **gcloud** below.

### Which vars you need

| Variable | Phase 1 | Phase 2+ | Notes |
|----------|--------|----------|--------|
| **QUICKLOOK_DB** | Required | Required | MongoDB connection string (same as quicklook-server). |
| **GCP_PROJECT_ID** | Optional | Optional | Useful for Pub/Sub or other GCP APIs. |
| **GEMINI_API_KEY** | Not needed | Required | Only used when session summaries, reports, or root-cause explanations are implemented (Phase 2+). You can add it now or when you deploy those phases. |

So for **Phase 1**: set only **QUICKLOOK_DB** (and optionally **GCP_PROJECT_ID**). You do **not** need **GEMINI_API_KEY** until later phases.

### Option A: Plain environment variables (quick to set)

```bash
export GCP_PROJECT_ID=quick-look-488819   # or your project ID

# Phase 1: DB + project ID (use the same QUICKLOOK_DB as quicklook-server)
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-env-vars="QUICKLOOK_DB=<your-mongodb-connection-string>,GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --project="$GCP_PROJECT_ID"

# Later, when you add Phase 2+ (Gemini): add GEMINI_API_KEY
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-env-vars="QUICKLOOK_DB=...,GCP_PROJECT_ID=...,GEMINI_API_KEY=<your-gemini-api-key>" \
  --project="$GCP_PROJECT_ID"
```

To **add or change** a single var without wiping others, use `--update-env-vars`:

```bash
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --update-env-vars="GEMINI_API_KEY=your-key-here" \
  --project="$GCP_PROJECT_ID"
```

### Option B: Secret Manager (recommended for production)

Keeps the MongoDB URL (and API keys) out of the Cloud Run config and audit logs.

**1. Create secrets (one-time):**

```bash
export GCP_PROJECT_ID=quick-look-488819
gcloud services enable secretmanager.googleapis.com --project="$GCP_PROJECT_ID"

# MongoDB URI (paste your real URI; no space after -n)
echo -n "mongodb+srv://user:pass@host/dbname?retryWrites=true" | \
  gcloud secrets create quicklook-db-uri --data-file=- --project="$GCP_PROJECT_ID"

# When you need Gemini (Phase 2+):
echo -n "your-gemini-api-key" | \
  gcloud secrets create gemini-api-key --data-file=- --project="$GCP_PROJECT_ID"
```

**2. Grant Cloud Run access to the secret:**

```bash
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding quicklook-db-uri \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$GCP_PROJECT_ID"
# Repeat for gemini-api-key when you create it
```

**3. Mount secrets as environment variables:**

```bash
# Phase 1: only DB from Secret Manager; rest can stay as plain env if you like
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-secrets="QUICKLOOK_DB=quicklook-db-uri:latest" \
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --project="$GCP_PROJECT_ID"

# Phase 2+: add Gemini from Secret Manager
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-secrets="QUICKLOOK_DB=quicklook-db-uri:latest,GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --project="$GCP_PROJECT_ID"
```

---

## 5. Get the service URL

```bash
gcloud run services describe quicklook-analytics \
  --region=us-central1 \
  --format='value(status.url)' \
  --project="$GCP_PROJECT_ID"
```

Test:

```bash
curl "$(gcloud run services describe quicklook-analytics --region=us-central1 --format='value(status.url)' --project="$GCP_PROJECT_ID")/health"
# Expected: {"status":"ok"}
```

---

## 6. Wire Pub/Sub and Scheduler (optional for Phase 1)

To have Cloud Scheduler trigger the batch job every 6 hours:

1. **Create topic and push subscription** (use the URL from step 4):

```bash
cd infra
export GCP_PROJECT_ID=quick-look-488819
export CLOUD_RUN_URL=https://quicklook-analytics-xxxxx-uc.a.run.app   # paste your URL from step 4
./setup-pubsub.sh
```

2. **Grant Pub/Sub permission to invoke Cloud Run:**

```bash
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud run services add-iam-policy-binding quicklook-analytics \
  --region=us-central1 \
  --member="serviceAccount:${PUBSUB_SA}" \
  --role="roles/run.invoker" \
  --project="$GCP_PROJECT_ID"
```

3. **Create the Scheduler job:**

```bash
./setup-scheduler.sh
```

More detail: see **infra/README.md**.

---

## 7. Alternative: build and deploy separately

**Build image locally and push:**

```bash
cd quicklook-analytics
export GCP_PROJECT_ID=quick-look-488819
docker build -t gcr.io/$GCP_PROJECT_ID/quicklook-analytics:latest .
docker push gcr.io/$GCP_PROJECT_ID/quicklook-analytics:latest
```

**Deploy that image:**

```bash
cd infra
./deploy.sh
# or: gcloud run deploy quicklook-analytics --image=gcr.io/$GCP_PROJECT_ID/quicklook-analytics:latest --region=us-central1 --allow-unauthenticated --project=$GCP_PROJECT_ID
```

Then do steps 3–5 above (env vars, URL check, Pub/Sub + Scheduler if needed).

---

## Checklist

- [ ] APIs enabled (Cloud Run, Container Registry, Cloud Build)
- [ ] `gcloud builds submit --config=cloudbuild.yaml` (or local build + deploy)
- [ ] `QUICKLOOK_DB` and `GCP_PROJECT_ID` set on the Cloud Run service
- [ ] `/health` returns `{"status":"ok"}`
- [ ] (Optional) Pub/Sub topic + push subscription + Scheduler job + IAM for Pub/Sub invoker
