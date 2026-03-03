"use strict";

import { randomUUID } from "crypto";
import QuicklookAbTest from "../models/quicklookAbTestModel.js";
import QuicklookProject from "../models/quicklookProjectModel.js";
import logger from "../configs/loggingConfig.js";

async function getProjectForUser(projectKey, userId, res) {
  const project = await QuicklookProject.findOne({ projectKey }).lean();
  if (!project) {
    res.status(404).json({ success: false, error: "Project not found" });
    return null;
  }
  if (project.owner !== userId) {
    res.status(403).json({ success: false, error: "Forbidden" });
    return null;
  }
  return project;
}

/** GET /ab-tests?projectKey=...&status=...&limit=50 */
export const getAbTests = async (req, res) => {
  try {
    const { projectKey, status, limit = "50" } = req.query;
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const filter = { projectKey };
    if (status && ["planned", "running", "completed"].includes(status)) {
      filter.status = status;
    }
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const tests = await QuicklookAbTest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();
    return res.json({ success: true, data: tests });
  } catch (err) {
    logger.error("quicklook getAbTests", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** GET /ab-tests/:testId */
export const getAbTestById = async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await QuicklookAbTest.findOne({ testId }).lean();
    if (!test) {
      return res.status(404).json({ success: false, error: "A/B test not found" });
    }
    const project = await getProjectForUser(test.projectKey, req.user.userId, res);
    if (!project) return;
    return res.json({ success: true, data: test });
  } catch (err) {
    logger.error("quicklook getAbTestById", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** POST /ab-tests - body: { projectKey, insightId?, hypothesis?, changeDescription?, expectedLift? } */
export const createAbTest = async (req, res) => {
  try {
    const { projectKey, insightId, hypothesis, changeDescription, expectedLift } = req.body || {};
    if (!projectKey) {
      return res.status(400).json({ success: false, error: "projectKey is required" });
    }
    const project = await getProjectForUser(projectKey, req.user.userId, res);
    if (!project) return;
    const testId = `ab_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const doc = {
      testId,
      projectKey,
      insightId: insightId || undefined,
      hypothesis: hypothesis || "",
      changeDescription: changeDescription || "",
      expectedLift: expectedLift && typeof expectedLift === "object"
        ? { min: expectedLift.min, max: expectedLift.max }
        : undefined,
      status: "planned",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const created = await QuicklookAbTest.create(doc);
    return res.status(201).json({ success: true, data: created.toObject() });
  } catch (err) {
    logger.error("quicklook createAbTest", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/** PATCH /ab-tests/:testId - body: { status?, results? } */
export const patchAbTest = async (req, res) => {
  try {
    const { testId } = req.params;
    const { status, results } = req.body || {};
    const test = await QuicklookAbTest.findOne({ testId });
    if (!test) {
      return res.status(404).json({ success: false, error: "A/B test not found" });
    }
    const project = await getProjectForUser(test.projectKey, req.user.userId, res);
    if (!project) return;
    const update = { updatedAt: new Date() };
    if (status && ["planned", "running", "completed"].includes(status)) {
      update.status = status;
      if (status === "running" && !test.startedAt) {
        update.startedAt = new Date();
      }
      if (status === "completed") {
        update.completedAt = new Date();
      }
    }
    if (results && typeof results === "object") {
      update.results = {
        controlConversion: results.controlConversion,
        variantConversion: results.variantConversion,
        actualLift: results.actualLift,
        pValue: results.pValue,
        sampleSize: results.sampleSize,
      };
    }
    const updated = await QuicklookAbTest.findOneAndUpdate(
      { testId },
      { $set: update },
      { new: true }
    ).lean();
    // Phase 7: notify analytics to update pattern library when A/B test completed with results
    const base = process.env.QUICKLOOK_ANALYTICS_URL || process.env.ANALYTICS_BASE_URL || "";
    if (base && updated.status === "completed" && updated.results?.actualLift != null) {
      fetch(
        `${base.replace(/\/$/, "")}/patterns/update-from-ab-test?testId=${encodeURIComponent(testId)}`,
        { method: "POST" }
      ).catch((e) => logger.warn("analytics update-from-ab-test failed", { error: e.message }));
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    logger.error("quicklook patchAbTest", { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};
