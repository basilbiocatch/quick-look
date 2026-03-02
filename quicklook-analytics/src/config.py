"""Environment configuration for quicklook-analytics."""
import os
from pathlib import Path

# Load .env from project root (quicklook-analytics/) when present
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path)

QUICKLOOK_DB = os.getenv("QUICKLOOK_DB", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "").strip()
# Add other env vars as needed (e.g. GCS_BUCKET for event fetch later)
