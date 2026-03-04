"use strict";

import express from "express";
import * as subscriptionController from "../controllers/subscriptionController.js";
import { requireAuth } from "../middleware/jwtAuth.js";

const router = express.Router();

router.use(requireAuth);

router.post("/create-checkout", subscriptionController.createCheckout);
router.post("/validate-coupon", subscriptionController.validateCoupon);
router.get("/status", subscriptionController.getStatus);
router.post("/create-portal", subscriptionController.createPortal);
router.get("/invoices", subscriptionController.getInvoices);
router.post("/cancel", subscriptionController.cancel);

export default router;
