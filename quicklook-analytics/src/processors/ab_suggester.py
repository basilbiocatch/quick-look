"""
A/B test suggester: match friction to patterns, suggest fixes, predict lift.
Uses pattern_library for matching and lift_predictor for predicted lift.
Plan: Feature 8 (A/B Test Suggester), Phase 5.
"""
import logging
from typing import Any

from src.models.lift_predictor import get_lift_predictor
from src.processors.pattern_library import find_matching_patterns

logger = logging.getLogger(__name__)


def _fix_to_suggestion(
    fix: dict[str, Any],
    lift_min: float,
    lift_max: float,
    confidence: float,
    priority: str = "medium",
) -> dict[str, Any]:
    """Normalize a fix + predicted lift into insight suggestedFixes shape."""
    return {
        "description": (fix.get("description") or "")[:1000],
        "predictedLift": {"min": round(lift_min, 2), "max": round(lift_max, 2)},
        "confidence": round(confidence, 2),
        "priority": fix.get("priority") or priority,
        "source": fix.get("source", "pattern_library"),
    }


async def suggest_fixes_for_insight(
    get_database_fn,
    project_key: str,
    friction_type: str,
    page: str,
    impact_result: dict[str, Any],
    severity: str = "medium",
    element: dict | None = None,
    *,
    max_suggestions: int = 5,
    use_llm_novel: bool = False,
) -> list[dict[str, Any]]:
    """
    Match this insight's friction to patterns, gather suggested fixes, predict lift for each.
    Returns list of { description, predictedLift: { min, max }, confidence, priority }.
    """
    db = get_database_fn()
    predictor = get_lift_predictor()
    conversion_drop = impact_result.get("conversion_drop_percent") or 0
    affected_pct = impact_result.get("affected_percentage") or 0
    estimated_lift = impact_result.get("estimated_lift_if_fixed") or {}

    # 1) Match to patterns
    patterns = await find_matching_patterns(
        db, project_key, friction_type, page, limit=max_suggestions
    )

    # 2) Collect fixes from patterns (with predicted lift)
    seen_descriptions: set[str] = set()
    suggestions: list[dict[str, Any]] = []

    for pat in patterns:
        for fix in (pat.get("suggestedFixes") or [])[:3]:
            if not isinstance(fix, dict):
                continue
            desc = (fix.get("description") or "").strip()[:300]
            if not desc or desc in seen_descriptions:
                continue
            seen_descriptions.add(desc)
            pat_lift = fix.get("expectedLift") or fix.get("predictedLift") or {}
            pat_min = float(pat_lift.get("min", 0))
            pat_max = float(pat_lift.get("max", 0))
            lift_min, lift_max, conf = predictor.predict(
                friction_type,
                conversion_drop,
                affected_pct,
                severity=severity,
                pattern_fix=fix,
                estimated_lift_if_fixed=estimated_lift if not (pat_min or pat_max) else None,
            )
            if not (lift_min or lift_max):
                lift_min, lift_max = pat_min or conversion_drop * 0.5, pat_max or conversion_drop * 1.0
            suggestions.append(
                _fix_to_suggestion(
                    fix,
                    lift_min,
                    lift_max,
                    conf,
                    fix.get("priority", "medium"),
                )
            )
            if len(suggestions) >= max_suggestions:
                break
        if len(suggestions) >= max_suggestions:
            break

    # 3) If no pattern fixes, use impact-based or generic default suggestion
    if not suggestions:
        lift_min, lift_max, conf = predictor.predict(
            friction_type,
            conversion_drop,
            affected_pct,
            severity=severity,
            estimated_lift_if_fixed=estimated_lift,
        )
        if conversion_drop > 0 and (lift_min > 0 or lift_max > 0):
            suggestions.append(
                _fix_to_suggestion(
                    {
                        "description": "Address root cause to recover lost conversions (see root cause above).",
                        "priority": "high",
                        "source": "impact_estimate",
                    },
                    lift_min,
                    lift_max,
                    conf,
                    "high",
                )
            )
        else:
            # Always offer at least one suggestion (e.g. when conversion_drop is 0 or no patterns yet)
            suggestions.append(
                _fix_to_suggestion(
                    {
                        "description": "Review the root cause above and consider UX changes to reduce this friction (e.g. clearer layout, feedback, or copy).",
                        "priority": "medium",
                        "source": "generic",
                    },
                    lift_min or 0.5,
                    lift_max or 2.0,
                    conf or 0.5,
                    "medium",
                )
            )

    # 4) Optional: add 1–2 LLM-generated novel suggestions
    if use_llm_novel and len(suggestions) < max_suggestions:
        try:
            novel = await _generate_novel_suggestions(
                friction_type, page, conversion_drop, element
            )
            for n in novel:
                if len(suggestions) >= max_suggestions:
                    break
                desc = (n.get("description") or "").strip()[:300]
                if desc and desc not in seen_descriptions:
                    seen_descriptions.add(desc)
                    lift_min, lift_max, conf = predictor.predict(
                        friction_type,
                        conversion_drop,
                        affected_pct,
                        severity=severity,
                        estimated_lift_if_fixed=estimated_lift,
                    )
                    if not (lift_min or lift_max):
                        lift_min, lift_max = conversion_drop * 0.5, conversion_drop * 1.0
                    suggestions.append(
                        _fix_to_suggestion(
                            {**n, "source": "llm"},
                            lift_min,
                            lift_max,
                            min(0.7, conf),
                            n.get("priority", "medium"),
                        )
                    )
        except Exception as e:
            logger.warning("LLM novel suggestions failed: %s", e)

    # Sort by predicted lift (max) descending
    suggestions.sort(
        key=lambda s: (s.get("predictedLift") or {}).get("max", 0),
        reverse=True,
    )
    return suggestions[:max_suggestions]


async def _generate_novel_suggestions(
    friction_type: str,
    page: str,
    conversion_drop: float,
    element: dict | None,
) -> list[dict[str, Any]]:
    """One Gemini call to suggest 2–3 specific UX fixes. Returns list of { description, priority }."""
    try:
        from src.utils.llm_client import generate
    except ImportError:
        return []
    el_desc = ""
    if element and isinstance(element, dict):
        el_desc = f" Element: {element.get('tagName', '')} {element.get('selector', '')} {element.get('text', '')}".strip()[:200]
    prompt = f"""You are a UX analyst. Suggest 2 or 3 specific, actionable UI/UX changes to fix this friction.

Friction type: {friction_type}
Page: {page[:200]}
Conversion impact: {conversion_drop:.1f}% drop
{el_desc}

Reply with a JSON array only, no markdown or explanation. Each item: {{ "description": "one specific actionable change", "priority": "high" or "medium" or "low" }}.
Example: [{{ "description": "Add inline validation with real-time feedback", "priority": "high" }}]"""
    out = await generate(prompt, temperature=0.4, max_tokens=512)
    if not out or not isinstance(out, str):
        return []
    import json
    import re
    s = out.strip()
    # Strip markdown code block if present
    if s.startswith("```"):
        s = re.sub(r"^```\w*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s)
    try:
        arr = json.loads(s)
        if isinstance(arr, list):
            return [x for x in arr if isinstance(x, dict) and x.get("description")][:3]
    except json.JSONDecodeError:
        pass
    return []
