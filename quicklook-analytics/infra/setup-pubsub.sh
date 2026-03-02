#!/usr/bin/env bash
# Create Pub/Sub topic and push subscription for quicklook-analytics.
# Run after the Cloud Run service is deployed so you can set CLOUD_RUN_URL.
# Idempotent: creating an existing topic/subscription may show a message; subscription
# update is done if it exists (push endpoint can be updated).

set -e

GCP_PROJECT_ID="${GCP_PROJECT_ID:-${1:-your-gcp-project}}"
TOPIC_NAME="${TOPIC_NAME:-quicklook-analytics-trigger}"
SUBSCRIPTION_NAME="${SUBSCRIPTION_NAME:-analytics-subscription}"
ACK_DEADLINE="${ACK_DEADLINE:-600}"

# Push subscription endpoint. Must be the Cloud Run service URL.
# Set after first deploy, e.g.: export CLOUD_RUN_URL=https://quicklook-analytics-xxxx.run.app
CLOUD_RUN_URL="${CLOUD_RUN_URL:-}"

if [[ "$GCP_PROJECT_ID" == "your-gcp-project" ]]; then
  echo "Error: Set GCP_PROJECT_ID (env or first argument)."
  exit 1
fi

echo "Project: $GCP_PROJECT_ID"
echo "Topic: $TOPIC_NAME"
echo "Subscription: $SUBSCRIPTION_NAME"

# Create topic if not exists
if gcloud pubsub topics describe "$TOPIC_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Topic $TOPIC_NAME already exists."
else
  gcloud pubsub topics create "$TOPIC_NAME" --project="$GCP_PROJECT_ID"
  echo "Created topic $TOPIC_NAME."
fi

# Create or update push subscription
if [[ -z "$CLOUD_RUN_URL" ]]; then
  echo ""
  echo "Warning: CLOUD_RUN_URL not set. Creating subscription with a placeholder endpoint."
  echo "After deploying Cloud Run, update the subscription push endpoint:"
  echo "  gcloud pubsub subscriptions update $SUBSCRIPTION_NAME \\"
  echo "    --push-endpoint=\"https://YOUR-SERVICE-URL.run.app/\" \\"
  echo "    --project=\"$GCP_PROJECT_ID\""
  echo ""
  CLOUD_RUN_URL="https://placeholder.run.app"
fi

# Normalize URL: push endpoint must not have trailing path for Cloud Run (root receives POST)
PUSH_ENDPOINT="${CLOUD_RUN_URL%/}"
[[ "$PUSH_ENDPOINT" != */ ]] && PUSH_ENDPOINT="${PUSH_ENDPOINT}/"

if gcloud pubsub subscriptions describe "$SUBSCRIPTION_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Updating existing subscription $SUBSCRIPTION_NAME (push endpoint, ack-deadline)."
  gcloud pubsub subscriptions update "$SUBSCRIPTION_NAME" \
    --push-endpoint="$PUSH_ENDPOINT" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
else
  gcloud pubsub subscriptions create "$SUBSCRIPTION_NAME" \
    --topic="$TOPIC_NAME" \
    --push-endpoint="$PUSH_ENDPOINT" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
  echo "Created push subscription $SUBSCRIPTION_NAME."
fi

echo "Done. Ensure the Pub/Sub service account has roles/run.invoker on the Cloud Run service (see README)."
