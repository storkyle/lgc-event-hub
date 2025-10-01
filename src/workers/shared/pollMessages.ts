// Poll messages with ordering constraint
import { pool } from '../../db/pool';
import { MessageWithDetails } from '../../types';

export async function pollMessagesWithOrdering(
  workerId: string,
  limit: number = 20
): Promise<MessageWithDetails[]> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // CRITICAL: Ordering query (Solution 1)
    const result = await client.query<MessageWithDetails>(`
      WITH deliverable AS (
        SELECT m.id
        FROM messages m
        WHERE m.status IN ('pending', 'failed')
          AND (m.status = 'pending' OR m.next_retry_at <= NOW())
          -- ORDERING CONSTRAINT: Only take message if no older message 
          -- with same ordering_key is currently being delivered
          AND (
            m.ordering_key_value IS NULL  -- No ordering needed
            OR NOT EXISTS (
              SELECT 1 FROM messages m2
              WHERE m2.subscriber_id = m.subscriber_id
                AND m2.ordering_key_value = m.ordering_key_value
                AND m2.status = 'delivering'
                AND m2.created_at < m.created_at
            )
          )
        ORDER BY 
          CASE WHEN m.ordering_key_value IS NULL THEN 0 ELSE 1 END,
          m.created_at ASC
        LIMIT $1
        FOR UPDATE OF m SKIP LOCKED
      )
      SELECT 
        m.id, m.event_id, m.subscriber_id, m.retry_count,
        m.ordering_key_value, m.status,
        e.event_type, e.version, e.payload,
        s.webhook_url, s.retry_limit, s.retry_backoff_seconds
      FROM deliverable d
      JOIN messages m ON d.id = m.id
      JOIN events e ON m.event_id = e.id
      JOIN subscribers s ON m.subscriber_id = s.id
    `, [limit]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return [];
    }
    
    // Lock messages atomically
    const messageIds = result.rows.map(r => r.id);
    
    await client.query(`
      UPDATE messages
      SET status = 'delivering',
          locked_by = $1,
          locked_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY($2)
    `, [workerId, messageIds]);
    
    await client.query('COMMIT');
    
    return result.rows;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

