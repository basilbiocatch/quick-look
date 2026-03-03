#!/usr/bin/env bash
# Create Secret Manager secret for AWS_SECRET_ACCESS_KEY (SES) and grant Cloud Run access.
# Run once before first deploy (or if you rotate the key). Copy-paste or: ./scripts/setup-aws-secret.sh
#
# 1. Set your project and paste your AWS secret key below (or use env).
# 2. Run this script.
# 3. Deploy via release.sh production or gcloud builds submit.

set -e
GCP_PROJECT_ID="${GCP_PROJECT_ID:-quick-look-488819}"
SECRET_NAME="aws-secret-access-key"

# --- Set AWS_SECRET_ACCESS_KEY in the environment, or paste when prompted ---
if [[ -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "Set AWS_SECRET_ACCESS_KEY (e.g. export AWS_SECRET_ACCESS_KEY=...), or paste it when prompted."
  read -rs -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
  echo
fi
if [[ -z "${AWS_SECRET_ACCESS_KEY}" ]]; then
  echo "Error: AWS_SECRET_ACCESS_KEY is empty. Export it or paste when prompted."
  exit 1
fi

echo "Using project: $GCP_PROJECT_ID"
gcloud services enable secretmanager.googleapis.com --project="$GCP_PROJECT_ID"

# Create or update secret (echo -n = no trailing newline)
if gcloud secrets describe "$SECRET_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Secret $SECRET_NAME exists; adding new version."
  echo -n "$AWS_SECRET_ACCESS_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$GCP_PROJECT_ID"
else
  echo "Creating secret $SECRET_NAME."
  echo -n "$AWS_SECRET_ACCESS_KEY" | gcloud secrets create "$SECRET_NAME" --data-file=- --project="$GCP_PROJECT_ID"
fi

# Grant Cloud Run (default compute SA) access to read the secret
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$GCP_PROJECT_ID"

echo "Done. Secret $SECRET_NAME is ready. Deploy with: ./release.sh production"
