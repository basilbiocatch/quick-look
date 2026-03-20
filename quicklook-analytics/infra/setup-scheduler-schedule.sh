#!/usr/bin/env bash
# Create Cloud Scheduler jobs that publish to quicklook-analytics-schedule topic.
# These trigger POST /schedule with task=cluster|patterns_sync|reports|retrain.
# Run after setup-pubsub.sh (topic + subscription must exist).
# Idempotent: jobs that already exist are skipped (delete first to replace).

set -e

GCP_PROJECT_ID="${GCP_PROJECT_ID:-${1:-your-gcp-project}}"
REGION="${REGION:-us-central1}"
SCHEDULE_TOPIC_NAME="${SCHEDULE_TOPIC_NAME:-quicklook-analytics-schedule}"

if [[ "$GCP_PROJECT_ID" == "your-gcp-project" ]]; then
  echo "Error: Set GCP_PROJECT_ID (env or first argument)."
  exit 1
fi

if ! gcloud pubsub topics describe "$SCHEDULE_TOPIC_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Error: Topic $SCHEDULE_TOPIC_NAME not found. Run setup-pubsub.sh first."
  exit 1
fi

echo "Project: $GCP_PROJECT_ID"
echo "Region: $REGION"
echo "Topic: $SCHEDULE_TOPIC_NAME"

create_job() {
  local name="$1"
  local schedule="$2"
  local body="$3"
  if gcloud scheduler jobs describe "$name" --location="$REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    echo "Job $name already exists. Skip."
    return 0
  fi
  gcloud scheduler jobs create pubsub "$name" \
    --location="$REGION" \
    --schedule="$schedule" \
    --topic="$SCHEDULE_TOPIC_NAME" \
    --message-body="$body" \
    --project="$GCP_PROJECT_ID"
  echo "Created $name ($schedule)."
}

# Every 6h: cluster and patterns_sync (offset by 30 min so not same second as process-analytics)
create_job "analytics-cluster"       "30 */6 * * *" '{"task":"cluster"}'
create_job "analytics-patterns-sync" "35 */6 * * *" '{"task":"patterns_sync"}'

# Daily 6 AM UTC: reports
create_job "analytics-reports-daily"  "0 6 * * *" '{"task":"reports","type":"daily"}'

# Weekly Monday 6 AM UTC: reports
create_job "analytics-reports-weekly" "0 6 * * 1" '{"task":"reports","type":"weekly"}'

# Weekly Sunday 3 AM UTC: retrain lift model
create_job "analytics-retrain" "0 3 * * 0" '{"task":"retrain"}'

echo "Done. Ensure the Scheduler service account can publish to $SCHEDULE_TOPIC_NAME (roles/pubsub.publisher). See README."
