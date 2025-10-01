-- Event Hub Database Schema
-- PostgreSQL 16+

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Events Table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT 'v1',
  payload JSONB NOT NULL,
  organization_id UUID,
  user_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT events_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_events_status_created ON events(status, created_at);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_idempotency ON events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Subscribers Table
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  webhook_url VARCHAR(500) NOT NULL,
  delivery_guarantee VARCHAR(20) NOT NULL DEFAULT 'at_least_once',
  ordering_enabled BOOLEAN NOT NULL DEFAULT false,
  ordering_key VARCHAR(50),
  retry_limit INT NOT NULL DEFAULT 3,
  retry_backoff_seconds INT[] NOT NULL DEFAULT '{5, 30, 300}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT subscribers_guarantee_check CHECK (delivery_guarantee IN ('at_least_once', 'at_most_once')),
  CONSTRAINT subscribers_ordering_key_check CHECK (ordering_key IN ('organization_id', 'user_id', NULL))
);

CREATE INDEX idx_subscribers_event_type ON subscribers(event_type) WHERE is_active = true;

-- 3. Messages Table (Core Delivery Queue)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP,
  ordering_key_value VARCHAR(255),
  locked_at TIMESTAMP,
  locked_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMP,
  
  CONSTRAINT messages_status_check CHECK (status IN ('pending', 'delivering', 'delivered', 'failed', 'dlq'))
);

-- CRITICAL: Indexes for ordering + deduplication (Solution 1)
CREATE INDEX idx_messages_ordering_pending ON messages(
  subscriber_id, 
  ordering_key_value, 
  status,
  created_at
) WHERE ordering_key_value IS NOT NULL;

CREATE INDEX idx_messages_no_ordering ON messages(
  status,
  created_at
) WHERE ordering_key_value IS NULL;

CREATE INDEX idx_messages_retry ON messages(status, next_retry_at) WHERE status = 'failed';
CREATE INDEX idx_messages_event ON messages(event_id);

-- 4. Delivery Attempts Table (Audit Log)
CREATE TABLE delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  http_status INT,
  response_body TEXT,
  error_message TEXT,
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  duration_ms INT
);

CREATE INDEX idx_delivery_message ON delivery_attempts(message_id, attempted_at DESC);

-- 5. Dead Letter Queue
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) UNIQUE,
  event_snapshot JSONB NOT NULL,
  subscriber_snapshot JSONB NOT NULL,
  failure_reason TEXT NOT NULL,
  moved_to_dlq_at TIMESTAMP NOT NULL DEFAULT NOW(),
  manual_retry_by UUID,
  manual_retry_at TIMESTAMP
);

CREATE INDEX idx_dlq_moved_at ON dead_letter_queue(moved_to_dlq_at DESC);

-- 6. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscribers_updated_at BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

