// Health check and metrics endpoints
import { Router, Request, Response } from 'express';
import { pool } from '../../db/pool';
import { register } from '../../metrics';
import { HealthCheckResponse } from '../../types';

const router: Router = Router();

const startTime = Date.now();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');

    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: 'connected',
    };

    res.status(200).json(response);
  } catch (error) {
    const response: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      database: 'disconnected',
    };

    res.status(503).json(response);
  }
});

router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

export default router;
