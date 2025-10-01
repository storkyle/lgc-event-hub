// Prometheus metrics configuration
import promClient from 'prom-client';
import { pool } from '../db/pool';

// Enable default metrics (CPU, memory, event loop, etc.)
promClient.collectDefaultMetrics();

// Custom metrics
export const eventsReceived = new promClient.Counter({
  name: 'eventhub_events_received_total',
  help: 'Total events received',
  labelNames: ['event_type'],
});

export const messagesDelivered = new promClient.Counter({
  name: 'eventhub_messages_delivered_total',
  help: 'Total messages delivered',
  labelNames: ['subscriber_id', 'status'],
});

export const deliveryLatency = new promClient.Histogram({
  name: 'eventhub_delivery_latency_seconds',
  help: 'Webhook delivery latency in seconds',
  labelNames: ['subscriber_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

export const pendingMessages = new promClient.Gauge({
  name: 'eventhub_pending_messages',
  help: 'Number of pending messages',
  labelNames: ['subscriber_id'],
  async collect() {
    try {
      const result = await pool.query<{ subscriber_id: string; count: string }>(`
        SELECT subscriber_id, COUNT(*) as count
        FROM messages
        WHERE status IN ('pending', 'failed')
        GROUP BY subscriber_id
      `);
      
      this.reset();
      result.rows.forEach(row => {
        this.set({ subscriber_id: row.subscriber_id }, parseInt(row.count));
      });
    } catch (error) {
      // Ignore metric collection errors
    }
  },
});

export const dlqSize = new promClient.Gauge({
  name: 'eventhub_dlq_size',
  help: 'Number of messages in DLQ',
  async collect() {
    try {
      const result = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM dead_letter_queue');
      this.set(parseInt(result.rows[0].count));
    } catch (error) {
      // Ignore metric collection errors
    }
  },
});

export const apiRequestDuration = new promClient.Histogram({
  name: 'eventhub_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const register = promClient.register;

