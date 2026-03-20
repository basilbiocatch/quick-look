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
  echo "Warning: CLOUD_RUN_URL not set. Creating subscriptions with a placeholder endpoint."
  echo "After deploying Cloud Run, update both push endpoints:"
  echo "  gcloud pubsub subscriptions update $SUBSCRIPTION_NAME --push-endpoint=\"https://YOUR-SERVICE-URL.run.app/\" --project=\"$GCP_PROJECT_ID\""
  echo "  gcloud pubsub subscriptions update analytics-issues-subscription --push-endpoint=\"https://YOUR-SERVICE-URL.run.app/issues/run\" --project=\"$GCP_PROJECT_ID\""
  echo "  gcloud pubsub subscriptions update analytics-insights-subscription --push-endpoint=\"https://YOUR-SERVICE-URL.run.app/insights/run\" --project=\"$GCP_PROJECT_ID\""
  echo "  gcloud pubsub subscriptions update analytics-schedule-subscription --push-endpoint=\"https://YOUR-SERVICE-URL.run.app/schedule\" --project=\"$GCP_PROJECT_ID\""
  echo ""
  CLOUD_RUN_URL="https://placeholder.run.app"
fi

# Normalize URL: push endpoint must not have trailing path for Cloud Run (root receives POST)
PUSH_ENDPOINT="${CLOUD_RUN_URL%/}"
[[ "$PUSH_ENDPOINT" != */ ]] && PUSH_ENDPOINT="${PUSH_ENDPOINT}/"
# Second subscription for issues aggregation (bugs dashboard); same topic, different path
ISSUES_SUBSCRIPTION_NAME="${ISSUES_SUBSCRIPTION_NAME:-analytics-issues-subscription}"
PUSH_ENDPOINT_ISSUES="${CLOUD_RUN_URL%/}/issues/run"
# Third subscription for insight generation (affected sessions, etc.)
INSIGHTS_SUBSCRIPTION_NAME="${INSIGHTS_SUBSCRIPTION_NAME:-analytics-insights-subscription}"
PUSH_ENDPOINT_INSIGHTS="${CLOUD_RUN_URL%/}/insights/run"

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

# Create or update push subscription for issues aggregation (POST /issues/run)
if gcloud pubsub subscriptions describe "$ISSUES_SUBSCRIPTION_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Updating existing subscription $ISSUES_SUBSCRIPTION_NAME (push endpoint, ack-deadline)."
  gcloud pubsub subscriptions update "$ISSUES_SUBSCRIPTION_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_ISSUES" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
else
  gcloud pubsub subscriptions create "$ISSUES_SUBSCRIPTION_NAME" \
    --topic="$TOPIC_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_ISSUES" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
  echo "Created push subscription $ISSUES_SUBSCRIPTION_NAME (issues/bugs aggregation)."
fi

# Create or update push subscription for insight generation (POST /insights/run)
if gcloud pubsub subscriptions describe "$INSIGHTS_SUBSCRIPTION_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Updating existing subscription $INSIGHTS_SUBSCRIPTION_NAME (push endpoint, ack-deadline)."
  gcloud pubsub subscriptions update "$INSIGHTS_SUBSCRIPTION_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_INSIGHTS" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
else
  gcloud pubsub subscriptions create "$INSIGHTS_SUBSCRIPTION_NAME" \
    --topic="$TOPIC_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_INSIGHTS" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
  echo "Created push subscription $INSIGHTS_SUBSCRIPTION_NAME (insight generation)."
fi

# Topic and subscription for schedule dispatcher (cluster, patterns_sync, reports, retrain)
SCHEDULE_TOPIC_NAME="${SCHEDULE_TOPIC_NAME:-quicklook-analytics-schedule}"
SCHEDULE_SUBSCRIPTION_NAME="${SCHEDULE_SUBSCRIPTION_NAME:-analytics-schedule-subscription}"
PUSH_ENDPOINT_SCHEDULE="${CLOUD_RUN_URL%/}/schedule"

if gcloud pubsub topics describe "$SCHEDULE_TOPIC_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Topic $SCHEDULE_TOPIC_NAME already exists."
else
  gcloud pubsub topics create "$SCHEDULE_TOPIC_NAME" --project="$GCP_PROJECT_ID"
  echo "Created topic $SCHEDULE_TOPIC_NAME (schedule jobs: cluster, patterns_sync, reports, retrain)."
fi

if gcloud pubsub subscriptions describe "$SCHEDULE_SUBSCRIPTION_NAME" --project="$GCP_PROJECT_ID" &>/dev/null; then
  echo "Updating existing subscription $SCHEDULE_SUBSCRIPTION_NAME (push endpoint, ack-deadline)."
  gcloud pubsub subscriptions update "$SCHEDULE_SUBSCRIPTION_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_SCHEDULE" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
else
  gcloud pubsub subscriptions create "$SCHEDULE_SUBSCRIPTION_NAME" \
    --topic="$SCHEDULE_TOPIC_NAME" \
    --push-endpoint="$PUSH_ENDPOINT_SCHEDULE" \
    --ack-deadline="$ACK_DEADLINE" \
    --project="$GCP_PROJECT_ID"
  echo "Created push subscription $SCHEDULE_SUBSCRIPTION_NAME (schedule dispatcher)."
fi

echo "Done. Ensure the Pub/Sub service account has roles/run.invoker on the Cloud Run service (see README)."
