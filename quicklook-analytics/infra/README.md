# Quicklook Analytics – Infrastructure (Phase 1)

Cloud infrastructure for the AI UX Analytics service: Pub/Sub trigger, push subscription to Cloud Run, and Cloud Scheduler.

## Prerequisites

- **gcloud CLI** installed and authenticated (`gcloud auth login`, `gcloud config set project YOUR_PROJECT_ID`).
- **GCP project ID** set (e.g. `export GCP_PROJECT_ID=your-gcp-project` or pass as first argument to scripts).
- **Cloud Run service deployed first** so you have a service URL for the push subscription.

## Order of operations

1. **Deploy the Cloud Run service** (see [Deploying the service](#deploying-the-service) below). Note the service URL (e.g. `https://quicklook-analytics-xxxx.run.app`).
2. **Create Pub/Sub topic and push subscription** using `setup-pubsub.sh`, passing the Cloud Run URL. If you run Pub/Sub setup before deploy, use a placeholder and update the subscription push endpoint after deploy.
3. **Create the Cloud Scheduler job** using `setup-scheduler.sh` so the job publishes to the topic every 6 hours.

## How to get the Cloud Run URL after deploy

After deploying the service:

```bash
gcloud run services describe quicklook-analytics --region=us-central1 --format='value(status.url)' --project="$GCP_PROJECT_ID"
```

Or in the [Cloud Run console](https://console.cloud.google.com/run): select the `quicklook-analytics` service and copy the URL at the top.

## Scripts

| Script | Purpose |
|--------|--------|
| `setup-pubsub.sh` | Creates topic `quicklook-analytics-trigger` and push subscription `analytics-subscription` (ack-deadline 600). |
| `setup-scheduler.sh` | Creates Cloud Scheduler job `process-analytics` (every 6 hours, publishes to the topic). |
| `deploy.sh` | Optional: deploys the Cloud Run service from a container image. |

### Running the scripts

```bash
export GCP_PROJECT_ID=your-gcp-project

# After Cloud Run is deployed:
export CLOUD_RUN_URL=https://quicklook-analytics-xxxx.run.app
./setup-pubsub.sh

./setup-scheduler.sh
```

Or with project as first argument:

```bash
./setup-pubsub.sh your-gcp-project
# CLOUD_RUN_URL must still be set for the push endpoint
./setup-scheduler.sh your-gcp-project
```

**Push subscription URL:** The push subscription must point at your Cloud Run service URL. If you run `setup-pubsub.sh` before the first deploy, either use a placeholder and then update:

```bash
gcloud pubsub subscriptions update analytics-subscription \
  --push-endpoint="https://quicklook-analytics-xxxx.run.app/" \
  --project="$GCP_PROJECT_ID"
```

or re-run `setup-pubsub.sh` with `CLOUD_RUN_URL` set after deploy.

## Environment variables for the analytics service

Set these on the Cloud Run service (Console → Cloud Run → quicklook-analytics → Edit & deploy new revision → Variables & Secrets, or via `gcloud run services update`):

| Variable | Description |
|----------|-------------|
| `QUICKLOOK_DB` | MongoDB connection string (e.g. `mongodb+srv://...`). Same as quicklook-server. |
| `GEMINI_API_KEY` | API key for Gemini (AI summarization). |
| `GCP_PROJECT_ID` | GCP project ID (used for Pub/Sub or other GCP APIs if needed). |

Example with gcloud:

```bash
gcloud run services update quicklook-analytics \
  --region=us-central1 \
  --set-env-vars="QUICKLOOK_DB=postgresql://...,GEMINI_API_KEY=...,GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --project="$GCP_PROJECT_ID"
```

## IAM

### Pub/Sub → Cloud Run

For the **push subscription** to invoke your Cloud Run service, the Pub/Sub service account needs **Cloud Run Invoker** on the service:

- Pub/Sub uses the default compute service account: `service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com`, or a custom topic subscription identity.
- Grant **roles/run.invoker** on the Cloud Run service to that account:

```bash
# Get project number (not ID)
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

gcloud run services add-iam-policy-binding quicklook-analytics \
  --region=us-central1 \
  --member="serviceAccount:${PUBSUB_SA}" \
  --role="roles/run.invoker" \
  --project="$GCP_PROJECT_ID"
```

### Cloud Scheduler → Pub/Sub

The **Cloud Scheduler** job uses a service account (often the default compute or a custom one) to publish to Pub/Sub. That account needs permission to publish to the topic:

- **roles/pubsub.publisher** on the project, or
- Topic-level IAM: grant **Pub/Sub Publisher** (or `roles/pubsub.publisher`) on the topic `quicklook-analytics-trigger` to the Scheduler job’s service account.

If the job fails with permission errors, add:

```bash
# Example: grant default compute SA permission to publish to the topic
TOPIC=quicklook-analytics-trigger
SA="YOUR_SCHEDULER_SERVICE_ACCOUNT@your-gcp-project.iam.gserviceaccount.com"
gcloud pubsub topics add-iam-policy-binding "$TOPIC" \
  --member="serviceAccount:$SA" \
  --role="roles/pubsub.publisher" \
  --project="$GCP_PROJECT_ID"
```

## Deploying the service

Build the image (e.g. with Cloud Build or a local build), then deploy. Optional script:

```bash
./deploy.sh
```

Or one-liner (set `IMAGE` to your built image, e.g. `gcr.io/$GCP_PROJECT_ID/quicklook-analytics:latest`):

```bash
export GCP_PROJECT_ID=your-gcp-project
export IMAGE=gcr.io/$GCP_PROJECT_ID/quicklook-analytics:latest

gcloud run deploy quicklook-analytics \
  --image="$IMAGE" \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --project="$GCP_PROJECT_ID"
```

Use `--no-allow-unauthenticated` if only Pub/Sub (with invoker IAM) should call the service. After deploy, set the env vars and run `setup-pubsub.sh` / `setup-scheduler.sh` as above.
