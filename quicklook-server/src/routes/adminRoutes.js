"use strict";

import express from "express";
import { requireAuth } from "../middleware/jwtAuth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import * as adminController from "../controllers/adminController.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

// ——— Plans ———
router.get("/plans", adminController.listPlans);
router.get("/plans/:planId", adminController.getPlan);
router.post("/plans", adminController.createPlan);
router.put("/plans/:planId", adminController.updatePlan);
router.delete("/plans/:planId", adminController.deletePlan);
router.post("/plans/:planId/activate", adminController.activatePlan);
router.post("/plans/:planId/deactivate", adminController.deactivatePlan);

// ——— Experiments ———
router.get("/experiments", adminController.listExperiments);
router.post("/experiments", adminController.createExperiment);
router.get("/experiments/:id/results", adminController.getExperimentResults);
router.post("/experiments/:id/conclude", adminController.concludeExperiment);
router.post("/experiments/:id/track", adminController.trackExperiment);
router.get("/experiments/:id", adminController.getExperiment);
router.put("/experiments/:id", adminController.updateExperiment);

// ——— Coupons ———
router.get("/coupons", adminController.listCoupons);
router.get("/coupons/:couponId", adminController.getCoupon);
router.post("/coupons", adminController.createCoupon);
router.put("/coupons/:couponId", adminController.updateCoupon);
router.delete("/coupons/:couponId", adminController.deleteCoupon);
router.post("/coupons/:couponId/sync", adminController.syncCoupon);

export default router;
