"""
Extract element description from rrweb snapshot for root cause analysis.
Full snapshot (type 2) has data.nodes: array of nodes. Each node can be
[id, nodeType, tagName, attributes, childIds...] or similar.
"""
from typing import Any

from src.utils.event_parser import TYPE_FULL_SNAPSHOT


def _node_id(n: Any) -> int | None:
    if isinstance(n, (list, tuple)) and len(n) >= 1:
        return n[0] if isinstance(n[0], int) else None
    if isinstance(n, dict):
        return n.get("id") if isinstance(n.get("id"), int) else None
    return None


def _node_tag(n: Any) -> str:
    if isinstance(n, (list, tuple)) and len(n) >= 3 and isinstance(n[2], str):
        return n[2]
    if isinstance(n, dict):
        return str(n.get("tagName", n.get("name", "")) or "")
    return ""


def _node_attrs(n: Any) -> dict[str, Any]:
    if isinstance(n, (list, tuple)) and len(n) >= 4 and isinstance(n[3], dict):
        return n[3]
    if isinstance(n, dict):
        return n.get("attributes", n.get("attrs", {})) or {}
    return {}


def _node_children_ids(n: Any) -> list[int]:
    if isinstance(n, (list, tuple)) and len(n) >= 5:
        c = n[4]
        if isinstance(c, list):
            return [x for x in c if isinstance(x, int)]
    if isinstance(n, dict):
        c = n.get("childIds", n.get("children", []))
        return [x for x in (c or []) if isinstance(x, int)]
    return []


def _get_node_by_id(nodes: list[Any], nid: int) -> Any | None:
    for n in nodes:
        if _node_id(n) == nid:
            return n
    return None


def _text_from_subtree(nodes: list[Any], nid: int, max_chars: int = 200) -> str:
    """Recursively collect text from node and descendants (text nodes = nodeType 3)."""
    node = _get_node_by_id(nodes, nid)
    if not node:
        return ""
    # NodeType Text = 3 in rrweb
    if isinstance(node, (list, tuple)) and len(node) >= 2 and node[1] == 3:
        text = (node[2] if len(node) > 2 else "") or ""
        return (text[:max_chars] + "…") if len(text) > max_chars else text
    out = []
    for cid in _node_children_ids(node):
        out.append(_text_from_subtree(nodes, cid, max_chars))
    return " ".join(filter(None, out))[:max_chars]


def _text_from_subtree_cached(nodes_by_id: dict[int, Any], nid: int, max_chars: int = 200) -> str:
    """Same as _text_from_subtree but using nodes_by_id dict for O(1) lookup."""
    node = nodes_by_id.get(nid)
    if not node:
        return ""
    if isinstance(node, (list, tuple)) and len(node) >= 2 and node[1] == 3:
        text = (node[2] if len(node) > 2 else "") or ""
        return (text[:max_chars] + "…") if len(text) > max_chars else text
    out = []
    for cid in _node_children_ids(node):
        out.append(_text_from_subtree_cached(nodes_by_id, cid, max_chars))
    return " ".join(filter(None, out))[:max_chars]


def build_dom_cache(events: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    One-pass build: last full snapshot nodes, nodes_by_id map, last URL.
    Return None if no snapshot; caller can skip cache. Reuse for all friction points in a session.
    """
    snapshot = None
    url = ""
    for e in reversed(events):
        if e.get("type") == TYPE_FULL_SNAPSHOT and isinstance(e.get("data"), dict):
            snapshot = e
            break
    if not snapshot:
        return None
    data = snapshot.get("data") or {}
    nodes = data.get("nodes")
    if not isinstance(nodes, list):
        return None
    nodes_by_id = {}
    for n in nodes:
        nid = _node_id(n)
        if nid is not None:
            nodes_by_id[nid] = n
    for e in reversed(events):
        if e.get("type") == 4 and isinstance(e.get("data"), dict):
            href = (e.get("data") or {}).get("href")
            if href:
                url = str(href)
                break
    return {"nodes": nodes, "nodes_by_id": nodes_by_id, "url": url}


def get_element_description(events: list[dict[str, Any]], element_id: int | None, dom_cache: dict[str, Any] | None = None) -> str:
    """
    From events (or dom_cache), locate node by element_id, return short description.
    When dom_cache is provided, uses cached nodes/nodes_by_id (faster for many lookups).
    """
    if element_id is None:
        return ""
    if dom_cache:
        nodes_by_id = dom_cache.get("nodes_by_id")
        if isinstance(nodes_by_id, dict):
            node = nodes_by_id.get(element_id)
            if not node:
                return ""
            tag = _node_tag(node)
            attrs = _node_attrs(node)
            id_attr = attrs.get("id", "")
            class_attr = attrs.get("class", "")
            text = _text_from_subtree_cached(nodes_by_id, element_id)
            parts = [f"tag={tag}"]
            if id_attr:
                parts.append(f"id={id_attr}")
            if class_attr:
                parts.append(f"class={class_attr[:80]}")
            if text:
                parts.append(f"text={text[:100]}")
            return " | ".join(parts)
    # Fallback: scan events
    for e in reversed(events):
        if e.get("type") == TYPE_FULL_SNAPSHOT and isinstance(e.get("data"), dict):
            data = e.get("data") or {}
            nodes = data.get("nodes")
            if not isinstance(nodes, list):
                return ""
            node = _get_node_by_id(nodes, element_id)
            if not node:
                return ""
            tag = _node_tag(node)
            attrs = _node_attrs(node)
            id_attr = attrs.get("id", "")
            class_attr = attrs.get("class", "")
            text = _text_from_subtree(nodes, element_id)
            parts = [f"tag={tag}"]
            if id_attr:
                parts.append(f"id={id_attr}")
            if class_attr:
                parts.append(f"class={class_attr[:80]}")
            if text:
                parts.append(f"text={text[:100]}")
            return " | ".join(parts)
    return ""


def get_current_url(events: list[dict[str, Any]], dom_cache: dict[str, Any] | None = None) -> str:
    """Last meta (type 4) href from events. Use dom_cache['url'] when provided."""
    if dom_cache and "url" in dom_cache:
        return str(dom_cache.get("url", ""))
    for e in reversed(events):
        if e.get("type") == 4 and isinstance(e.get("data"), dict):
            href = (e.get("data") or {}).get("href")
            if href:
                return str(href)
    return ""
