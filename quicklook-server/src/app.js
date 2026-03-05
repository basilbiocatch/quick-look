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
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import configRoutes from "./routes/configRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import supportChatRoutes from "./routes/supportChatRoutes.js";
import { requireAuth } from "./middleware/jwtAuth.js";
import { stripeBillingWebhook } from "./controllers/webhookController.js";
import { startQuicklookRetentionJob, startAutoCloseInactiveSessionsJob } from "./jobs/quicklookRetention.js";
import { startStorageCostJob } from "./jobs/storageCostJob.js";
import { startGracePeriodCleanupJob } from "./jobs/gracePeriodCleanup.js";
import { checkGcsBucketAtStartup } from "./services/quicklookService.js";
import logger from "./configs/loggingConfig.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const sdkDist = path.join(__dirname, "../../quicklook-sdk/dist");

const app = express();
app.set("trust proxy", true);

app.use(cors({ origin: "*" }));

// Compression middleware with optimized settings for large JSON responses
app.use(compression({
  filter: (req, res) => {
    // Always compress unless explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Compress all compressible content
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed (1-fastest) and compression ratio (9-best). 6 is a good default.
  threshold: 1024, // Only compress responses larger than 1KB
  memLevel: 8, // Memory usage for compression (1-9, higher = more memory but better compression)
}));

// Stripe webhook must receive raw body for signature verification
app.post(
  "/api/webhooks/billing/stripe",
  express.raw({ type: "application/json" }),
  stripeBillingWebhook
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure 403 responses always have a JSON body (so clients never see empty {})
app.use((req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode === 403) {
      const o = body && typeof body === "object" ? body : {};
      if (!o.error && !o.code) {
        body = {
          success: false,
          ...o,
          error: "Forbidden.",
          code: "FORBIDDEN",
        };
      }
    }
    return origJson(body);
  };
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/quicklook", quicklookRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/config", configRoutes);
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/support-chat", supportChatRoutes);

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
  const host = "0.0.0.0"; // required for Cloud Run so the health check can reach the container
  server.listen(PORT, host, () => {
    const scheme = server instanceof https.Server ? "https" : "http";
    logger.info(`Quicklook server listening on ${scheme}://${host}:${PORT}`);
    suppressNodeCronMissedWarnings();
    startQuicklookRetentionJob();
    startAutoCloseInactiveSessionsJob();
    startStorageCostJob();
    startGracePeriodCleanupJob();
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
