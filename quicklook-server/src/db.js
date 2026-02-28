"use strict";

import mongoose from "mongoose";
import logger from "./configs/loggingConfig.js";

const QUICKLOOK_DB = process.env.QUICKLOOK_DB || "";
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

export { quicklookConn };
