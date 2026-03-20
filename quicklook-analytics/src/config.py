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
GCS_BUCKET = os.getenv("GCS_BUCKET", "").strip().lower()
# Optional: override Gemini model (default gemini-1.5-flash-002; gemini-2.0-flash deprecated June 2026)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "").strip()
