"use strict";

import winston from "winston";

const { NODE_ENV, LOG_LEVEL } = process.env;
const isDevelopment = NODE_ENV === "development" || NODE_ENV === "dev" || !NODE_ENV;
const validLogLevels = ["error", "warn", "info", "http", "verbose", "debug", "silly"];

const getLogLevel = () => {
  if (LOG_LEVEL && validLogLevels.includes(LOG_LEVEL.toLowerCase().trim())) {
    return LOG_LEVEL.toLowerCase().trim();
  }
  return isDevelopment ? "debug" : "info";
};

const logger = winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} ${level.toUpperCase()}: ${message}${metaStr}`;
    })
  ),
  defaultMeta: { service: "quicklook-server" },
  transports: [new winston.transports.Console()],
});

export default logger;
