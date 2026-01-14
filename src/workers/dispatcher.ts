// Dispatcher Worker - Deliver messages via webhooks
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { testConnection } from '../db/pool';
import { pollMessagesWithOrdering } from './shared/pollMessages';
import { deliverWebhook } from './shared/deliverWebhook';
import { handleDeliveryResponse } from './shared/handleResponse';

const workerId = config.worker.id;
const workerLogger = logger.child({ worker: 'dispatcher', worker_id: workerId });

async function processMessages(): Promise<void> {
  try {
    // Poll messages with ordering constraint
    const messages = await pollMessagesWithOrdering(workerId, config.worker.batchSize);

    if (messages.length === 0) {
      return;
    }

    workerLogger.info('Processing messages', { count: messages.length });

    // Process messages in parallel (they are independent due to ordering constraint)
    await Promise.all(
      messages.map(async (message) => {
        try {
          // Deliver webhook
          const result = await deliverWebhook(message, workerId);

          // Handle response (update status, retry, or DLQ)
          await handleDeliveryResponse(message, result);
        } catch (error) {
          workerLogger.error('Error processing message', {
            message_id: message.id,
            event_id: message.event_id,
            subscriber_id: message.subscriber_id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // On unexpected error, unlock the message so it can be retried
          // This will be handled by the cleanup worker
        }
      })
    );
  } catch (error) {
    workerLogger.error('Error in processMessages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function run(): Promise<void> {
  workerLogger.info('Dispatcher worker starting');

  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    workerLogger.error('Failed to connect to database');
    process.exit(1);
  }

  // Main loop
  while (true) {
    try {
      await processMessages();
    } catch (error) {
      workerLogger.error('Unexpected error in main loop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, config.worker.pollIntervalMs));
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
