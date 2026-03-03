"use strict";

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import http from "http";
import https from "https";
import express from "express";
import compression from "compression";
import cors from "cors";
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
  const appIndex = path.join(publicDir, "index.html");
  if (fs.existsSync(appIndex)) {
    app.get("/", (req, res) => res.sendFile(appIndex));
    app.get("*", (req, res) => res.sendFile(appIndex));
  }
} else {
  app.use(express.static(sdkDist, { index: false }));
}

const PORT = process.env.PORT || 3080;
const useHttps = process.env.USE_HTTPS === "1" || process.env.USE_HTTPS === "true";
const sslKeyPath = process.env.SSL_KEY_PATH || process.env.HTTPS_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH || process.env.HTTPS_CERT_PATH;

// Suppress node-cron "missed execution" spam when the process was suspended (e.g. machine sleep)
function suppressNodeCronMissedWarnings() {
  const orig = console.warn;
  console.warn = (...args) => {
    const msg = args[0] && typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("NODE-CRON") && msg.includes("missed execution")) return;
    orig.apply(console, args);
  };
}

function startServer(server) {
  server.listen(PORT, () => {
    const scheme = server instanceof https.Server ? "https" : "http";
    logger.info(`Quicklook server listening on ${scheme}://localhost:${PORT}`);
    suppressNodeCronMissedWarnings();
    startQuicklookRetentionJob();
    startAutoCloseInactiveSessionsJob();
    startStorageCostJob();
    checkGcsBucketAtStartup().catch(() => {});
  });
}

if (useHttps && sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const key = fs.readFileSync(sslKeyPath);
  const cert = fs.readFileSync(sslCertPath);
  const server = https.createServer({ key, cert }, app);
  startServer(server);
} else {
  if (useHttps) {
    logger.warn("USE_HTTPS is set but SSL_KEY_PATH/SSL_CERT_PATH missing or files not found. Falling back to HTTP.");
  }
  startServer(http.createServer(app));
}
