"use strict";

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import compression from "compression";
import cors from "cors";
import fs from "fs";
import quicklookRoutes from "./routes/quicklookRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { startQuicklookRetentionJob, startAutoCloseInactiveSessionsJob } from "./jobs/quicklookRetention.js";
import { startStorageCostJob } from "./jobs/storageCostJob.js";
import { checkGcsBucketAtStartup } from "./services/quicklookService.js";
import logger from "./configs/loggingConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const sdkDist = path.join(__dirname, "../../quicklook-sdk/dist");

const app = express();
app.set("trust proxy", true);

app.use(cors({ origin: "*" }));
app.use(compression());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/quicklook", quicklookRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "quicklook-server" });
});

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false }));
  const appIndex = path.join(publicDir, "app", "index.html");
  if (fs.existsSync(appIndex)) {
    app.get("/app", (req, res) => res.sendFile(appIndex));
    app.get("/app/*", (req, res) => res.sendFile(appIndex));
  }
} else {
  app.use(express.static(sdkDist, { index: false }));
}

const PORT = process.env.PORT || 3080;
app.listen(PORT, () => {
  logger.info(`Quicklook server listening on port ${PORT}`);
  startQuicklookRetentionJob();
  startAutoCloseInactiveSessionsJob();
  startStorageCostJob();
  checkGcsBucketAtStartup().catch(() => {});
});
