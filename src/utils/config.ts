// Configuration management with environment variables
import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Database
  db: {
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "eventhub",
    user: process.env.DB_USER || "eventhub",
    password: process.env.DB_PASSWORD || "changeme",
    port: parseInt(process.env.DB_PORT || "5432"),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "20"),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 10000,
  },

  // API Server
  api: {
    host: process.env.NODE_HOST || "localhost",
    port: parseInt(process.env.NODE_PORT || "3000"),
    env: process.env.NODE_ENV || "development",
  },

  // Worker settings
  worker: {
    id: process.env.WORKER_ID || `worker-${process.pid}`,
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "100"),
    batchSize: parseInt(process.env.BATCH_SIZE || "20"),
    webhookTimeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || "10000"),
    staleTimeoutSeconds: parseInt(process.env.STALE_TIMEOUT_SECONDS || "60"),
    checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS || "60000"),
  },

  // HTTP client
  http: {
    maxConnections: 50,
    keepAliveTimeout: 30000,
    keepAliveMaxTimeout: 600000,
    headersTimeout: 10000,
    bodyTimeout: 10000,
  },
} as const;

export type Config = typeof config;
