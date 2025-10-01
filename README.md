# Event Hub System

A distributed event hub system for microservices architecture using TypeScript, Node.js, PostgreSQL, and Docker. Enables event-driven communication between services with guaranteed delivery, ordering, and retry mechanisms.

## Features

- ✅ **Event Ingestion API** - Fast event ingestion with <10ms response time
- ✅ **Guaranteed Delivery** - At-least-once and at-most-once delivery guarantees
- ✅ **Ordering Support** - FIFO ordering by organization_id or user_id
- ✅ **Automatic Retry** - Exponential backoff with configurable retry limits
- ✅ **Dead Letter Queue** - Failed messages moved to DLQ for manual review
- ✅ **Idempotency** - Duplicate prevention via idempotency keys
- ✅ **High Throughput** - Handles 200+ events/second with 2.5x fan-out
- ✅ **Monitoring** - Prometheus metrics and health checks
- ✅ **Type Safety** - Full TypeScript implementation with strict mode

## Architecture

```
Producer → API Server → PostgreSQL → Fan-out Worker → Dispatcher Workers → Consumer Webhooks
                            ↓
                    Dead Letter Queue (DLQ)
```

### Components

- **API Server** (2 replicas) - Receives events via REST API
- **Fan-out Worker** (1 replica) - Converts events to messages for subscribers
- **Dispatcher Workers** (4 replicas) - Delivers messages via webhooks
- **Cleanup Worker** (1 replica) - Recovers stale messages from crashed workers
- **PostgreSQL** - Event and message storage with optimized indexes

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- pnpm 8+ (package manager)

### Running with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The API will be available at `http://localhost:3000`.

### Local Development

```bash
# Install pnpm (if not already installed)
corepack enable
corepack prepare pnpm@8.15.0 --activate

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env

# Start PostgreSQL
docker-compose up -d postgres

# Run database migrations
psql -h localhost -U eventhub -d eventhub -f schema.sql

# Start API server
pnpm run dev:api

# Start workers (in separate terminals)
pnpm run dev:fanout
pnpm run dev:dispatcher
```

## API Reference

### POST /events

Create a new event.

**Request:**
```json
{
  "event_type": "user.created",
  "version": "v1",
  "payload": {
    "user_id": "123",
    "email": "user@example.com"
  },
  "organization_id": "org-456",
  "user_id": "user-123"
}
```

**Headers:**
- `X-Idempotency-Key` (optional) - Prevents duplicate event processing

**Response (202):**
```json
{
  "event_id": "uuid",
  "message": "Event accepted for processing",
  "latency_ms": 8
}
```

### GET /health

Health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected"
}
```

### GET /metrics

Prometheus metrics endpoint.

## Database Schema

The system uses PostgreSQL with the following main tables:

- **events** - Incoming events from producers
- **subscribers** - Registered consumers with delivery preferences
- **messages** - Delivery queue (1 per event-subscriber pair)
- **delivery_attempts** - Audit log of webhook calls
- **dead_letter_queue** - Failed messages for manual review

See `schema.sql` for complete schema definition.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_NAME` | Database name | eventhub |
| `DB_USER` | Database user | eventhub |
| `DB_PASSWORD` | Database password | changeme |
| `PORT` | API server port | 3000 |
| `POLL_INTERVAL_MS` | Worker poll interval | 100 |
| `BATCH_SIZE` | Messages per batch | 20 |
| `WEBHOOK_TIMEOUT_MS` | Webhook timeout | 10000 |

### Subscriber Configuration

Subscribers are registered directly in the database. Example:

```sql
INSERT INTO subscribers (
  id, name, event_type, webhook_url,
  delivery_guarantee, ordering_enabled, ordering_key,
  retry_limit, retry_backoff_seconds,
  is_active, created_by
) VALUES (
  gen_random_uuid(),
  'User Service',
  'user.created',
  'https://api.example.com/webhooks/user-created',
  'at_least_once',
  true,
  'organization_id',
  3,
  '{5, 30, 300}',
  true,
  'admin-user-id'
);
```

## Delivery Guarantees

### At-Least-Once

Messages are retried until successfully delivered or moved to DLQ. Consumers must implement idempotency using the `X-Message-Id` header.

### At-Most-Once

Messages are attempted once only. No retries on failure.

## Ordering

When `ordering_enabled = true`, messages with the same `ordering_key_value` are delivered in FIFO order. The system ensures:

- No two messages with same ordering key are delivered concurrently
- Older messages block newer ones until delivered
- Messages without ordering keys are delivered in parallel

## Retry Logic

Failed deliveries are retried with exponential backoff:

1. First retry: 5 seconds
2. Second retry: 30 seconds
3. Third retry: 300 seconds (5 minutes)

After exhausting retries, messages move to the Dead Letter Queue.

### Retry Conditions

- **Retry:** 429 (rate limit), 5xx (server error), network errors, timeouts
- **No Retry:** 4xx errors (except 429) → immediate DLQ

## Monitoring

### Prometheus Metrics

Access metrics at `http://localhost:3000/metrics`:

- `eventhub_events_received_total` - Total events received
- `eventhub_messages_delivered_total` - Total messages delivered
- `eventhub_delivery_latency_seconds` - Webhook delivery latency
- `eventhub_pending_messages` - Number of pending messages
- `eventhub_dlq_size` - Messages in Dead Letter Queue

### Prometheus UI

View metrics and graphs at `http://localhost:9090`.

## Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm run test:watch
```

## Troubleshooting

### High Latency

- Check `eventhub_delivery_latency_seconds` metric
- Verify webhook endpoints are responding quickly
- Consider increasing dispatcher worker replicas

### Messages Stuck in Pending

- Check dispatcher worker logs
- Verify ordering constraints aren't blocking delivery
- Check for stale messages in cleanup worker logs

### Database Connection Issues

- Verify PostgreSQL is running: `docker-compose ps postgres`
- Check connection pool settings in `src/db/pool.ts`
- Review database logs: `docker-compose logs postgres`

## Performance

### Target Metrics

- **Throughput:** 200 events/second
- **Latency:** <1 second end-to-end
- **Fan-out:** 2.5 subscribers per event (max 10)
- **API Response:** <10ms

### Optimization Tips

1. **Database Indexes** - Ensure all indexes are created (see `schema.sql`)
2. **Connection Pooling** - Tune `DB_MAX_CONNECTIONS` per service
3. **Worker Scaling** - Increase dispatcher replicas for higher throughput
4. **Batch Size** - Adjust `BATCH_SIZE` for optimal performance

## License

MIT

## Support

For issues and questions, please open a GitHub issue.

