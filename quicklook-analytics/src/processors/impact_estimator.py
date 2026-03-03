"""
Conversion impact estimation with statistical significance.
Compares affected vs unaffected sessions (chi-squared, confidence intervals).
Plan: Feature 4, Section 10.
"""
from typing import Any

try:
    from scipy.stats import chi2_contingency
except ImportError:
    chi2_contingency = None

MIN_SAMPLE_AFFECTED = 5
MIN_SAMPLE_UNAFFECTED = 5


def _is_converted(session: dict[str, Any]) -> bool:
    """True if session has converted=True. Missing or false => not converted."""
    return bool(session.get("converted") is True)


def _wilson_ci(successes: int, n: int) -> tuple[float, float]:
    """Wilson score interval for a proportion. Returns (lower, upper) in [0,1]."""
    if n <= 0:
        return 0.0, 0.0
    z = 1.96  # 95% CI
    p = successes / n
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    spread = (z / denom) * (p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5
    low = max(0.0, centre - spread)
    high = min(1.0, centre + spread)
    return low, high


def estimate_conversion_impact(
    affected_sessions: list[dict[str, Any]],
    all_sessions: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Calculate conversion impact for a group of affected sessions vs the rest.

    Args:
        affected_sessions: Sessions that have the friction pattern.
        all_sessions: All sessions in the same period (must include affected).

    Returns:
        Dict with: affected_percentage, conversion_drop_percent, statistical_significance,
        p_value, confidence_interval (for affected CR, as [low_pct, high_pct]),
        estimated_lift_if_fixed (min/max percent), and optional note if sample too small.
    """
    affected_ids = {s.get("sessionId") for s in affected_sessions if s.get("sessionId")}
    unaffected = [s for s in all_sessions if s.get("sessionId") not in affected_ids]
    affected = [s for s in all_sessions if s.get("sessionId") in affected_ids]
    if not affected:
        affected = list(affected_sessions)

    n_all = len(all_sessions)
    n_aff = len(affected)
    n_unaff = len(unaffected)
    if n_all == 0:
        return {
            "affected_percentage": 0.0,
            "conversion_drop_percent": 0.0,
            "statistical_significance": False,
            "p_value": 1.0,
            "confidence_interval": [0.0, 0.0],
            "estimated_lift_if_fixed": {"min": 0.0, "max": 0.0},
            "note": "No sessions",
        }

    affected_converted = sum(1 for s in affected if _is_converted(s))
    unaffected_converted = sum(1 for s in unaffected if _is_converted(s))

    cr_affected = affected_converted / n_aff if n_aff else 0.0
    cr_unaffected = unaffected_converted / n_unaff if n_unaff else 0.0
    conversion_drop = (cr_unaffected - cr_affected) * 100
    affected_pct = (n_aff / n_all) * 100

    # Confidence interval for affected conversion rate (Wilson)
    ci_low, ci_high = _wilson_ci(affected_converted, n_aff)
    confidence_interval = [ci_low * 100, ci_high * 100]

    # Chi-squared test
    statistical_significance = False
    p_value = 1.0
    if (
        chi2_contingency is not None
        and n_aff >= MIN_SAMPLE_AFFECTED
        and n_unaff >= MIN_SAMPLE_UNAFFECTED
    ):
        # 2x2: rows = affected / unaffected, cols = converted / not
        table = [
            [affected_converted, n_aff - affected_converted],
            [unaffected_converted, n_unaff - unaffected_converted],
        ]
        try:
            chi2, p_value, dof, expected = chi2_contingency(table)
            statistical_significance = p_value < 0.05
        except Exception:
            pass

    # Estimated lift if fixed: conservative (60% of gap) to optimistic (100%)
    lift_min = conversion_drop * 0.6
    lift_max = conversion_drop * 1.0
    if conversion_drop < 0:
        lift_min, lift_max = 0.0, 0.0

    result = {
        "affected_percentage": round(affected_pct, 2),
        "conversion_drop_percent": round(conversion_drop, 2),
        "statistical_significance": statistical_significance,
        "p_value": round(p_value, 4),
        "confidence_interval": [round(confidence_interval[0], 2), round(confidence_interval[1], 2)],
        "estimated_lift_if_fixed": {"min": round(lift_min, 2), "max": round(lift_max, 2)},
    }
    if n_aff < MIN_SAMPLE_AFFECTED or n_unaff < MIN_SAMPLE_UNAFFECTED:
        result["note"] = "Sample too small for significance (min 5 affected and 5 unaffected)"
    return result
