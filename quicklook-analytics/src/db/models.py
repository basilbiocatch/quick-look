"""Pydantic models for session and insight (minimal for Phase 1)."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SessionMeta(BaseModel):
    """Minimal session meta (for typing only)."""
    userAgent: Optional[str] = None
    viewport: Optional[dict[str, Any]] = None


class SessionDocument(BaseModel):
    """Minimal session document shape for reading/updating."""
    sessionId: str
    projectKey: str
    status: str = "active"
    createdAt: Optional[datetime] = None
    closedAt: Optional[datetime] = None
    meta: Optional[SessionMeta] = None
    aiProcessed: Optional[bool] = None
    aiProcessedAt: Optional[datetime] = None

    class Config:
        extra = "allow"


class InsightDocument(BaseModel):
    """Placeholder for future AI insight (Phase 2+)."""
    sessionId: str
    summary: Optional[str] = None
    features: Optional[dict[str, Any]] = None

    class Config:
        extra = "allow"
