"""
Behavior clustering: extract features from sessions, cluster with DBSCAN/K-Means,
optionally label clusters with LLM. Writes to quicklook_behavior_clusters.
Run on a sample (e.g. last 500 sessions per project) to keep cost and time low.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Feature keys in order for vector (must be numeric)
FEATURE_KEYS = [
    "duration_sec",
    "page_count",
    "friction_score",
    "event_density",
    "rage_click_count",
    "hover_confusion_count",
    "scroll_confusion_count",
    "friction_point_count",
]


def extract_features_from_session(session_doc: dict[str, Any]) -> dict[str, float]:
    """
    Extract a numeric feature dict from a session document (no event fetch).
    Uses frictionScore, frictionPoints (counts by type), duration, page count.
    Safe to run on aiProcessed sessions; can cache result on session.features.
    """
    friction_points = list(session_doc.get("frictionPoints") or [])
    rage = sum(1 for p in friction_points if (p.get("type") or "").lower() == "rage_click")
    hover = sum(1 for p in friction_points if (p.get("type") or "").lower() == "hover_confusion")
    scroll = sum(1 for p in friction_points if (p.get("type") or "").lower() == "scroll_confusion")

    duration_ms = session_doc.get("duration")
    if duration_ms is None and session_doc.get("closedAt") and session_doc.get("createdAt"):
        try:
            closed = session_doc["closedAt"]
            created = session_doc["createdAt"]
            if hasattr(closed, "timestamp"):
                closed_ts = closed.timestamp() * 1000
            else:
                closed_ts = float(closed) if isinstance(closed, (int, float)) else 0
            if hasattr(created, "timestamp"):
                created_ts = created.timestamp() * 1000
            else:
                created_ts = float(created) if isinstance(created, (int, float)) else 0
            duration_ms = closed_ts - created_ts if closed_ts and created_ts else 0
        except Exception:
            duration_ms = 0
    duration_ms = duration_ms or 0
    duration_sec = max(0, duration_ms / 1000.0)

    page_count = session_doc.get("pageCount") or session_doc.get("chunkCount") or 1
    if isinstance(page_count, (list, dict)):
        page_count = 1
    page_count = max(1, int(page_count))

    chunk_count = session_doc.get("chunkCount") or 0
    if not isinstance(chunk_count, (int, float)):
        chunk_count = 0
    event_density = (chunk_count / duration_sec) if duration_sec > 0 else 0

    friction_score = float(session_doc.get("frictionScore") or 0)

    return {
        "duration_sec": duration_sec,
        "page_count": float(page_count),
        "friction_score": friction_score,
        "event_density": min(event_density, 100.0),  # cap outliers
        "rage_click_count": float(rage),
        "hover_confusion_count": float(hover),
        "scroll_confusion_count": float(scroll),
        "friction_point_count": float(len(friction_points)),
    }


def session_docs_to_matrix(session_docs: list[dict], use_cached_features: bool = True) -> tuple[np.ndarray, list[dict]]:
    """
    Build feature matrix (n_sessions x n_features) from session docs.
    If use_cached_features and session has 'features' dict, use it; else extract from session.
    Returns (X, sessions_used) where sessions_used may be fewer if some fail.
    """
    rows = []
    used = []
    for doc in session_docs:
        if use_cached_features and isinstance(doc.get("features"), dict):
            f = doc["features"]
        else:
            f = extract_features_from_session(doc)
        try:
            row = [float(f.get(k, 0)) for k in FEATURE_KEYS]
            rows.append(row)
            used.append(doc)
        except (TypeError, ValueError):
            continue
    if not rows:
        return np.array([]).reshape(0, len(FEATURE_KEYS)), []
    return np.array(rows), used


def cluster_sessions(
    session_docs: list[dict[str, Any]],
    method: str = "dbscan",
    n_clusters: int = 5,
    eps: float = 0.5,
    min_samples: int = 5,
    use_cached_features: bool = True,
) -> tuple[list[dict[str, Any]], np.ndarray, list[dict]]:
    """
    Cluster sessions by behavior. Returns (cluster_list, labels, sessions_used).
    - cluster_list: list of dicts with clusterId, sessionIds, sessionCount, percentage, features (centroid), etc.
    - labels: array of cluster label per session (-1 = outlier for DBSCAN)
    - sessions_used: session docs that had valid features
    """
    if len(session_docs) < min_samples:
        return [], np.array([]), []

    X, sessions_used = session_docs_to_matrix(session_docs, use_cached_features=use_cached_features)
    if len(sessions_used) < min_samples:
        return [], np.array([]), sessions_used

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    if method == "kmeans":
        n_clusters = min(n_clusters, len(sessions_used))
        clustering = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = clustering.fit_predict(X_scaled)
    else:
        clustering = DBSCAN(eps=eps, min_samples=min_samples)
        labels = clustering.fit_predict(X_scaled)

    unique_labels = sorted(set(labels))  # -1 (noise) may be present
    clusters_out = []
    for label in unique_labels:
        mask = labels == label
        session_ids = [s["sessionId"] for s, m in zip(sessions_used, mask) if m]
        if not session_ids:
            continue
        count = len(session_ids)
        pct = (count / len(sessions_used)) * 100.0
        centroid = X[mask].mean(axis=0)
        feature_centroid = {k: float(centroid[i]) for i, k in enumerate(FEATURE_KEYS)}
        cluster_sessions_list = [s for s, m in zip(sessions_used, mask) if m]
        converted_count = sum(1 for s in cluster_sessions_list if s.get("converted"))
        conversion_rate = (converted_count / count * 100.0) if count else 0.0
        # Representative: first 5 session IDs (or centroid-nearest later)
        representative_sessions = session_ids[:5]

        clusters_out.append({
            "clusterId": str(uuid.uuid4()),
            "clusterLabel": f"Cluster {label}" if label >= 0 else "Outliers",
            "description": "",
            "sessionIds": session_ids,
            "sessionCount": count,
            "percentage": round(pct, 2),
            "features": feature_centroid,
            "conversionRate": round(conversion_rate, 2),
            "representativeSessions": representative_sessions,
            "label_index": int(label),
        })
    return clusters_out, labels, sessions_used


async def label_cluster_with_llm(cluster: dict[str, Any]) -> str:
    """Optional: one LLM call per cluster to get a human-readable label. Returns label string."""
    try:
        from src.utils.llm_client import generate
    except ImportError:
        return cluster.get("clusterLabel") or "Cluster"
    feats = cluster.get("features") or {}
    prompt = f"""Given these behavioral cluster metrics, suggest a short label (3-5 words) for this user segment.
