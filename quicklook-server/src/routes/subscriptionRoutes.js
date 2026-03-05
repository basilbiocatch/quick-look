"use strict";

import express from "express";
import * as subscriptionController from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/jwtAuth.js";

const router = express.Router();

router.use(requireAuth);

router.post("/create-checkout", subscriptionController.createCheckout);
router.post("/confirm-checkout", subscriptionController.confirmCheckout);
router.get("/confirm-checkout", subscriptionController.confirmCheckout);
router.post("/sync", subscriptionController.syncSubscription);
router.get("/sync", subscriptionController.syncSubscription);
router.post("/validate-coupon", subscriptionController.validateCoupon);
router.get("/status", subscriptionController.getStatus);
router.post("/create-portal", subscriptionController.createPortal);
router.get("/invoices", subscriptionController.getInvoices);
router.post("/cancel", subscriptionController.cancel);

export default router;
