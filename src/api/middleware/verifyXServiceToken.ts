import { NextFunction, Request, Response } from 'express';

/**
 * Middleware: Verify X Service Token
 * @param req
 * @param res
 * @param next
 * @returns
 */
export const verifyXServiceToken = (req: Request, res: Response, next: NextFunction) => {
  const { 'x-service-token': xServiceToken } = req.headers;

  if (xServiceToken && xServiceToken === process.env.X_SERVICE_TOKEN) {
    return next();
  }

  res.status(403).json({ error: 'Forbidden' });
  return;
};
