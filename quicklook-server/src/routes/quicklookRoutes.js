"use strict";

import express from "express";
import * as quicklookController from "../controllers/quicklookController.js";
import { requireAuth } from "../middleware/jwtAuth.js";
import { validateOrigin } from "../middleware/validateOrigin.js";

const router = express.Router();

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

export default router;
