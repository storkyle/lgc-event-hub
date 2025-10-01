// Fan-out Worker - Convert events to messages for subscribers
import { pool } from '../db/pool';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { testConnection } from '../db/pool';
import { Event, Subscriber, OrderingKey } from '../types';
import { v4 as uuidv4 } from 'uuid';

const workerId = config.worker.id;
const workerLogger = logger.child({ worker: 'fanout', worker_id: workerId });

async function processEvents(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get pending events
    const eventsResult = await client.query<Event>(
      `SELECT * FROM events 
       WHERE status = 'pending' 
       ORDER BY created_at ASC 
       LIMIT $1 
       FOR UPDATE SKIP LOCKED`,
      [config.worker.batchSize || 50]
    );
    
    if (eventsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return;
    }

    workerLogger.info('Processing events', { count: eventsResult.rows.length });
    
    for (const event of eventsResult.rows) {
      // Find active subscribers for this event type
      const subscribersResult = await client.query<Subscriber>(
        `SELECT * FROM subscribers 
         WHERE event_type = $1 AND is_active = true`,
        [event.event_type]
      );
      
      const subscribers = subscribersResult.rows;
      
      if (subscribers.length === 0) {
        // No subscribers - mark event as completed
        await client.query(
          `UPDATE events SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [event.id]
        );
        
        workerLogger.info('No subscribers found for event', {
          event_id: event.id,
          event_type: event.event_type,
        });
        continue;
      }
      
      // Create messages for each subscriber
      for (const subscriber of subscribers) {
        const messageId = uuidv4();
        
        // Extract ordering key value if ordering is enabled
        let orderingKeyValue: string | null = null;
        if (subscriber.ordering_enabled && subscriber.ordering_key) {
          const key = subscriber.ordering_key as OrderingKey;
          if (key === 'organization_id') {
            orderingKeyValue = event.organization_id || null;
          } else if (key === 'user_id') {
            orderingKeyValue = event.user_id || null;
          }
        }
        
        await client.query(
          `INSERT INTO messages (
            id, event_id, subscriber_id, status, retry_count,
            ordering_key_value, created_at, updated_at
          ) VALUES ($1, $2, $3, 'pending', 0, $4, NOW(), NOW())`,
          [messageId, event.id, subscriber.id, orderingKeyValue]
        );
      }
      
      // Update event status to processing
      await client.query(
        `UPDATE events SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [event.id]
      );
      
      workerLogger.info('Created messages for event', {
        event_id: event.id,
        event_type: event.event_type,
        subscriber_count: subscribers.length,
      });
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    workerLogger.error('Error processing events', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    client.release();
  }
}

async function run(): Promise<void> {
  workerLogger.info('Fan-out worker starting');
  
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    workerLogger.error('Failed to connect to database');
    process.exit(1);
  }
  
  // Main loop
  while (true) {
    try {
      await processEvents();
    } catch (error) {
      workerLogger.error('Unexpected error in main loop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, config.worker.pollIntervalMs));
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

