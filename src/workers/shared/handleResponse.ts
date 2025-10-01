// Handle delivery response and update message status
import { pool } from '../../db/pool';
import { MessageWithDetails } from '../../types';
import { DeliveryResult, shouldRetry } from './deliverWebhook';
import { moveToDLQ } from './moveToDLQ';
import { logger } from '../../utils/logger';

export async function handleDeliveryResponse(
  message: MessageWithDetails,
  result: DeliveryResult
): Promise<void> {
  if (result.success) {
    // Mark as delivered
    await pool.query(`
      UPDATE messages
      SET status = 'delivered',
          delivered_at = NOW(),
          locked_by = NULL,
          locked_at = NULL,
          updated_at = NOW()
      WHERE id = $1
    `, [message.id]);
    
    logger.info('Message delivered successfully', {
      message_id: message.id,
      event_id: message.event_id,
      subscriber_id: message.subscriber_id,
      duration_ms: result.duration,
    });
    
    // Check if event is completed
    await checkAndCompleteEvent(message.event_id);
    
  } else {
    // Determine if we should retry
    const canRetry = shouldRetry(result);
    const retriesExhausted = message.retry_count >= message.retry_limit;
    
    if (!canRetry || retriesExhausted) {
      // Move to DLQ
      const reason = retriesExhausted
        ? `Retries exhausted after ${message.retry_count + 1} attempts. Last error: ${result.errorMessage}`
        : `Non-retryable error: HTTP ${result.statusCode}. ${result.errorMessage}`;
      
      await moveToDLQ(message, reason);
      
    } else {
      // Schedule retry with backoff
      const backoffIndex = Math.min(
        message.retry_count,
        message.retry_backoff_seconds.length - 1
      );
      const backoffSeconds = message.retry_backoff_seconds[backoffIndex];
      const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);
      
      await pool.query(`
        UPDATE messages
        SET status = 'failed',
            retry_count = $1,
            next_retry_at = $2,
            locked_by = NULL,
            locked_at = NULL,
            updated_at = NOW()
        WHERE id = $3
      `, [message.retry_count + 1, nextRetryAt, message.id]);
      
      logger.info('Message scheduled for retry', {
        message_id: message.id,
        event_id: message.event_id,
        subscriber_id: message.subscriber_id,
        retry_count: message.retry_count + 1,
        next_retry_at: nextRetryAt.toISOString(),
        error: result.errorMessage,
      });
    }
  }
}

async function checkAndCompleteEvent(eventId: string): Promise<void> {
  const result = await pool.query<{ all_delivered: boolean }>(`
    SELECT NOT EXISTS (
      SELECT 1 FROM messages 
      WHERE event_id = $1 AND status NOT IN ('delivered', 'dlq')
    ) as all_delivered
  `, [eventId]);
  
  if (result.rows[0]?.all_delivered) {
    await pool.query(
      `UPDATE events SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [eventId]
    );
    
    logger.info('Event completed', { event_id: eventId });
  }
}

