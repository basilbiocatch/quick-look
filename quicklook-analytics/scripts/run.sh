#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
# Run from project root (so "src" is found); if we're in scripts/, go up one
[[ -d src ]] || cd ..

if [[ ! -d .venv ]]; then
  echo "No .venv found. Create one with: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

source .venv/bin/activate
exec uvicorn src.main:app --reload --host 127.0.0.1 --port 8080
