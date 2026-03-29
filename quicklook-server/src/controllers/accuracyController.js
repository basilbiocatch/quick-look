"use strict";

import QuicklookInsight from "../models/quicklookInsightModel.js";
import QuicklookAbTest from "../models/quicklookAbTestModel.js";
import logger from "../configs/loggingConfig.js";
import { getProjectForUser, canEditSessions } from "../utils/projectAccess.js";

/**
 * GET /accuracy-metrics?projectKey=...
 * Returns Phase 7 accuracy metrics: resolution rate, avg accuracy rating, A/B tests completed,
 * and predicted vs actual lift for model accuracy dashboard.
 */
export const getAccuracyMetrics = async (req, res) => {
  try {
    const { projectKey } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const access = await getProjectForUser(projectKey, req.user.userId, res);
    if (!access) return;

    const [insights, abTests] = await Promise.all([
      QuicklookInsight.find({ projectKey }).lean(),
      QuicklookAbTest.find({ projectKey }).lean(),
    ]);

    const totalInsights = insights.length;
    const resolved = insights.filter((i) => i.status === "resolved");
    const ignored = insights.filter((i) => i.status === "ignored");
    const active = insights.filter((i) => i.status === "active");
    const resolutionRate =
      totalInsights > 0 ? ((resolved.length + ignored.length) / totalInsights) * 100 : 0;

    const withRating = insights.filter((i) => i.accuracyRating != null && i.accuracyRating >= 1);
    const avgAccuracyRating =
      withRating.length > 0
        ? withRating.reduce((s, i) => s + i.accuracyRating, 0) / withRating.length
        : null;

    const completedAbTests = abTests.filter((t) => t.status === "completed");
    const liftPredictions = [];
    for (const t of completedAbTests) {
      const actual = t.results?.actualLift;
      if (actual == null) continue;
      const exp = t.expectedLift || {};
      const predMin = exp.min != null ? Number(exp.min) : null;
      const predMax = exp.max != null ? Number(exp.max) : null;
      const predictedMid =
        predMin != null && predMax != null ? (predMin + predMax) / 2 : predMin ?? predMax ?? null;
      const error = predictedMid != null ? actual - predictedMid : null;
      liftPredictions.push({
        testId: t.testId,
        changeDescription: t.changeDescription,
        predictedMin: predMin,
        predictedMax: predMax,
        actual: Number(actual),
        error,
      });
    }
    const avgLiftError =
      liftPredictions.filter((p) => p.error != null).length > 0
        ? liftPredictions
            .filter((p) => p.error != null)
            .reduce((s, p) => s + p.error, 0) / liftPredictions.filter((p) => p.error != null).length
        : null;

    return res.json({
      success: true,
      data: {
        totalInsights,
        resolvedCount: resolved.length,
        ignoredCount: ignored.length,
        activeCount: active.length,
        resolutionRate: Math.round(resolutionRate * 10) / 10,
        avgAccuracyRating: avgAccuracyRating != null ? Math.round(avgAccuracyRating * 10) / 10 : null,
        ratingsCount: withRating.length,
        abTestsCompleted: completedAbTests.length,
        liftPredictions,
        avgLiftError: avgLiftError != null ? Math.round(avgLiftError * 100) / 100 : null,
      },
    });
  } catch (err) {
    logger.error("quicklook getAccuracyMetrics", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /models/retrain - proxy to analytics to retrain lift predictor.
 * Body or query: projectKey (optional). Requires QUICKLOOK_ANALYTICS_URL.
 */
export const postModelsRetrain = async (req, res) => {
  try {
    const projectKey = (req.body?.projectKey ?? req.query?.projectKey ?? "").toString().trim() || undefined;
    if (projectKey) {
      const access = await getProjectForUser(projectKey, req.user.userId, res);
      if (!access) return;
      if (!canEditSessions(access.role)) {
        return res.status(403).json({ success: false, error: "Viewers cannot trigger model retrain.", code: "FORBIDDEN_VIEWER" });
      }
    }
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (!base) {
      return res.status(501).json({
        success: false,
        error: "Analytics service not configured (QUICKLOOK_ANALYTICS_URL). Cannot retrain.",
      });
    }
    const url = projectKey
      ? `${base.replace(/\/$/, "")}/models/retrain?projectKey=${encodeURIComponent(projectKey)}`
      : `${base.replace(/\/$/, "")}/models/retrain`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(data || { success: false, error: "Analytics request failed" });
    }
    return res.json(data);
  } catch (err) {
    logger.error("quicklook postModelsRetrain", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
