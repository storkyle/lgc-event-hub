// Event ingestion endpoint
import { Router, Request, Response } from 'express';
import { pool } from '../../db/pool';
import { v4 as uuidv4 } from 'uuid';
import { eventsReceived, apiRequestDuration } from '../../metrics';
import { CreateEventDto, Event, EventCreatedResponse } from '../../types';
import { validateEventPayload } from '../middleware/validation';
import { logger } from '../../utils/logger';

const router: Router = Router();

router.post('/events', validateEventPayload, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { 
      event_type, 
      version = 'v1', 
      payload, 
      organization_id, 
      user_id 
    }: CreateEventDto = req.body;
    
    // Idempotency check
    const idempotencyKey = req.header('x-idempotency-key') as string | undefined;
    
    if (idempotencyKey) {
      const existing = await pool.query<Event>(
        'SELECT id FROM events WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      
      if (existing.rows.length > 0) {
        logger.info('Duplicate event detected', {
          idempotency_key: idempotencyKey,
          event_id: existing.rows[0].id,
        });

        const response: EventCreatedResponse = {
          event_id: existing.rows[0].id,
          message: 'Event already exists',
          latency_ms: Date.now() - startTime,
        };

        res.status(200).json(response);
        return;
      }
    }
    
    // Insert event
    const eventId = uuidv4();
    await pool.query(`
      INSERT INTO events (
        id, event_type, version, payload,
        organization_id, user_id,
        status, idempotency_key, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW())
    `, [
      eventId,
      event_type,
      version,
      JSON.stringify(payload),
      organization_id || null,
      user_id || null,
      idempotencyKey || null,
    ]);
    
    // Metrics
    eventsReceived.inc({ event_type });
    
    const latency = Date.now() - startTime;
    apiRequestDuration.observe(
      { method: 'POST', route: '/events', status_code: '202' },
      latency / 1000
    );

    logger.info('Event received', {
      event_id: eventId,
      event_type,
      latency_ms: latency,
    });
    
    // Return immediately
    const response: EventCreatedResponse = {
      event_id: eventId,
      message: 'Event accepted for processing',
      latency_ms: latency,
    };

    res.status(202).json(response);
    
  } catch (error) {
    logger.error('Error receiving event', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    const latency = Date.now() - startTime;
    apiRequestDuration.observe(
      { method: 'POST', route: '/events', status_code: '500' },
      latency / 1000
    );
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

