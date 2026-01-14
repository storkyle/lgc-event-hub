// Cleanup Worker - Recover stale deliveries from crashed workers
import { pool } from '../db/pool';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { testConnection } from '../db/pool';

const workerId = config.worker.id;
const workerLogger = logger.child({ worker: 'cleanup', worker_id: workerId });

async function cleanupStaleMessages(): Promise<void> {
  try {
    const staleThreshold = new Date(Date.now() - config.worker.staleTimeoutSeconds * 1000);

    const result = await pool.query(
      `UPDATE messages
       SET status = 'failed',
           next_retry_at = NOW(),
           locked_by = NULL,
           locked_at = NULL,
           updated_at = NOW()
       WHERE status = 'delivering'
         AND locked_at < $1
       RETURNING id, event_id, subscriber_id, locked_by, locked_at`,
      [staleThreshold]
    );

    if (result.rows.length > 0) {
      workerLogger.warn('Recovered stale messages', {
        count: result.rows.length,
        messages: result.rows,
      });

      // Log each stale message for alerting
      for (const row of result.rows) {
        workerLogger.warn('Stale message detected', {
          message_id: row.id,
          event_id: row.event_id,
          subscriber_id: row.subscriber_id,
          locked_by: row.locked_by,
          locked_at: row.locked_at,
        });
      }
    }
  } catch (error) {
    workerLogger.error('Error cleaning up stale messages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function run(): Promise<void> {
  workerLogger.info('Cleanup worker starting', {
    stale_timeout_seconds: config.worker.staleTimeoutSeconds,
    check_interval_ms: config.worker.checkIntervalMs,
  });

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    workerLogger.error('Failed to connect to database');
    process.exit(1);
  }

  // Main loop
  while (true) {
    try {
      await cleanupStaleMessages();
    } catch (error) {
      workerLogger.error('Unexpected error in main loop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, config.worker.checkIntervalMs));
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  workerLogger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  workerLogger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

run();
