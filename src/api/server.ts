// API Server - Event ingestion endpoint
import express, { Express } from 'express';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { testConnection } from '../db/pool';
import { errorHandler } from './middleware/errorHandler';
import eventsRouter from './routes/events';
import healthRouter from './routes/health';
import dlqRouter from './routes/dlq';
import subscribersRouter from './routes/subscribers';
import { verifyXServiceToken } from './middleware/verifyXServiceToken';

const app: Express = express();

// Middleware
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/', verifyXServiceToken, eventsRouter);
app.use('/', healthRouter);
app.use('/', verifyXServiceToken, dlqRouter);
app.use('/', verifyXServiceToken, subscribersRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    // Start listening
    app.listen(config.api.port, config.api.host, () => {
      logger.info('API server started', {
        port: config.api.port,
        host: config.api.host,
        env: config.api.env,
        worker_id: config.worker.id,
      });
    });
  } catch (error) {
    logger.error('Failed to start API server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

start();
