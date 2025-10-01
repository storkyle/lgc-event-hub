// Integration tests for API endpoints
import request from 'supertest';
import express, { Express } from 'express';
import eventsRouter from '../../src/api/routes/events';
import healthRouter from '../../src/api/routes/health';
import { errorHandler } from '../../src/api/middleware/errorHandler';

// Mock database pool
jest.mock('../../src/db/pool', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../src/db/pool';

describe('API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', eventsRouter);
    app.use('/', healthRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /events', () => {
    it('should create event and return 202', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Idempotency check
        .mockResolvedValueOnce({ rows: [{ id: 'test-uuid' }] }); // Insert

      const response = await request(app)
        .post('/events')
        .send({
          event_type: 'user.created',
          payload: { user_id: '123' },
        });

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('event_id');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Event accepted for processing');
    });

    it('should return 200 for duplicate idempotency key', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'existing-uuid' }],
      });

      const response = await request(app)
        .post('/events')
        .set('X-Idempotency-Key', 'test-key')
        .send({
          event_type: 'user.created',
          payload: { user_id: '123' },
        });

      expect(response.status).toBe(200);
      expect(response.body.event_id).toBe('existing-uuid');
      expect(response.body.message).toBe('Event already exists');
    });

    it('should return 400 for missing event_type', async () => {
      const response = await request(app)
        .post('/events')
        .send({
          payload: { user_id: '123' },
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for missing payload', async () => {
      const response = await request(app)
        .post('/events')
        .send({
          event_type: 'user.created',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should accept optional organization_id and user_id', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'test-uuid' }] });

      const response = await request(app)
        .post('/events')
        .send({
          event_type: 'user.created',
          payload: { user_id: '123' },
          organization_id: 'org-456',
          user_id: 'user-789',
        });

      expect(response.status).toBe(202);
    });
  });

  describe('GET /health', () => {
    it('should return healthy status when database is connected', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ now: new Date() }] });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return unhealthy status when database fails', async () => {
      (pool.query as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.database).toBe('disconnected');
    });
  });
});

