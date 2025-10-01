# Event Hub Architecture

This document provides a deep dive into the Event Hub system architecture.

## System Overview

The Event Hub is a distributed message delivery system that ensures reliable webhook delivery with ordering guarantees and automatic retry logic.

```
┌─────────────┐
│  Producers  │  (External services sending events)
└──────┬──────┘
       │ POST /events
       ↓
┌──────────────────┐
│  API Server      │  (2 replicas)
│  - Validate      │
│  - Store event   │
│  - Return 202    │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  PostgreSQL      │  (4 vCPU, 8GB RAM)
│  - events        │  - Stores all state
│  - messages      │  - Provides ACID guarantees
│  - subscribers   │  - Handles concurrency via locks
│  - dlq           │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Fan-out Worker  │  (1 replica)
│  - Polls events  │
│  - Creates msgs  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│  Dispatcher      │  (4 replicas)
│  Workers         │
│  - Poll msgs     │
│  - Send webhooks │
│  - Handle retry  │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│   Consumers      │  (External services receiving webhooks)
│   (webhooks)     │
└──────────────────┘
```

## Data Flow

### 1. Event Ingestion (API Server)

```typescript
POST /events → Validate → INSERT events → Return 202
```

**Timing:** ~10ms (target)

**Key Points:**
- Fast response (non-blocking)
- Idempotency via `X-Idempotency-Key` header
- Validation ensures event_type and payload exist
- Returns immediately after database insert

### 2. Fan-out (Fan-out Worker)

```sql
-- Poll pending events
SELECT * FROM events WHERE status='pending' FOR UPDATE SKIP LOCKED

-- Find subscribers
SELECT * FROM subscribers WHERE event_type=? AND is_active=true

-- Create messages (1 per subscriber)
INSERT INTO messages (event_id, subscriber_id, ordering_key_value, ...)

-- Update event
UPDATE events SET status='processing'
```

**Timing:** 100ms poll interval, 50 events per batch

**Key Points:**
- Single worker (no need for multiple)
- Uses `FOR UPDATE SKIP LOCKED` to prevent duplicate processing
- Extracts ordering_key_value from event based on subscriber config
- Handles case where no subscribers exist (marks event as completed)

### 3. Delivery (Dispatcher Workers)

```typescript
// 1. Poll with ordering constraint
const messages = await pollMessagesWithOrdering(workerId, batchSize);

// 2. Deliver webhooks in parallel
await Promise.all(messages.map(async (msg) => {
  const result = await deliverWebhook(msg);
  await handleDeliveryResponse(msg, result);
}));
```

**Timing:** 100ms poll interval, 20 messages per batch

**Key Points:**
- Multiple workers for concurrency (4 replicas)
- CRITICAL: Ordering constraint in query ensures FIFO
- Parallel delivery of independent messages
- Retry with exponential backoff
- Move to DLQ after exhausting retries

### 4. Cleanup (Cleanup Worker)

```sql
-- Find stale messages (worker crash recovery)
UPDATE messages
SET status='failed', next_retry_at=NOW()
WHERE status='delivering' AND locked_at < NOW() - 60s
```

**Timing:** 60 second check interval

**Key Points:**
- Single worker
- Recovers messages from crashed workers
- Logs warnings for alerting
- Messages are retried normally after recovery

## Critical Components

### Ordering Query

This is the **most important** query in the system. It ensures FIFO delivery for messages with the same ordering key.

```sql
WITH deliverable AS (
  SELECT m.id
  FROM messages m
  WHERE m.status IN ('pending', 'failed')
    AND (m.status = 'pending' OR m.next_retry_at <= NOW())
    -- ORDERING CONSTRAINT
    AND (
      m.ordering_key_value IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM messages m2
        WHERE m2.subscriber_id = m.subscriber_id
          AND m2.ordering_key_value = m.ordering_key_value
          AND m2.status = 'delivering'
          AND m2.created_at < m.created_at
      )
    )
  ORDER BY 
    CASE WHEN m.ordering_key_value IS NULL THEN 0 ELSE 1 END,
    m.created_at ASC
  LIMIT 20
  FOR UPDATE OF m SKIP LOCKED
)
SELECT m.*, e.*, s.*
FROM deliverable d
JOIN messages m ON d.id = m.id
JOIN events e ON m.event_id = e.id
JOIN subscribers s ON m.subscriber_id = s.id
```

**How It Works:**

1. **Status Filter:** Only pending or failed (ready to retry) messages
2. **Retry Check:** Failed messages must be past their retry time
3. **Ordering Constraint:** Skip message if older message with same key is being delivered
4. **Prioritization:** Non-ordered messages first (higher throughput)
5. **Locking:** `FOR UPDATE SKIP LOCKED` prevents duplicates across workers

### Indexes

Critical indexes for performance:

```sql
-- For ordering constraint check
CREATE INDEX idx_messages_ordering_pending ON messages(
  subscriber_id, ordering_key_value, status, created_at
) WHERE ordering_key_value IS NOT NULL;

-- For non-ordered messages
CREATE INDEX idx_messages_no_ordering ON messages(
  status, created_at
) WHERE ordering_key_value IS NULL;

-- For retry scheduling
CREATE INDEX idx_messages_retry ON messages(
  status, next_retry_at
) WHERE status = 'failed';
```

