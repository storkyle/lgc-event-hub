// Core type definitions for Event Hub system

export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type MessageStatus = 'pending' | 'delivering' | 'delivered' | 'failed' | 'dlq';
export type DeliveryGuarantee = 'at_least_once' | 'at_most_once';
export type OrderingKey = 'organization_id' | 'user_id' | null;

export interface Event {
  id: string;
  event_type: string;
  version: string;
  payload: Record<string, any>;
  organization_id?: string;
  user_id?: string;
  status: EventStatus;
  idempotency_key?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Subscriber {
  id: string;
  name: string;
  event_type: string;
  webhook_url: string;
  delivery_guarantee: DeliveryGuarantee;
  ordering_enabled: boolean;
  ordering_key: OrderingKey;
  retry_limit: number;
  retry_backoff_seconds: number[];
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  event_id: string;
  subscriber_id: string;
  status: MessageStatus;
  retry_count: number;
  next_retry_at?: Date;
  ordering_key_value?: string;
  locked_at?: Date;
  locked_by?: string;
  created_at: Date;
  updated_at: Date;
  delivered_at?: Date;
}

export interface DeliveryAttempt {
  id: string;
  message_id: string;
  attempt_number: number;
  http_status?: number;
  response_body?: string;
  error_message?: string;
  attempted_at: Date;
  duration_ms: number;
}

export interface DeadLetterQueueItem {
  id: string;
  message_id: string;
  event_snapshot: Record<string, any>;
  subscriber_snapshot: Record<string, any>;
  failure_reason: string;
  moved_to_dlq_at: Date;
  manual_retry_by?: string;
  manual_retry_at?: Date;
}

export interface MessageWithDetails extends Message {
  event_type: string;
  version: string;
  payload: Record<string, any>;
  webhook_url: string;
  retry_limit: number;
  retry_backoff_seconds: number[];
}

export interface CreateEventDto {
  event_type: string;
  version?: string;
  payload: Record<string, any>;
  organization_id?: string;
  user_id?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface EventCreatedResponse {
  event_id: string;
  message: string;
  latency_ms?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected';
}

export interface RetryRequest {
  retry_by: string; // User ID who initiated the retry
}

export interface RetryResponse {
  dlq_id: string;
  message_id: string;
  retry_by: string;
  retry_at: string;
}

export interface BulkRetryRequest {
  dlq_ids: string[];
  retry_by: string;
}

export interface BulkRetryResponse {
  successful: Array<{
    dlq_id: string;
    message_id: string;
    success: boolean;
  }>;
  failed: Array<{
    dlq_id: string;
    error: string;
  }>;
  summary: {
    total_requested: number;
    successful: number;
    failed: number;
  };
}

export interface CreateSubscriberDto {
  name: string;
  event_type: string;
  webhook_url: string;
  delivery_guarantee?: DeliveryGuarantee;
  ordering_enabled?: boolean;
  ordering_key?: OrderingKey;
  retry_limit?: number;
  retry_backoff_seconds?: number[];
  is_active?: boolean;
  created_by: string;
}

export interface UpdateSubscriberDto {
  name?: string;
  event_type?: string;
  webhook_url?: string;
  delivery_guarantee?: DeliveryGuarantee;
  ordering_enabled?: boolean;
  ordering_key?: OrderingKey;
  retry_limit?: number;
  retry_backoff_seconds?: number[];
  is_active?: boolean;
}

export interface SubscriberCreatedResponse {
  subscriber_id: string;
  message: string;
}

export interface SubscriberUpdatedResponse {
  subscriber_id: string;
  message: string;
}

export interface SubscriberDeletedResponse {
  subscriber_id: string;
  message: string;
}
