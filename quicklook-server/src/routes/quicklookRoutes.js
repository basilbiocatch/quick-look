"use strict";

import express from "express";
import * as quicklookController from "../controllers/quicklookController.js";
import * as insightsController from "../controllers/insightsController.js";
import * as reportsController from "../controllers/reportsController.js";
import { requireAuth } from "../middleware/jwtAuth.js";
import { validateOrigin } from "../middleware/validateOrigin.js";
import { isDbConnected } from "../db.js";

const router = express.Router();

/** Fail fast with 503 if DB not connected (e.g. MongoDB unreachable from Cloud Run). */
function requireDb(req, res, next) {
  if (isDbConnected()) return next();
  res.status(503).json({
    success: false,
    error: "Database unavailable. If this is Cloud Run, ensure MongoDB allows connections (e.g. Atlas: Network Access → Allow Access from Anywhere).",
  });
}

router.use(requireDb);

router.get("/projects", requireAuth, quicklookController.getProjects);
router.post("/projects", requireAuth, quicklookController.createProject);
router.get("/projects/:projectKey/config", quicklookController.getProjectConfig);
router.get("/projects/:projectKey", requireAuth, quicklookController.getProject);
router.patch("/projects/:projectKey", requireAuth, quicklookController.updateProject);
router.delete("/projects/:projectKey", requireAuth, quicklookController.deleteProject);

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

export default router;
