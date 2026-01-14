// Subscriber CRUD endpoints
import { Router, Request, Response } from 'express';
import { pool } from '../../db/pool';
import {
  Subscriber,
  ApiResponse,
  CreateSubscriberDto,
  UpdateSubscriberDto,
  SubscriberCreatedResponse,
  SubscriberUpdatedResponse,
  SubscriberDeletedResponse,
} from '../../types';
import { logger } from '../../utils/logger';
import { validateCreateSubscriber, validateUpdateSubscriber } from '../middleware/validation';
import { v4 as uuidv4 } from 'uuid';

const router: Router = Router();

// Get all subscribers
router.get('/subscribers', async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, event_type, is_active } = req.query;

    let query = `
      SELECT
        id,
        name,
        event_type,
        webhook_url,
        delivery_guarantee,
        ordering_enabled,
        ordering_key,
        retry_limit,
        retry_backoff_seconds,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM subscribers
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (event_type) {
      paramCount++;
      query += ` AND event_type = $${paramCount}`;
      params.push(event_type);
    }

    if (is_active !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query<Subscriber>(query, params);

    const response: ApiResponse<Subscriber[]> = {
      success: true,
      data: result.rows,
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error fetching subscribers', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch subscribers',
    };

    res.status(500).json(response);
    return;
  }
});

// Get specific subscriber by ID
router.get('/subscribers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query<Subscriber>(
      `
      SELECT
        id,
        name,
        event_type,
        webhook_url,
        delivery_guarantee,
        ordering_enabled,
        ordering_key,
        retry_limit,
        retry_backoff_seconds,
        is_active,
        created_by,
        created_at,
        updated_at
      FROM subscribers
      WHERE id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscriber not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<Subscriber> = {
      success: true,
      data: result.rows[0],
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error fetching subscriber', {
      subscriber_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

// Create new subscriber
router.post('/subscribers', validateCreateSubscriber, async (req: Request, res: Response) => {
  try {
    const {
      name,
      event_type,
      webhook_url,
      delivery_guarantee = 'at_least_once',
      ordering_enabled = false,
      ordering_key = null,
      retry_limit = 3,
      retry_backoff_seconds = [5, 30, 300],
      is_active = true,
      created_by,
    }: CreateSubscriberDto = req.body;

    const subscriberId = uuidv4();

    await pool.query(
      `
        INSERT INTO subscribers (
          id, name, event_type, webhook_url, delivery_guarantee,
          ordering_enabled, ordering_key, retry_limit, retry_backoff_seconds,
          is_active, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id
      `,
      [
        subscriberId,
        name,
        event_type,
        webhook_url,
        delivery_guarantee,
        ordering_enabled,
        ordering_key,
        retry_limit,
        retry_backoff_seconds,
        is_active,
        created_by,
      ]
    );

    logger.info('Subscriber created', {
      subscriber_id: subscriberId,
      name,
      event_type,
      webhook_url,
      created_by,
    });

    const response: ApiResponse<SubscriberCreatedResponse> = {
      success: true,
      message: 'Subscriber created successfully',
      data: {
        subscriber_id: subscriberId,
        message: 'Subscriber created successfully',
      },
    };

    res.status(201).json(response);
    return;
  } catch (error) {
    logger.error('Error creating subscriber', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to create subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

// Update subscriber
router.put('/subscribers/:id', validateUpdateSubscriber, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: UpdateSubscriberDto = req.body;

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        params.push(value);
      }
    });

    if (updateFields.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'No fields to update',
      };
      return res.status(400).json(response);
    }

    // Add updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    params.push(new Date());

    // Add id parameter
    paramCount++;
    params.push(id);

    const result = await pool.query(
      `
        UPDATE subscribers
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id
      `,
      params
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscriber not found',
      };
      return res.status(404).json(response);
    }

    logger.info('Subscriber updated', {
      subscriber_id: id,
      updated_fields: Object.keys(updateData),
    });

    const response: ApiResponse<SubscriberUpdatedResponse> = {
      success: true,
      message: 'Subscriber updated successfully',
      data: {
        subscriber_id: id,
        message: 'Subscriber updated successfully',
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error updating subscriber', {
      subscriber_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to update subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

// Delete subscriber (soft delete by setting is_active = false)
router.delete('/subscribers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE subscribers
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscriber not found or already inactive',
      };
      return res.status(404).json(response);
    }

    logger.info('Subscriber deactivated', {
      subscriber_id: id,
    });

    const response: ApiResponse<SubscriberDeletedResponse> = {
      success: true,
      message: 'Subscriber deactivated successfully',
      data: {
        subscriber_id: id,
        message: 'Subscriber deactivated successfully',
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error deactivating subscriber', {
      subscriber_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to deactivate subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

// Hard delete subscriber (permanent removal)
router.delete('/subscribers/:id/hard', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if subscriber has any messages
    const messageCheck = await pool.query(
      `
      SELECT COUNT(*) as message_count
      FROM messages
      WHERE subscriber_id = $1
    `,
      [id]
    );

    const messageCount = parseInt(messageCheck.rows[0].message_count);
    if (messageCount > 0) {
      const response: ApiResponse = {
        success: false,
        error: `Cannot delete subscriber with ${messageCount} associated messages. Deactivate instead.`,
      };
      return res.status(409).json(response);
    }

    const result = await pool.query(
      `
      DELETE FROM subscribers
      WHERE id = $1
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscriber not found',
      };
      return res.status(404).json(response);
    }

    logger.warn('Subscriber permanently deleted', {
      subscriber_id: id,
    });

    const response: ApiResponse<SubscriberDeletedResponse> = {
      success: true,
      message: 'Subscriber permanently deleted',
      data: {
        subscriber_id: id,
        message: 'Subscriber permanently deleted',
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error permanently deleting subscriber', {
      subscriber_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to permanently delete subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

// Reactivate subscriber
router.post('/subscribers/:id/reactivate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE subscribers
      SET is_active = true, updated_at = NOW()
      WHERE id = $1 AND is_active = false
      RETURNING id
    `,
      [id]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: 'Subscriber not found or already active',
      };
      return res.status(404).json(response);
    }

    logger.info('Subscriber reactivated', {
      subscriber_id: id,
    });

    const response: ApiResponse<SubscriberUpdatedResponse> = {
      success: true,
      message: 'Subscriber reactivated successfully',
      data: {
        subscriber_id: id,
        message: 'Subscriber reactivated successfully',
      },
    };

    res.status(200).json(response);
    return;
  } catch (error) {
    logger.error('Error reactivating subscriber', {
      subscriber_id: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const response: ApiResponse = {
      success: false,
      error: 'Failed to reactivate subscriber',
    };

    res.status(500).json(response);
    return;
  }
});

export default router;
