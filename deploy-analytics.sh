#!/usr/bin/env bash
# Deploy quicklook-analytics to Cloud Run (same GCP project as quicklook).
# Usage: ./deploy-analytics.sh [--with-scheduler] [--image-tag=TAG] [--dry-run]
#
# Prerequisites: Secrets quicklook-db-uri and gemini-api-key in Secret Manager.
# First-time with scheduler: ./deploy-analytics.sh --with-scheduler
# Verify without deploying: ./deploy-analytics.sh --dry-run

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
ANALYTICS_DIR="$REPO_ROOT/quicklook-analytics"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-quick-look-488819}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="quicklook-analytics"

WITH_SCHEDULER=false
IMAGE_TAG="latest"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --with-scheduler) WITH_SCHEDULER=true ;;
    --image-tag=*)    IMAGE_TAG="${arg#--image-tag=}" ;;
    --dry-run)       DRY_RUN=true ;;
    *)               echo "Unknown option: $arg"; exit 1 ;;
  esac
done

echo "[deploy-analytics] Project: $GCP_PROJECT_ID  Region: $REGION  Image tag: $IMAGE_TAG  Scheduler: $WITH_SCHEDULER"

# ---- 1. Validate gcloud ----
if ! command -v gcloud &>/dev/null; then
  echo "[deploy-analytics] ERROR: gcloud CLI not found. Install and run 'gcloud auth login', 'gcloud config set project $GCP_PROJECT_ID'"
  exit 1
fi

gcloud config set project "$GCP_PROJECT_ID" --quiet 2>/dev/null || true

if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null | grep -q .; then
  echo "[deploy-analytics] ERROR: Not logged in. Run: gcloud auth login"
  exit 1
fi

if ! gcloud projects describe "$GCP_PROJECT_ID" &>/dev/null; then
  echo "[deploy-analytics] ERROR: Project '$GCP_PROJECT_ID' not found or no access."
  exit 1
fi

# ---- 2. Verify required secrets exist ----
for secret in quicklook-db-uri gemini-api-key; do
  if ! gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &>/dev/null; then
    echo "[deploy-analytics] ERROR: Secret '$secret' not found. Create it first (see quicklook-analytics/RELEASE.md or scripts/setup-gemini-secret.sh)."
    exit 1
  fi
done
echo "[deploy-analytics] Secrets OK (quicklook-db-uri, gemini-api-key)"

# ---- 3. Enable required APIs ----
echo "[deploy-analytics] Enabling APIs..."
gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com --project="$GCP_PROJECT_ID" 2>/dev/null || true

if [[ "$WITH_SCHEDULER" == true ]]; then
  gcloud services enable pubsub.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com --project="$GCP_PROJECT_ID" 2>/dev/null || true
fi

# ---- 4. Ensure Cloud Build can deploy to Cloud Run ----
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
if ! gcloud projects get-iam-policy "$GCP_PROJECT_ID" --flatten="bindings[].members" --filter="bindings.members:serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" --format="value(bindings.role)" 2>/dev/null | grep -q "roles/run.admin"; then
  echo "[deploy-analytics] Granting Cloud Build permission to deploy to Cloud Run..."
  gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/run.admin" \
    --quiet 2>/dev/null || true
  gcloud iam service-accounts add-iam-policy-binding \
    "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser" \
    --project="$GCP_PROJECT_ID" \
    --quiet 2>/dev/null || true
fi

# ---- 5. Build and deploy via Cloud Build ----
if [[ "$DRY_RUN" == true ]]; then
  echo "[deploy-analytics] Dry run: skipping build and deploy."
  echo "[deploy-analytics] Would run: cd $ANALYTICS_DIR && gcloud builds submit . --config=cloudbuild.yaml --substitutions=_IMAGE_TAG=$IMAGE_TAG --project=$GCP_PROJECT_ID"
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID" 2>/dev/null || true)
  echo ""
  echo "[deploy-analytics] Dry run complete. Current service URL: ${SERVICE_URL:-not deployed yet}"
  exit 0
fi

echo "[deploy-analytics] Building and deploying to Cloud Run..."
cd "$ANALYTICS_DIR"
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --substitutions="_IMAGE_TAG=$IMAGE_TAG" \
  --project="$GCP_PROJECT_ID"

# ---- 6. Optional: setup Pub/Sub + Scheduler ----
if [[ "$WITH_SCHEDULER" == true ]]; then
  echo "[deploy-analytics] Setting up scheduler (Pub/Sub + Cloud Scheduler)..."

  CLOUD_RUN_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
  export GCP_PROJECT_ID
  export CLOUD_RUN_URL
  export REGION

  bash "$ANALYTICS_DIR/infra/setup-pubsub.sh"
  bash "$ANALYTICS_DIR/infra/setup-scheduler.sh"

  # Grant Pub/Sub push subscription's service account permission to invoke Cloud Run
  PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
  if gcloud run services get-iam-policy "$SERVICE_NAME" --region="$REGION" --project="$GCP_PROJECT_ID" --format=json 2>/dev/null | grep -q "$PUBSUB_SA"; then
    echo "[deploy-analytics] Pub/Sub already has run.invoker on $SERVICE_NAME"
  else
    echo "[deploy-analytics] Granting Pub/Sub permission to invoke Cloud Run..."
    gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
      --region="$REGION" \
      --member="serviceAccount:${PUBSUB_SA}" \
      --role="roles/run.invoker" \
      --project="$GCP_PROJECT_ID" \
      --quiet 2>/dev/null || true
  fi
fi

# ---- 7. Output service URL and health check ----
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID" 2>/dev/null || true)
echo ""
echo "[deploy-analytics] Done."
echo "  Service URL: $SERVICE_URL"
echo "  Health check: curl ${SERVICE_URL}/health"
echo "  Console: https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}?project=${GCP_PROJECT_ID}"
