// Dead Letter Queue management endpoints
import { Router, Request, Response } from 'express';
import { pool } from '../../db/pool';
import { DeadLetterQueueItem, ApiResponse } from '../../types';
import { logger } from '../../utils/logger';
import { validateRetryRequest } from '../middleware/validation';

const router: Router = Router();

// Get all DLQ items
router.get('/dlq', async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query<DeadLetterQueueItem>(
      `
      SELECT
        dlq.id,
        dlq.message_id,
        dlq.event_snapshot,
        dlq.subscriber_snapshot,
        dlq.failure_reason,
        dlq.moved_to_dlq_at,
        dlq.manual_retry_by,
        dlq.manual_retry_at
      FROM dead_letter_queue dlq
      ORDER BY dlq.moved_to_dlq_at DESC
      LIMIT $1 OFFSET $2
    `,
      [parseInt(limit as string), parseInt(offset as string)]
    );

    const response: ApiResponse<DeadLetterQueueItem[]> = {
      success: true,
      data: result.rows,
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('Error fetching DLQ items', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch DLQ items',
    };

    res.status(500).json(response);
  }
});

// Get specific DLQ item by ID
router.get('/dlq/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query<DeadLetterQueueItem>(
      `
      SELECT
        dlq.id,
        dlq.message_id,
        dlq.event_snapshot,
        dlq.subscriber_snapshot,
        dlq.failure_reason,
        dlq.moved_to_dlq_at,
        dlq.manual_retry_by,
        dlq.manual_retry_at
      FROM dead_letter_queue dlq
      WHERE dlq.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'DLQ item not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<DeadLetterQueueItem> = {
      success: true,
      data: result.rows[0],
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error fetching DLQ item', {
      dlq_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch DLQ item',
    };

    res.status(500).json(response);
    return;
  }
});

// Manual retry DLQ item
router.post('/dlq/:id/retry', validateRetryRequest, async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { retry_by } = req.body; // User ID who initiated the retry

    await client.query('BEGIN');

    // Get DLQ item
    const dlqResult = await client.query<DeadLetterQueueItem>(
      `
      SELECT
        dlq.id,
        dlq.message_id,
        dlq.event_snapshot,
        dlq.subscriber_snapshot,
        dlq.failure_reason
      FROM dead_letter_queue dlq
      WHERE dlq.id = $1
      FOR UPDATE
    `,
      [id]
    );

    if (dlqResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const response: ApiResponse = {
        success: false,
        error: 'DLQ item not found',
      };
      return res.status(404).json(response);
    }

    const dlqItem = dlqResult.rows[0];

    // Check if already retried
    if (dlqItem.manual_retry_by) {
      await client.query('ROLLBACK');
      const response: ApiResponse = {
        success: false,
        error: 'DLQ item has already been manually retried',
      };
      return res.status(409).json(response);
    }

    // Check if message still exists and is in DLQ status
    const messageResult = await client.query(
      `
      SELECT id, status FROM messages
      WHERE id = $1 AND status = 'dlq'
      FOR UPDATE
    `,
      [dlqItem.message_id]
    );

    if (messageResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const response: ApiResponse = {
        success: false,
        error: 'Message not found or not in DLQ status',
      };
      return res.status(404).json(response);
    }

    // Reset message for retry
    await client.query(
      `
      UPDATE messages
      SET
        status = 'pending',
        retry_count = 0,
        next_retry_at = NULL,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      WHERE id = $1
    `,
      [dlqItem.message_id]
    );

    // Update DLQ item with retry info
    await client.query(
      `
      UPDATE dead_letter_queue
      SET
        manual_retry_by = $1,
        manual_retry_at = NOW()
      WHERE id = $2
    `,
      [retry_by, id]
    );

    await client.query('COMMIT');

    logger.info('DLQ item manually retried', {
      dlq_id: id,
      message_id: dlqItem.message_id,
      retry_by,
    });

    const response: ApiResponse = {
      success: true,
      message: 'DLQ item successfully queued for retry',
      data: {
        dlq_id: id,
        message_id: dlqItem.message_id,
        retry_by,
        retry_at: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Error retrying DLQ item', {
      dlq_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to retry DLQ item',
    };

    res.status(500).json(response);
    return;
  } finally {
    client.release();
  }
});

// Bulk retry multiple DLQ items
router.post('/dlq/bulk-retry', validateRetryRequest, async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { dlq_ids, retry_by } = req.body;

    if (!Array.isArray(dlq_ids) || dlq_ids.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'dlq_ids must be a non-empty array',
      };

      return res.status(400).json(response);
    }

    await client.query('BEGIN');

    const results = [];
    const errors = [];

    for (const dlqId of dlq_ids) {
      try {
        // Get DLQ item
        const dlqResult = await client.query<DeadLetterQueueItem>(
          `
          SELECT
            dlq.id,
            dlq.message_id,
            dlq.event_snapshot,
            dlq.subscriber_snapshot,
            dlq.failure_reason,
            dlq.manual_retry_by
          FROM dead_letter_queue dlq
          WHERE dlq.id = $1
          FOR UPDATE
        `,
          [dlqId]
        );

        if (dlqResult.rows.length === 0) {
          errors.push({ dlq_id: dlqId, error: 'DLQ item not found' });
          continue;
        }

        const dlqItem = dlqResult.rows[0];

        // Check if already retried
        if (dlqItem.manual_retry_by) {
          errors.push({ dlq_id: dlqId, error: 'Already manually retried' });
          continue;
        }

        // Check if message still exists and is in DLQ status
        const messageResult = await client.query(
          `
          SELECT id, status FROM messages
          WHERE id = $1 AND status = 'dlq'
          FOR UPDATE
        `,
          [dlqItem.message_id]
        );

        if (messageResult.rows.length === 0) {
          errors.push({
            dlq_id: dlqId,
            error: 'Message not found or not in DLQ status',
          });
          continue;
        }

        // Reset message for retry
        await client.query(
          `
          UPDATE messages
          SET
            status = 'pending',
            retry_count = 0,
            next_retry_at = NULL,
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
          WHERE id = $1
        `,
          [dlqItem.message_id]
        );

        // Update DLQ item with retry info
        await client.query(
          `
          UPDATE dead_letter_queue
          SET
            manual_retry_by = $1,
            manual_retry_at = NOW()
          WHERE id = $2
        `,
          [retry_by, dlqId]
        );

        results.push({
          dlq_id: dlqId,
          message_id: dlqItem.message_id,
          success: true,
        });
      } catch (error) {
        errors.push({
          dlq_id: dlqId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return;
      }
    }

    await client.query('COMMIT');

    logger.info('Bulk DLQ retry completed', {
      total_requested: dlq_ids.length,
      successful: results.length,
      failed: errors.length,
      retry_by,
    });

    const response: ApiResponse = {
      success: true,
      message: `Bulk retry completed: ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total_requested: dlq_ids.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    await client.query('ROLLBACK');

    logger.error('Error in bulk DLQ retry', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to perform bulk retry',
    };

    res.status(500).json(response);
    return;
  } finally {
    client.release();
  }
});

export default router;
