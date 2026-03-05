"use strict";

import express from "express";
import * as quicklookController from "../controllers/quicklookController.js";
import * as deviceIdController from "../controllers/deviceIdController.js";
import * as insightsController from "../controllers/insightsController.js";
import * as reportsController from "../controllers/reportsController.js";
import * as abTestController from "../controllers/abTestController.js";
import * as accuracyController from "../controllers/accuracyController.js";
import { requireAuth, requireEmailVerified } from "../middleware/jwtAuth.js";
import { requirePlan } from "../middleware/requirePlan.js";
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

/** GET /projects allowed without email verification so dashboard can load; all other routes require verification for free users after 2 days */
router.get("/projects", requireAuth, quicklookController.getProjects);
/** Public: SDK loads project config without auth */
router.get("/projects/:projectKey/config", quicklookController.getProjectConfig);
/** Public: get or create device ID (used for session correlation and for pricing experiment visitor identity when not logged in) */
router.post("/device-id", validateOrigin, deviceIdController.postDeviceId);
/** Public: SDK session recording — no JWT; only validateOrigin (allowed domains) */
router.post("/sessions/start", validateOrigin, quicklookController.startSession);
router.post("/sessions/:sessionId/chunk", validateOrigin, quicklookController.saveChunk);
router.post("/sessions/:sessionId/end", validateOrigin, quicklookController.endSession);
router.post("/sessions/:sessionId/identify", validateOrigin, quicklookController.updateSessionIdentify);

/** Public: view shared recording by token (no auth) */
router.get("/public/share/:shareToken", quicklookController.getPublicShare);

router.use(requireAuth, requireEmailVerified);

router.post("/projects", quicklookController.createProject);
router.get("/projects/:projectKey", quicklookController.getProject);
router.patch("/projects/:projectKey", quicklookController.updateProject);
router.delete("/projects/:projectKey", quicklookController.deleteProject);

router.get("/sessions", quicklookController.getSessions);
router.get("/sessions/:sessionId", quicklookController.getSession);
router.get("/sessions/:sessionId/events", quicklookController.getEvents);
router.get("/sessions/:sessionId/chunks", quicklookController.getSessionChunks);
router.get("/sessions/:sessionId/ensure-summary", requirePlan(["pro"]), quicklookController.ensureSummary);
router.get("/sessions/:sessionId/ensure-root-cause", requirePlan(["pro"]), quicklookController.ensureRootCause);
router.post("/sessions/:sessionId/share", quicklookController.createShare);
router.delete("/sessions/:sessionId/share", quicklookController.revokeShare);

router.get("/insights", requirePlan(["pro"]), insightsController.getInsights);
router.post("/insights/generate", requirePlan(["pro"]), insightsController.postInsightsGenerate);
router.get("/insights/:insightId", requirePlan(["pro"]), insightsController.getInsightById);
router.patch("/insights/:insightId", requirePlan(["pro"]), insightsController.patchInsight);

router.get("/reports", requirePlan(["pro"]), reportsController.getReports);
router.get("/reports/:reportId", requirePlan(["pro"]), reportsController.getReportById);
router.post("/reports/generate", requirePlan(["pro"]), reportsController.postReportsGenerate);

router.get("/ab-tests", requirePlan(["pro"]), abTestController.getAbTests);
router.post("/ab-tests", requirePlan(["pro"]), abTestController.createAbTest);
router.get("/ab-tests/:testId", requirePlan(["pro"]), abTestController.getAbTestById);
router.patch("/ab-tests/:testId", requirePlan(["pro"]), abTestController.patchAbTest);

router.get("/accuracy-metrics", accuracyController.getAccuracyMetrics);
router.post("/models/retrain", accuracyController.postModelsRetrain);

export default router;
