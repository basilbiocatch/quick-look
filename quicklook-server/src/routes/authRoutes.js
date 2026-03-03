"use strict";

import express from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/jwtAuth.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);
router.get("/verify-email", authController.verifyEmail);
router.post("/verify-email", authController.verifyEmail);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/change-password", requireAuth, authController.changePassword);
router.post("/resend-verification", requireAuth, authController.resendVerificationEmail);

export default router;
