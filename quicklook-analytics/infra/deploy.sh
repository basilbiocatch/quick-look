#!/usr/bin/env bash
# Deploy quicklook-analytics to Cloud Run.
# Set IMAGE (e.g. from Cloud Build: gcr.io/PROJECT_ID/quicklook-analytics:latest)
# and optionally SERVICE_NAME, REGION, GCP_PROJECT_ID.
# Idempotent: updates the existing service if already deployed.

set -e

GCP_PROJECT_ID="${GCP_PROJECT_ID:-${1:-your-gcp-project}}"
SERVICE_NAME="${SERVICE_NAME:-quicklook-analytics}"
REGION="${REGION:-us-central1}"
# Image from Cloud Build or local build, e.g. gcr.io/PROJECT_ID/quicklook-analytics:latest
IMAGE="${IMAGE:-gcr.io/${GCP_PROJECT_ID}/quicklook-analytics:latest}"

if [[ "$GCP_PROJECT_ID" == "your-gcp-project" ]]; then
  echo "Error: Set GCP_PROJECT_ID (env or first argument)."
  exit 1
fi

echo "Deploying $SERVICE_NAME to $REGION (image: $IMAGE) ..."

gcloud run deploy "$SERVICE_NAME" \
  --image="$IMAGE" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --project="$GCP_PROJECT_ID"

echo "Done. Get URL: gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)' --project=$GCP_PROJECT_ID"
