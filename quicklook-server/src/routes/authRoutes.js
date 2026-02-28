"use strict";

import express from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/jwtAuth.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);

export default router;
