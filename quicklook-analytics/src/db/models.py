"""Pydantic models for session and insight (minimal for Phase 1)."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class SessionMeta(BaseModel):
    """Minimal session meta (for typing only)."""
    userAgent: Optional[str] = None
    viewport: Optional[dict[str, Any]] = None


class AISummary(BaseModel):
    """Session AI summary (Phase 3). Stored on quicklook_sessions.aiSummary."""
    narrative: str = ""
    emotionalScore: int = Field(ge=1, le=10, default=5)
    intent: str = "explorer"  # buyer|researcher|comparison|support|explorer
    dropOffReason: str = ""  # confusion|price|technical|alternative|unknown
    keyMoment: str = ""
    generatedAt: Optional[datetime] = None

    class Config:
        extra = "allow"


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
    aiSummary: Optional[AISummary] = None
    frictionScore: Optional[float] = None
    frictionPoints: Optional[list[dict[str, Any]]] = None
    behaviorCluster: Optional[str] = None
    features: Optional[dict[str, Any]] = None  # cached feature vector for clustering

    class Config:
        extra = "allow"


class InsightDocument(BaseModel):
    """Placeholder for future AI insight (Phase 2+)."""
    sessionId: str
    summary: Optional[str] = None
    features: Optional[dict[str, Any]] = None

    class Config:
        extra = "allow"


class BehaviorClusterDocument(BaseModel):
    """Behavior cluster (Phase 3). Stored in quicklook_behavior_clusters."""
    clusterId: str
    projectKey: str
    period: dict[str, Any]  # start, end
    clusterLabel: str = ""
    description: str = ""
    sessionIds: list[str] = []
    sessionCount: int = 0
    percentage: float = 0.0
    features: dict[str, Any] = {}
    conversionRate: float = 0.0
    representativeSessions: list[str] = []
    createdAt: Optional[datetime] = None

    class Config:
        extra = "allow"
