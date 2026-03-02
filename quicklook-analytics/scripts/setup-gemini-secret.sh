#!/usr/bin/env bash
# Create Secret Manager secret for Gemini API key and grant Cloud Run access.
# Run once before first deploy (or if you rotate the key). Copy-paste or: ./scripts/setup-gemini-secret.sh
#
# 1. Set your project and paste your Gemini API key below (or use -e read from env).
# 2. Run this script.
# 3. Deploy: gcloud builds submit --config=cloudbuild.yaml

set -e
GCP_PROJECT_ID="${GCP_PROJECT_ID:-quick-look-488819}"
SECRET_NAME="gemini-api-key"

# --- Paste your Gemini API key here, or set GEMINI_API_KEY in the environment ---
if [[ -z "${GEMINI_API_KEY}" ]]; then
  echo "Set GEMINI_API_KEY (e.g. export GEMINI_API_KEY=AIza...), or paste it when prompted."
  read -rs -p "Gemini API key: " GEMINI_API_KEY
  echo
fi
if [[ -z "${GEMINI_API_KEY}" ]]; then
  echo "Error: GEMINI_API_KEY is empty. Export it or paste when prompted."
  exit 1
fi

echo "Using project: $GCP_PROJECT_ID"
gcloud services enable secretmanager.googleapis.com --project="$GCP_PROJECT_ID"

# Create or update secret (echo -n = no trailing newline)
if gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Secret $SECRET_NAME exists; adding new version."
  echo -n "$GEMINI_API_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$GCP_PROJECT_ID"
else
  echo "Creating secret $SECRET_NAME."
  echo -n "$GEMINI_API_KEY" | gcloud secrets create "$SECRET_NAME" --data-file=- --project="$GCP_PROJECT_ID"
fi

# Grant Cloud Run (default compute SA) access to read the secret
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$GCP_PROJECT_ID"

echo "Done. Secret $SECRET_NAME is ready. Deploy with: gcloud builds submit --config=cloudbuild.yaml"
