// Request validation middleware
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function validateEventPayload(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { event_type, payload } = req.body;

  if (!event_type || typeof event_type !== 'string') {
    throw new AppError(400, 'event_type is required and must be a string');
  }

  if (!payload || typeof payload !== 'object') {
    throw new AppError(400, 'payload is required and must be an object');
  }

  next();
}

