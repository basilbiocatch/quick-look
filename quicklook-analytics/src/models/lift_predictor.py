"""
Lift prediction: regression from friction/pattern features to expected conversion lift (%).
Bootstrap: use impact estimated_lift_if_fixed when no historical A/B data.
Optional: train sklearn regression on abTestResults when available.
Plan: Feature 8 (Lift Prediction), Phase 5.
"""
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Optional sklearn for regression when we have enough abTestResults
try:
    import numpy as np
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.preprocessing import LabelEncoder
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    np = None

# Default model path (can be overridden by env)
MODEL_DIR = Path(os.environ.get("MODEL_PATH", "/tmp/quicklook_models")).resolve()
LIFT_MODEL_FILENAME = "lift_predictor.pkl"
LABEL_ENCODER_FILENAME = "lift_label_encoder.pkl"


def _feature_vector(
    friction_type: str,
    conversion_drop_percent: float,
    affected_percentage: float,
    severity_num: int = 1,
    pattern_expected_lift_min: float = 0,
    pattern_expected_lift_max: float = 0,
) -> list[float]:
    """Build a small feature vector for lift prediction."""
    severity = 1 if severity_num == 0 else min(3, severity_num)
    return [
        conversion_drop_percent,
        affected_percentage,
        float(severity),
        pattern_expected_lift_min,
        pattern_expected_lift_max,
        (pattern_expected_lift_min + pattern_expected_lift_max) / 2 if (pattern_expected_lift_min or pattern_expected_lift_max) else conversion_drop_percent * 0.7,
    ]


def predict_lift_rule_based(
    conversion_drop_percent: float,
    estimated_lift_if_fixed: dict[str, float] | None = None,
    pattern_fix: dict[str, Any] | None = None,
) -> tuple[float, float, float]:
    """
    Rule-based lift prediction when no ML model is trained.
    Returns (lift_min, lift_max, confidence).
    """
    if estimated_lift_if_fixed and isinstance(estimated_lift_if_fixed, dict):
        mn = float(estimated_lift_if_fixed.get("min", 0))
        mx = float(estimated_lift_if_fixed.get("max", 0))
        if mn > 0 or mx > 0:
            confidence = 0.75
            return mn, mx, confidence
    if pattern_fix and isinstance(pattern_fix, dict):
        lift = pattern_fix.get("expectedLift") or pattern_fix.get("predictedLift") or {}
        if isinstance(lift, (int, float)):
            v = float(lift)
            return v * 0.8, v, 0.7
        mn = float(lift.get("min", 0))
        mx = float(lift.get("max", 0))
        if mn > 0 or mx > 0:
            return mn, mx, float(pattern_fix.get("confidence", 0.7))
    # Fallback: use conversion drop as proxy (fix recovers some of the gap)
    if conversion_drop_percent and conversion_drop_percent > 0:
        return (
            round(conversion_drop_percent * 0.5, 2),
            round(conversion_drop_percent * 1.0, 2),
            0.5,
        )
    return 0.0, 0.0, 0.0


class LiftPredictor:
    """
    Optional sklearn-based lift predictor. Train on abTestResults (actualLift) when available;
    otherwise predict_lift_rule_based is used.
    """

    def __init__(self):
        self.model = None
        self.label_encoder = None
        self._severity_map = {"low": 1, "medium": 2, "high": 3, "critical": 3}

    def _severity_to_num(self, severity: str | int) -> int:
        if isinstance(severity, int):
            return max(1, min(3, severity))
        return self._severity_map.get((severity or "").lower(), 1)

    def predict(
        self,
        friction_type: str,
        conversion_drop_percent: float,
        affected_percentage: float,
        severity: str | int = 1,
        pattern_fix: dict | None = None,
        estimated_lift_if_fixed: dict | None = None,
    ) -> tuple[float, float, float]:
        """
        Predict expected lift (min, max, confidence). Uses ML model if trained and HAS_SKLEARN;
        otherwise rule-based.
        """
        # Rule-based path (always works)
        lift_min, lift_max, conf = predict_lift_rule_based(
            conversion_drop_percent,
            estimated_lift_if_fixed=estimated_lift_if_fixed,
            pattern_fix=pattern_fix,
        )
        if not HAS_SKLEARN or self.model is None:
            return lift_min, lift_max, conf

        # ML path: build features and predict
        pat_min = pat_max = 0.0
        if pattern_fix and isinstance(pattern_fix, dict):
            lift = pattern_fix.get("expectedLift") or pattern_fix.get("predictedLift") or {}
            if isinstance(lift, dict):
                pat_min = float(lift.get("min", 0))
                pat_max = float(lift.get("max", 0))
        sev_num = self._severity_to_num(severity)
        X = np.array([_feature_vector(
            friction_type,
            conversion_drop_percent,
            affected_percentage,
            sev_num,
            pat_min,
            pat_max,
        )])
        try:
            pred = self.model.predict(X)[0]
            pred = max(0.0, float(pred))
            # Use ML prediction to scale rule-based range
            ml_min = pred * 0.8
            ml_max = pred * 1.2
            return (
                round(min(lift_min, ml_min), 2),
                round(max(lift_max, ml_max), 2),
                min(0.95, conf + 0.1),
            )
        except Exception as e:
            logger.warning("LiftPredictor ML predict failed: %s", e)
            return lift_min, lift_max, conf

    def train(self, training_data: list[dict[str, Any]]) -> bool:
        """
        Train regression on list of { conversion_drop_percent, affected_percentage, severity, actual_lift, ... }.
        actual_lift is the target. Returns True if trained, False if not enough data or sklearn missing.
        """
        if not HAS_SKLEARN or not training_data or len(training_data) < 5:
            return False
        X = []
        y = []
        for row in training_data:
            actual = row.get("actualLift")
            if actual is None:
                continue
            try:
                feat = _feature_vector(
                    row.get("frictionType", "unknown"),
                    float(row.get("conversion_drop_percent", 0)),
                    float(row.get("affected_percentage", 0)),
                    self._severity_to_num(row.get("severity", "medium")),
                    float(row.get("pattern_lift_min", 0)),
                    float(row.get("pattern_lift_max", 0)),
                )
                X.append(feat)
                y.append(float(actual))
            except (TypeError, ValueError):
                continue
        if len(X) < 5:
            return False
        try:
            import joblib
            X_arr = np.array(X)
            y_arr = np.array(y)
            self.model = GradientBoostingRegressor(n_estimators=50, max_depth=3, random_state=42)
            self.model.fit(X_arr, y_arr)
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            joblib.dump(self.model, MODEL_DIR / LIFT_MODEL_FILENAME)
            return True
        except Exception as e:
            logger.warning("LiftPredictor train failed: %s", e)
            return False

    def load(self) -> bool:
        """Load persisted model if present. Returns True if loaded."""
        if not HAS_SKLEARN:
            return False
        path = MODEL_DIR / LIFT_MODEL_FILENAME
        if not path.exists():
            return False
        try:
            import joblib
            self.model = joblib.load(path)
            return True
        except Exception as e:
            logger.warning("LiftPredictor load failed: %s", e)
            return False


# Singleton for optional ML path
_lift_predictor: LiftPredictor | None = None


def get_lift_predictor() -> LiftPredictor:
    global _lift_predictor
    if _lift_predictor is None:
        _lift_predictor = LiftPredictor()
        _lift_predictor.load()
    return _lift_predictor
