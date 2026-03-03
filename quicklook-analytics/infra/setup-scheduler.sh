#!/usr/bin/env bash
# Create Cloud Scheduler job that publishes to quicklook-analytics-trigger Pub/Sub topic.
# The job runs every 6 hours and sends a message to trigger session processing.
# Idempotent: running twice will fail on "already exists"; delete the job first to recreate.

set -e

GCP_PROJECT_ID="${GCP_PROJECT_ID:-${1:-your-gcp-project}}"
REGION="${REGION:-us-central1}"
JOB_NAME="${JOB_NAME:-process-analytics}"
TOPIC_NAME="${TOPIC_NAME:-quicklook-analytics-trigger}"
MESSAGE_BODY="${MESSAGE_BODY:-{\"task\":\"process_sessions\"}}"

if [[ "$GCP_PROJECT_ID" == "your-gcp-project" ]]; then
  echo "Error: Set GCP_PROJECT_ID (env or first argument)."
  exit 1
fi

echo "Project: $GCP_PROJECT_ID"
echo "Region: $REGION"
echo "Job: $JOB_NAME"
echo "Topic: $TOPIC_NAME"

# Ensure topic exists (optional; setup-pubsub.sh should have been run first)
if ! gcloud pubsub topics describe "$TOPIC_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Error: Topic $TOPIC_NAME not found. Run setup-pubsub.sh first."
  exit 1
fi

# Create scheduler job that publishes to Pub/Sub (not HTTP)
# IAM: Cloud Scheduler uses a service account that needs pubsub.topics.publish on the topic.
# Default compute SA is often used; ensure it has roles/pubsub.publisher (or minimal
# pubsub.topics.publish) on the topic. See README.
if gcloud scheduler jobs describe "$JOB_NAME" --location="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Job $JOB_NAME already exists. To replace: gcloud scheduler jobs delete $JOB_NAME --location=$REGION --project=$GCP_PROJECT_ID"
  exit 0
fi

gcloud scheduler jobs create pubsub "$JOB_NAME" \
  --location="$REGION" \
  --schedule="0 */6 * * *" \
  --topic="$TOPIC_NAME" \
  --message-body="$MESSAGE_BODY" \
  --project="$GCP_PROJECT_ID"

echo "Created Cloud Scheduler job $JOB_NAME (every 6 hours)."
echo "IAM: Ensure the Scheduler job's service account can publish to $TOPIC_NAME (e.g. roles/pubsub.publisher). See README."
