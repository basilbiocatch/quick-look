#!/usr/bin/env bash
# Run quicklook-analytics locally on port 8080 (used by quicklook-server for ensure-summary / ensure-root-cause).
set -e
cd "$(dirname "$0")/.."

if [ ! -d ".venv" ]; then
  echo "Creating venv..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

# Prefer quicklook-analytics/.env; optionally copy from server: cp ../quicklook-server/.env .env
if [ -f ".env" ]; then
  echo "Using .env"
  set -a
  source .env
  set +a
fi

echo "Starting analytics on http://127.0.0.1:8080 (ensure-summary, ensure-root-cause, /health)"
exec uvicorn src.main:app --reload --host 127.0.0.1 --port 8080
