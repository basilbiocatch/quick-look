"use strict";

import mongoose from "mongoose";
import logger from "./configs/loggingConfig.js";

const QUICKLOOK_DB = (process.env.QUICKLOOK_DB || "").trim();
if (!QUICKLOOK_DB || (!QUICKLOOK_DB.startsWith("mongodb://") && !QUICKLOOK_DB.startsWith("mongodb+srv://"))) {
  const msg =
    "QUICKLOOK_DB is required and must start with mongodb:// or mongodb+srv://. Set it in .env (local) or Cloud Run env vars / Secret Manager (production).";
  logger.error(msg);
  throw new Error(msg);
}

const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
};

const quicklookConn = mongoose.createConnection(QUICKLOOK_DB, connectionOptions);

quicklookConn.on("connected", () => logger.info("QuicklookDB connected"));
quicklookConn.on("error", (err) => logger.error("QuicklookDB error:", err));
quicklookConn.on("disconnected", () => logger.warn("QuicklookDB disconnected"));

/** 1 = connected. Use to fail fast instead of buffering when DB is unreachable. */
function isDbConnected() {
  return quicklookConn.readyState === 1;
}

export { quicklookConn, isDbConnected };
