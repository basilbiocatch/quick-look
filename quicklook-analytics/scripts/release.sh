#!/usr/bin/env bash
# Publish quicklook-analytics to production (Cloud Run).
# Prereqs: gcloud CLI, secrets quicklook-db-uri and gemini-api-key (see scripts/setup-gemini-secret.sh).
# Usage: ./release.sh   or   ./release.sh --substitutions=_IMAGE_TAG=$(git rev-parse --short HEAD)
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
[[ -f cloudbuild.yaml ]] || cd ..
GCP_PROJECT_ID="${GCP_PROJECT_ID:-quick-look-488819}"
echo "Building and deploying to Cloud Run (project=$GCP_PROJECT_ID)..."
gcloud builds submit --config=cloudbuild.yaml --project="$GCP_PROJECT_ID" "$@"
echo "Done. Service: https://console.cloud.google.com/run/detail/us-central1/quicklook-analytics?project=$GCP_PROJECT_ID"
