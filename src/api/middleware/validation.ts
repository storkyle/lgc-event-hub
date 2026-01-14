// Request validation middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function validateEventPayload(req: Request, _res: Response, next: NextFunction): void {
  const { event_type, payload } = req.body;

  if (!event_type || typeof event_type !== 'string') {
    throw new AppError(400, 'event_type is required and must be a string');
  }

  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'payload is required and must be an object');
  }

  next();
}

export function validateRetryRequest(req: Request, _res: Response, next: NextFunction): void {
  const { retry_by } = req.body;

  if (!retry_by || typeof retry_by !== 'string') {
    throw new AppError(400, 'retry_by is required and must be a string (user ID)');
  }

  // Validate UUID format for retry_by
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(retry_by)) {
    throw new AppError(400, 'retry_by must be a valid UUID');
  }

  next();
}

export function validateCreateSubscriber(req: Request, _res: Response, next: NextFunction): void {
  const {
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
  } = req.body;

  // Required fields
  if (!name || typeof name !== 'string') {
    throw new AppError(400, 'name is required and must be a string');
  }

  if (!event_type || typeof event_type !== 'string') {
    throw new AppError(400, 'event_type is required and must be a string');
  }

  if (!webhook_url || typeof webhook_url !== 'string') {
    throw new AppError(400, 'webhook_url is required and must be a string');
  }

  if (!created_by || typeof created_by !== 'string') {
    throw new AppError(400, 'created_by is required and must be a string');
  }

  // Validate UUID format for created_by
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(created_by)) {
    throw new AppError(400, 'created_by must be a valid UUID');
  }

  // Validate webhook URL format
  try {
    new URL(webhook_url);
  } catch {
    throw new AppError(400, 'webhook_url must be a valid URL');
  }

  // Optional field validations
  if (delivery_guarantee !== undefined) {
    if (!['at_least_once', 'at_most_once'].includes(delivery_guarantee)) {
      throw new AppError(400, "delivery_guarantee must be 'at_least_once' or 'at_most_once'");
    }
  }

  if (ordering_enabled !== undefined) {
    if (typeof ordering_enabled !== 'boolean') {
      throw new AppError(400, 'ordering_enabled must be a boolean');
    }
  }

  if (ordering_key !== undefined && ordering_key !== null) {
    if (!['organization_id', 'user_id'].includes(ordering_key)) {
      throw new AppError(400, "ordering_key must be 'organization_id', 'user_id', or null");
    }
  }

  if (retry_limit !== undefined) {
    if (typeof retry_limit !== 'number' || retry_limit < 0 || retry_limit > 10) {
      throw new AppError(400, 'retry_limit must be a number between 0 and 10');
    }
  }

  if (retry_backoff_seconds !== undefined) {
    if (!Array.isArray(retry_backoff_seconds)) {
      throw new AppError(400, 'retry_backoff_seconds must be an array');
    }
    if (retry_backoff_seconds.some((val) => typeof val !== 'number' || val < 0 || val > 3600)) {
      throw new AppError(
        400,
        'retry_backoff_seconds must be an array of numbers between 0 and 3600'
      );
    }
  }

  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') {
      throw new AppError(400, 'is_active must be a boolean');
    }
  }

  next();
}

export function validateUpdateSubscriber(req: Request, _res: Response, next: NextFunction): void {
  const {
    name,
    event_type,
    webhook_url,
    delivery_guarantee,
    ordering_enabled,
    ordering_key,
    retry_limit,
    retry_backoff_seconds,
    is_active,
  } = req.body;

  // Validate provided fields
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError(400, 'name must be a non-empty string');
    }
  }

  if (event_type !== undefined) {
    if (typeof event_type !== 'string' || event_type.trim().length === 0) {
      throw new AppError(400, 'event_type must be a non-empty string');
    }
  }

  if (webhook_url !== undefined) {
    if (typeof webhook_url !== 'string') {
      throw new AppError(400, 'webhook_url must be a string');
    }
    try {
      new URL(webhook_url);
    } catch {
      throw new AppError(400, 'webhook_url must be a valid URL');
    }
  }

  if (delivery_guarantee !== undefined) {
    if (!['at_least_once', 'at_most_once'].includes(delivery_guarantee)) {
      throw new AppError(400, "delivery_guarantee must be 'at_least_once' or 'at_most_once'");
    }
  }

  if (ordering_enabled !== undefined) {
    if (typeof ordering_enabled !== 'boolean') {
      throw new AppError(400, 'ordering_enabled must be a boolean');
    }
  }

  if (ordering_key !== undefined && ordering_key !== null) {
    if (!['organization_id', 'user_id'].includes(ordering_key)) {
      throw new AppError(400, "ordering_key must be 'organization_id', 'user_id', or null");
    }
  }

  if (retry_limit !== undefined) {
    if (typeof retry_limit !== 'number' || retry_limit < 0 || retry_limit > 10) {
      throw new AppError(400, 'retry_limit must be a number between 0 and 10');
    }
  }

  if (retry_backoff_seconds !== undefined) {
    if (!Array.isArray(retry_backoff_seconds)) {
      throw new AppError(400, 'retry_backoff_seconds must be an array');
    }
    if (retry_backoff_seconds.some((val) => typeof val !== 'number' || val < 0 || val > 3600)) {
      throw new AppError(
        400,
        'retry_backoff_seconds must be an array of numbers between 0 and 3600'
      );
    }
  }

  if (is_active !== undefined) {
    if (typeof is_active !== 'boolean') {
      throw new AppError(400, 'is_active must be a boolean');
    }
  }

  next();
}