## Concurrency & Locking

### Database Locks

The system uses PostgreSQL row-level locks to prevent duplicates:

```sql
FOR UPDATE SKIP LOCKED
```

**Benefits:**
- Workers skip locked rows instead of waiting
- No contention between workers
- Automatic unlock on transaction commit/rollback

### State Transitions

Messages follow strict state transitions:

```
pending → delivering → delivered ✓
        ↓
      failed → (retry) → delivering → delivered ✓
        ↓
      dlq (final)
```

### Worker Coordination

Workers coordinate through database state:

- **No shared memory** - all state in PostgreSQL
- **No message queue** - polling with locks
- **No leader election** - all workers equal
- **Crash recovery** - cleanup worker handles stale locks

## Retry Logic

### Exponential Backoff

Default retry schedule (configurable per subscriber):

```typescript
retry_backoff_seconds = [5, 30, 300]
// Attempt 1: immediate
// Attempt 2: +5s
// Attempt 3: +30s
// Attempt 4: +300s (5min)
// Attempt 5: DLQ
```

### Retry Decision Matrix

| Status Code | Action | Reason |
|-------------|--------|--------|
| 2xx | Delivered | Success |
| 400-428 | DLQ | Client error (non-retryable) |
| 429 | Retry | Rate limit (temporary) |
| 430-499 | DLQ | Client error (non-retryable) |
| 5xx | Retry | Server error (temporary) |
| Timeout | Retry | Network issue (temporary) |
| Network | Retry | Connection issue (temporary) |

## Dead Letter Queue

Messages move to DLQ when:

1. **Retries exhausted** - After N failed attempts
2. **Non-retryable error** - 4xx errors (except 429)
3. **Manual move** - Admin intervention

### DLQ Schema

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL,
  event_snapshot JSONB,      -- Full event data
  subscriber_snapshot JSONB,  -- Subscriber config at time
  failure_reason TEXT,
  moved_to_dlq_at TIMESTAMP,
  manual_retry_by UUID,
  manual_retry_at TIMESTAMP
);
```

## Scalability

### Current Capacity

- **API Server:** 2 replicas × 1 vCPU = 2 vCPU total
- **Dispatcher:** 4 replicas × 1 vCPU = 4 vCPU total
- **Database:** 4 vCPU, 8GB RAM

**Throughput:** 200 events/second with 2.5x fan-out = 500 webhooks/second

### Scaling Strategies

**Horizontal:**
- Increase dispatcher replicas for more concurrency
- Add API server replicas for higher ingestion rate

**Vertical:**
- Increase database resources for larger workloads
- Tune connection pool sizes

**Optimization:**
- Batch webhook calls (future enhancement)
- Connection pooling (already implemented)
- Index optimization (already tuned)

## Monitoring

### Key Metrics

```
eventhub_events_received_total      # Event ingestion rate
eventhub_messages_delivered_total   # Delivery success/failure
eventhub_delivery_latency_seconds   # Webhook response time
eventhub_pending_messages           # Queue depth
eventhub_dlq_size                   # Failed messages
```

### Alerting

Recommended alerts:

- **High pending messages** (>1000) - Delivery backlog
- **High DLQ size** (>100) - Systematic failures
- **Slow delivery** (p99 > 5s) - Webhook timeouts
- **Stale messages** - Worker crashes

## Failure Modes

### Worker Crash

**Symptom:** Messages stuck in "delivering" state

**Recovery:** Cleanup worker resets to "failed" after 60s

**Impact:** 60s delay for affected messages

### Database Outage

**Symptom:** All operations fail

**Recovery:** Workers retry connections, auto-reconnect when DB returns

**Impact:** Full system downtime during outage

### Consumer Down

**Symptom:** Webhooks fail with 5xx or timeout

**Recovery:** Automatic retry with backoff, eventually DLQ

**Impact:** Delayed delivery, manual intervention needed for DLQ

### Network Partition

**Symptom:** Workers can't reach consumers

**Recovery:** Retry with backoff, treat as temporary failure

**Impact:** Delayed delivery, messages queue up

## Performance Tuning

### Database

```sql
-- Connection pool
max = 20 per instance

-- Query timeout
statement_timeout = 10000

-- PostgreSQL settings
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
max_connections = 150
```

### HTTP Client

```typescript
// Undici Agent
connections: 50          // Per origin
keepAliveTimeout: 30000  // 30s
```

### Worker Settings

```
POLL_INTERVAL_MS=100    # Poll frequency
BATCH_SIZE=20           # Messages per batch
WEBHOOK_TIMEOUT_MS=10000 # 10s timeout
```

## Security

### Current Implementation

- Database credentials via environment variables
- No authentication on webhooks (future enhancement)
- HTTPS recommended for webhook URLs

### Future Enhancements

- Webhook signatures (HMAC)
- API authentication (API keys)
- Rate limiting per producer
- Webhook URL validation
- Secret management (Vault, AWS Secrets)

## Testing Strategy

### Unit Tests

- Validation logic
- Retry decision logic
- Error handling

### Integration Tests

- API endpoints
- Database queries
- Worker processing

### Load Tests

- 200 events/second sustained
- Burst traffic handling
- Ordering stress test

See `tests/README.md` for more details.

