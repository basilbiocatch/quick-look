#!/usr/bin/env bash
# Quicklook release: one script for local dev and production deploy.
# Usage: ./release.sh local | production | setup

set -e
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

GCP_PROJECT="${GCP_PROJECT:-quick-look-488819}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="quicklook-server"
CONFIG_FILE="$REPO_ROOT/release.config.sh"

usage() {
  echo "Usage: $0 local | production | all | setup"
  echo "  local      - Build SDK, prepare env, start server and app dev servers"
  echo "  production - Build SDK + app, populate server public/, deploy server to Cloud Run"
  echo "  all        - Same as production, then build and deploy analytics worker (server + app + analytics)"
  echo "  setup      - One-time GCP setup (APIs, Artifact Registry)"
  exit 1
}

ensure_public_dir() {
  local pub="$REPO_ROOT/quicklook-server/public"
  mkdir -p "$pub"
  echo "$pub"
}

# ---- local ----
run_local() {
  echo "[release] Local mode: building SDK and preparing env..."
  local pub
  pub="$(ensure_public_dir)"

  (cd "$REPO_ROOT/quicklook-sdk" && npm ci --no-audit --no-fund && npm run build)
  cp -f "$REPO_ROOT/quicklook-sdk/dist/quicklook-sdk.js" "$pub/"
  cp -f "$REPO_ROOT/quicklook-sdk/dist/compress.worker.js" "$pub/"

  echo "VITE_API_BASE_URL=http://localhost:3080" > "$REPO_ROOT/quicklook-app/.env"
  echo "# Optional: VITE_QUICKLOOK_API_KEY=your_api_key" >> "$REPO_ROOT/quicklook-app/.env"

  echo "[release] Starting server (port 3080) and app (port 5174). Ctrl+C to stop both."
  (cd "$REPO_ROOT/quicklook-server" && npm run dev) &
  SERVER_PID=$!
  (cd "$REPO_ROOT/quicklook-app" && npm run dev) &
  APP_PID=$!
  trap "kill $SERVER_PID $APP_PID 2>/dev/null; exit 0" INT TERM
  wait
}

# ---- production ----
run_production() {
  echo "[release] Production mode: build and deploy to Cloud Run..."
  local pub
  pub="$(ensure_public_dir)"

  # Build SDK
  (cd "$REPO_ROOT/quicklook-sdk" && npm ci --no-audit --no-fund && npm run build)
  cp -f "$REPO_ROOT/quicklook-sdk/dist/quicklook-sdk.js" "$pub/"
  cp -f "$REPO_ROOT/quicklook-sdk/dist/compress.worker.js" "$pub/"

  # App at root (/), API at /api (same-origin)
  echo "VITE_API_BASE_URL=" > "$REPO_ROOT/quicklook-app/.env"
  
  # Clean Vite cache to avoid ENOTEMPTY during npm ci (stale deps_temp_* dirs)
  local vite_cache="$REPO_ROOT/quicklook-app/node_modules/.vite"
  if [[ -d "$vite_cache" ]]; then
    rm -rf "$vite_cache" 2>/dev/null || {
      echo "[release] ERROR: Cannot clean Vite cache. Stop the dev server (Ctrl+C in the terminal running 'npm run dev') and try again."
      exit 1
    }
  fi
  # Ensure cache is gone right before npm ci (in case it was recreated or rm had no effect)
  rm -rf "$vite_cache" 2>/dev/null || true

  (cd "$REPO_ROOT/quicklook-app" && npm ci --no-audit --no-fund && npm run build)
  cp -r "$REPO_ROOT/quicklook-app/dist"/* "$pub/"

  # Deploy via Cloud Build
  if ! command -v gcloud &>/dev/null; then
    echo "[release] ERROR: gcloud CLI not found. Install and run 'gcloud auth login' and 'gcloud config set project $GCP_PROJECT'"
    exit 1
  fi
  gcloud config set project "$GCP_PROJECT" --quiet 2>/dev/null || true
  gcloud builds submit "$REPO_ROOT" --config="$REPO_ROOT/cloudbuild.yaml" --project="$GCP_PROJECT" --substitutions="_REGION=$REGION,_SERVICE_NAME=$SERVICE_NAME"

  # Persist service URL for next time (optional)
  local url
  url="$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT" 2>/dev/null || true)"
  if [[ -n "$url" ]]; then
    echo "QUICKLOOK_SERVICE_URL=$url" > "$CONFIG_FILE"
    echo "[release] Service URL: $url (saved to release.config.sh)"
  fi

  # Set QUICKLOOK_ANALYTICS_URL on the server so it can proxy to analytics (insights, reports, retrain, etc.)
  local analytics_url
  analytics_url="$(gcloud run services describe quicklook-analytics --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT" 2>/dev/null || true)"
  if [[ -n "$analytics_url" ]]; then
    gcloud run services update "$SERVICE_NAME" --region="$REGION" --update-env-vars="QUICKLOOK_ANALYTICS_URL=${analytics_url}" --project="$GCP_PROJECT" --quiet 2>/dev/null || true
    echo "[release] Set QUICKLOOK_ANALYTICS_URL=$analytics_url on $SERVICE_NAME"
  fi

  echo "[release] If first deploy, set env vars: gcloud run services update $SERVICE_NAME --region=$REGION --set-env-vars=QUICKLOOK_DB=...,QUICKLOOK_API_KEY=..."
}

# ---- all (production + analytics) ----
run_all() {
  echo "[release] Releasing everything: server (+ app + SDK), then analytics worker..."
  export GCP_PROJECT_ID="${GCP_PROJECT_ID:-$GCP_PROJECT}"
  export REGION
  run_production
  echo ""
  echo "[release] Deploying analytics worker..."
  "$REPO_ROOT/deploy-analytics.sh" "$@"
}

# ---- setup ----
run_setup() {
  echo "[release] One-time GCP setup for project: $GCP_PROJECT"
  if ! gcloud projects describe "$GCP_PROJECT" &>/dev/null; then
    echo "[release] ERROR: Project '$GCP_PROJECT' not found or you don't have access."
    echo "  1. Create the project in Cloud Console: https://console.cloud.google.com/projectcreate?organizationId=0"
    echo "  2. Or set GCP_PROJECT to an existing project: GCP_PROJECT=your-project ./release.sh setup"
    echo "  3. Ensure you have Owner (or roles: Service Usage Admin, Cloud Run Admin, Artifact Registry Admin) on the project."
    exit 1
  fi
  gcloud config set project "$GCP_PROJECT"
  echo "[release] Enabling APIs (requires Service Usage Admin or Owner)..."
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --quiet || {
    echo "[release] ERROR: Could not enable APIs. You need one of: Project Owner, or roles 'Service Usage Admin' + 'Cloud Run Admin' + 'Artifact Registry Admin'."
    echo "  Grant yourself in Console: IAM & Admin -> IAM -> Add principal (your email) -> Role: Owner (or the roles above)."
    exit 1
  }
  gcloud artifacts repositories create quicklook --repository-format=docker --location="$REGION" --quiet 2>/dev/null || true
  echo "[release] Done. Set QUICKLOOK_DB and QUICKLOOK_API_KEY as Cloud Run env vars when deploying."
}

# ---- main ----
case "${1:-}" in
  local)       run_local ;;
  production)  run_production ;;
  all)         shift; run_all "$@" ;;
  setup)       run_setup ;;
  *)           usage ;;
esac
