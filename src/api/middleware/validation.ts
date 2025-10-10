// Request validation middleware
import { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

export function validateEventPayload(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { event_type, payload } = req.body;

  if (!event_type || typeof event_type !== "string") {
    throw new AppError(400, "event_type is required and must be a string");
  }

  if (!payload || typeof payload !== "object") {
    throw new AppError(400, "payload is required and must be an object");
  }

  next();
}

export function validateRetryRequest(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { retry_by } = req.body;

  if (!retry_by || typeof retry_by !== "string") {
    throw new AppError(
      400,
      "retry_by is required and must be a string (user ID)"
    );
  }

  // Validate UUID format for retry_by
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(retry_by)) {
    throw new AppError(400, "retry_by must be a valid UUID");
  }

  next();
}
