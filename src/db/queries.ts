// Database queries for workers
import { pool } from './pool';
import { Event, Subscriber } from '../types';

// Fan-out worker queries
export async function getPendingEvents(limit: number): Promise<Event[]> {
  const result = await pool.query<Event>(
    `SELECT * FROM events
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit]
  );
  return result.rows;
}

export async function getActiveSubscribers(eventType: string): Promise<Subscriber[]> {
  const result = await pool.query<Subscriber>(
    `SELECT * FROM subscribers
     WHERE event_type = $1 AND is_active = true`,
    [eventType]
  );
  return result.rows;
}

export async function updateEventStatus(eventId: string, status: string): Promise<void> {
  await pool.query('UPDATE events SET status = $1, updated_at = NOW() WHERE id = $2', [
    status,
    eventId,
  ]);
}

// Check if all messages for an event are delivered
export async function checkEventCompleted(eventId: string): Promise<boolean> {
  const result = await pool.query<{ all_delivered: boolean }>(
    `SELECT NOT EXISTS (
      SELECT 1 FROM messages
      WHERE event_id = $1 AND status != 'delivered'
    ) as all_delivered`,
    [eventId]
  );
  return result.rows[0]?.all_delivered || false;
}
