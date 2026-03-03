"use strict";

import express from "express";
import * as quicklookController from "../controllers/quicklookController.js";
import * as deviceIdController from "../controllers/deviceIdController.js";
import * as insightsController from "../controllers/insightsController.js";
import * as reportsController from "../controllers/reportsController.js";
import * as abTestController from "../controllers/abTestController.js";
import * as accuracyController from "../controllers/accuracyController.js";
import { requireAuth } from "../middleware/jwtAuth.js";
import { validateOrigin } from "../middleware/validateOrigin.js";
import { isDbConnected } from "../db.js";

const router = express.Router();

/** Fail fast with 503 if DB not connected (e.g. MongoDB unreachable from Cloud Run). */
function requireDb(req, res, next) {
  if (isDbConnected()) return next();
  console.error(
    "[requireDb] Database unavailable. If this is Cloud Run, ensure MongoDB allows connections (e.g. Atlas: Network Access → Allow Access from Anywhere)."
  );
  res.status(503).json({
    success: false,
    error: "Service temporarily unavailable. Please try again later.",
  });
}

router.use(requireDb);

router.get("/projects", requireAuth, quicklookController.getProjects);
router.post("/projects", requireAuth, quicklookController.createProject);
router.get("/projects/:projectKey/config", quicklookController.getProjectConfig);
router.get("/projects/:projectKey", requireAuth, quicklookController.getProject);
router.patch("/projects/:projectKey", requireAuth, quicklookController.updateProject);
router.delete("/projects/:projectKey", requireAuth, quicklookController.deleteProject);

router.post("/device-id", validateOrigin, deviceIdController.postDeviceId);
router.post("/sessions/start", validateOrigin, quicklookController.startSession);
router.post("/sessions/:sessionId/chunk", validateOrigin, quicklookController.saveChunk);
router.post("/sessions/:sessionId/end", validateOrigin, quicklookController.endSession);

router.get("/sessions", requireAuth, quicklookController.getSessions);
router.get("/sessions/:sessionId", requireAuth, quicklookController.getSession);
router.get("/sessions/:sessionId/events", requireAuth, quicklookController.getEvents);
router.get("/sessions/:sessionId/ensure-summary", requireAuth, quicklookController.ensureSummary);
router.get("/sessions/:sessionId/ensure-root-cause", requireAuth, quicklookController.ensureRootCause);

router.get("/insights", requireAuth, insightsController.getInsights);
router.post("/insights/generate", requireAuth, insightsController.postInsightsGenerate);
router.get("/insights/:insightId", requireAuth, insightsController.getInsightById);
router.patch("/insights/:insightId", requireAuth, insightsController.patchInsight);

router.get("/reports", requireAuth, reportsController.getReports);
router.get("/reports/:reportId", requireAuth, reportsController.getReportById);
router.post("/reports/generate", requireAuth, reportsController.postReportsGenerate);

router.get("/ab-tests", requireAuth, abTestController.getAbTests);
router.post("/ab-tests", requireAuth, abTestController.createAbTest);
router.get("/ab-tests/:testId", requireAuth, abTestController.getAbTestById);
router.patch("/ab-tests/:testId", requireAuth, abTestController.patchAbTest);

router.get("/accuracy-metrics", requireAuth, accuracyController.getAccuracyMetrics);
router.post("/models/retrain", requireAuth, accuracyController.postModelsRetrain);

export default router;
