"use strict";

import express from "express";
import multer from "multer";
import * as supportChatController from "../controllers/supportChatController.js";
import { optionalAuth } from "../middleware/jwtAuth.js";
import { supportChatRateLimit } from "../middleware/supportChatRateLimit.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Use JPEG, PNG, GIF, or WebP."));
  },
});

router.use(optionalAuth);
router.use(supportChatRateLimit);

router.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "Support chat API; use POST to send messages." });
});
router.get("/history", supportChatController.getHistory);
router.get("/:threadId", supportChatController.getConversation);
router.post("/", supportChatController.postChat);
router.post("/end", supportChatController.postEndConversation);
router.post(
  "/upload-image",
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message || "Invalid file." });
      }
      next();
    });
  },
  supportChatController.uploadImage
);
router.post("/satisfaction", supportChatController.postSatisfaction);

export default router;