Metrics: duration_sec={feats.get('duration_sec')}, page_count={feats.get('page_count')}, friction_score={feats.get('friction_score')}, rage_click_count={feats.get('rage_click_count')}, hover_confusion_count={feats.get('hover_confusion_count')}.
Reply with only the label, no quotes or explanation."""
    out = await generate(prompt, temperature=0.3, max_tokens=64)
    if out and isinstance(out, str):
        return out.strip()[:80]
    return cluster.get("clusterLabel") or "Cluster"


def build_cluster_docs(
    clusters: list[dict],
    project_key: str,
    period_start: datetime,
    period_end: datetime,
    with_llm_labels: bool = False,
) -> list[dict[str, Any]]:
    """Build documents for quicklook_behavior_clusters. Optionally run LLM for labels (call label_cluster_with_llm in caller)."""
    docs = []
    for c in clusters:
        doc = {
            "clusterId": c["clusterId"],
            "projectKey": project_key,
            "period": {"start": period_start, "end": period_end},
            "clusterLabel": c.get("clusterLabel") or "Cluster",
            "description": c.get("description") or "",
            "sessionIds": c["sessionIds"],
            "sessionCount": c["sessionCount"],
            "percentage": c["percentage"],
            "features": c.get("features") or {},
            "conversionRate": c.get("conversionRate", 0),
            "representativeSessions": c.get("representativeSessions") or [],
            "createdAt": datetime.now(timezone.utc),
        }
        docs.append(doc)
    return docs


async def run_clustering_for_project(
    get_database_fn,
    project_key: str,
    limit: int = 500,
    method: str = "dbscan",
    n_clusters: int = 5,
    use_llm_labels: bool = False,
) -> dict[str, Any]:
    """
    Load last N aiProcessed sessions for project_key, cluster them, write to
    quicklook_behavior_clusters and set behaviorCluster on each session.
    Returns summary: { clustersCreated, sessionsUpdated, clusterIds }.
    """
    db = get_database_fn()
    sessions_coll = db["quicklook_sessions"]
    clusters_coll = db["quicklook_behavior_clusters"]

    cursor = sessions_coll.find(
        {"projectKey": project_key, "aiProcessed": True}
    ).sort("aiProcessedAt", -1).limit(min(limit, 1000))
    session_docs = [doc async for doc in cursor]
    if len(session_docs) < 5:
        return {"clustersCreated": 0, "sessionsUpdated": 0, "clusterIds": [], "message": "Not enough sessions"}

    period_end = datetime.now(timezone.utc)
    period_start = period_end
    if session_docs:
        at = session_docs[-1].get("aiProcessedAt") or session_docs[-1].get("closedAt")
        if at:
            period_start = at if isinstance(at, datetime) else datetime.fromisoformat(str(at))

    clusters_list, labels, sessions_used = cluster_sessions(
        session_docs,
        method=method,
        n_clusters=n_clusters,
        use_cached_features=True,
    )
    if not clusters_list:
        return {"clustersCreated": 0, "sessionsUpdated": 0, "clusterIds": []}

    # Optional: cache extracted features on sessions for faster reruns
    for s in sessions_used:
        if not s.get("features"):
            feats = extract_features_from_session(s)
            await sessions_coll.update_one(
                {"sessionId": s["sessionId"]},
                {"$set": {"features": feats}},
            )

    if use_llm_labels:
        for c in clusters_list:
            c["clusterLabel"] = await label_cluster_with_llm(c)

    cluster_docs = build_cluster_docs(
        clusters_list,
        project_key,
        period_start,
        period_end,
    )
    for doc in cluster_docs:
        await clusters_coll.insert_one(doc)

    session_updates = 0
    for c in cluster_docs:
        cid = c["clusterId"]
        sids = c.get("sessionIds") or []
        if sids:
            r = await sessions_coll.update_many(
                {"sessionId": {"$in": sids}},
                {"$set": {"behaviorCluster": cid}},
            )
            session_updates += r.modified_count

    return {
        "clustersCreated": len(cluster_docs),
        "sessionsUpdated": session_updates,
        "clusterIds": [d["clusterId"] for d in cluster_docs],
    }
