// Move message to Dead Letter Queue
import { pool } from '../../db/pool';
import { MessageWithDetails } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export async function moveToDLQ(
  message: MessageWithDetails,
  reason: string
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get event and subscriber details for snapshot
    const snapshotResult = await client.query<{
      event_type: string;
      version: string;
      payload: any;
      organization_id?: string;
      user_id?: string;
      subscriber_name: string;
      webhook_url: string;
    }>(`
      SELECT 
        e.event_type, e.version, e.payload, e.organization_id, e.user_id,
        s.name as subscriber_name, s.webhook_url
      FROM events e, subscribers s
      WHERE e.id = $1 AND s.id = $2
    `, [message.event_id, message.subscriber_id]);
    
    if (snapshotResult.rows.length === 0) {
      throw new Error('Event or subscriber not found for DLQ snapshot');
    }
    
    const snapshot = snapshotResult.rows[0];
    
    const eventSnapshot = {
      event_id: message.event_id,
      event_type: snapshot.event_type,
      version: snapshot.version,
      payload: snapshot.payload,
      organization_id: snapshot.organization_id,
      user_id: snapshot.user_id,
    };
    
    const subscriberSnapshot = {
      subscriber_id: message.subscriber_id,
      name: snapshot.subscriber_name,
      webhook_url: snapshot.webhook_url,
    };
    
    // Insert to DLQ
    await client.query(`
      INSERT INTO dead_letter_queue (
        id, message_id, event_snapshot, subscriber_snapshot, 
        failure_reason, moved_to_dlq_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      uuidv4(),
      message.id,
      JSON.stringify(eventSnapshot),
      JSON.stringify(subscriberSnapshot),
      reason,
    ]);
    
    // Update message status
    await client.query(
      `UPDATE messages 
       SET status = 'dlq', updated_at = NOW() 
       WHERE id = $1`,
      [message.id]
    );
    
    await client.query('COMMIT');
    
    logger.warn('Message moved to DLQ', {
      message_id: message.id,
      event_id: message.event_id,
      subscriber_id: message.subscriber_id,
      reason,
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to move message to DLQ', {
      message_id: message.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}

