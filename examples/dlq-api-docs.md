# Dead Letter Queue (DLQ) Management API

This document describes the RESTful API endpoints for managing events in the Dead Letter Queue (DLQ).

## Overview

The DLQ API provides endpoints to:

- List DLQ items
- Get specific DLQ item details
- Manually retry individual DLQ items
- Bulk retry multiple DLQ items

## Endpoints

### 1. List DLQ Items

**GET** `/dlq`

Retrieves all items in the Dead Letter Queue.

#### Query Parameters

- `limit` (optional): Number of items to return (default: 50)
- `offset` (optional): Number of items to skip (default: 0)

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "message_id": "uuid",
      "event_snapshot": {
        "event_id": "uuid",
        "event_type": "user.created",
        "version": "v1",
        "payload": {...},
        "organization_id": "uuid",
        "user_id": "uuid"
      },
      "subscriber_snapshot": {
        "subscriber_id": "uuid",
        "name": "User Service",
        "webhook_url": "https://api.example.com/webhooks/user-events"
      },
      "failure_reason": "HTTP 500 - Internal Server Error",
      "moved_to_dlq_at": "2024-01-15T10:30:00Z",
      "manual_retry_by": null,
      "manual_retry_at": null
    }
  ]
}
```

### 2. Get DLQ Item

**GET** `/dlq/:id`

Retrieves a specific DLQ item by its ID.

#### Path Parameters

- `id`: DLQ item UUID

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "message_id": "uuid",
    "event_snapshot": {...},
    "subscriber_snapshot": {...},
    "failure_reason": "HTTP 500 - Internal Server Error",
    "moved_to_dlq_at": "2024-01-15T10:30:00Z",
    "manual_retry_by": null,
    "manual_retry_at": null
  }
}
```

### 3. Manual Retry DLQ Item

**POST** `/dlq/:id/retry`

Manually retries a specific DLQ item by moving it back to the pending queue.

#### Path Parameters

- `id`: DLQ item UUID

#### Request Body

```json
{
  "retry_by": "uuid"
}
```

#### Request Body Parameters

- `retry_by` (required): UUID of the user who initiated the retry

#### Response

```json
{
  "success": true,
  "message": "DLQ item successfully queued for retry",
  "data": {
    "dlq_id": "uuid",
    "message_id": "uuid",
    "retry_by": "uuid",
    "retry_at": "2024-01-15T11:00:00Z"
  }
}
```

#### Error Responses

- `404`: DLQ item not found
- `409`: DLQ item has already been manually retried
- `400`: Invalid request body or validation error

### 4. Bulk Retry DLQ Items

**POST** `/dlq/bulk-retry`

Manually retries multiple DLQ items in a single request.

#### Request Body

```json
{
  "dlq_ids": ["uuid1", "uuid2", "uuid3"],
  "retry_by": "uuid"
}
```

#### Request Body Parameters

- `dlq_ids` (required): Array of DLQ item UUIDs to retry
- `retry_by` (required): UUID of the user who initiated the retry

#### Response

```json
{
  "success": true,
  "message": "Bulk retry completed: 2 successful, 1 failed",
  "data": {
    "successful": [
      {
        "dlq_id": "uuid1",
        "message_id": "uuid1",
        "success": true
      },
      {
        "dlq_id": "uuid2",
        "message_id": "uuid2",
        "success": true
      }
    ],
    "failed": [
      {
        "dlq_id": "uuid3",
        "error": "Already manually retried"
      }
    ],
    "summary": {
      "total_requested": 3,
      "successful": 2,
      "failed": 1
    }
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `409`: Conflict (already retried)
- `500`: Internal Server Error

## Usage Examples

### Using curl

```bash
# List DLQ items
curl -X GET "http://localhost:3000/dlq?limit=10&offset=0"

# Get specific DLQ item
curl -X GET "http://localhost:3000/dlq/123e4567-e89b-12d3-a456-426614174000"

# Retry single DLQ item
curl -X POST "http://localhost:3000/dlq/123e4567-e89b-12d3-a456-426614174000/retry" \
  -H "Content-Type: application/json" \
  -d '{"retry_by": "987fcdeb-51a2-43d7-8f9e-123456789abc"}'

# Bulk retry multiple items
curl -X POST "http://localhost:3000/dlq/bulk-retry" \
  -H "Content-Type: application/json" \
  -d '{
    "dlq_ids": [
      "123e4567-e89b-12d3-a456-426614174000",
      "456e7890-e89b-12d3-a456-426614174001"
    ],
    "retry_by": "987fcdeb-51a2-43d7-8f9e-123456789abc"
  }'
```

### Using JavaScript/TypeScript

```typescript
// List DLQ items
const response = await fetch("/dlq?limit=20");
const dlqItems = await response.json();

// Retry single item
const retryResponse = await fetch(
  "/dlq/123e4567-e89b-12d3-a456-426614174000/retry",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ retry_by: "987fcdeb-51a2-43d7-8f9e-123456789abc" }),
  }
);

// Bulk retry
const bulkRetryResponse = await fetch("/dlq/bulk-retry", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    dlq_ids: ["uuid1", "uuid2"],
    retry_by: "987fcdeb-51a2-43d7-8f9e-123456789abc",
  }),
});
```

## Important Notes

1. **Idempotency**: Each DLQ item can only be manually retried once. Subsequent retry attempts will return a 409 Conflict error.

2. **Transaction Safety**: All retry operations are wrapped in database transactions to ensure data consistency.

3. **Audit Trail**: Manual retries are logged with the user ID who initiated the retry and the timestamp.

4. **Message Reset**: When a DLQ item is retried, the associated message is reset to `pending` status with retry count set to 0.

5. **Validation**: The `retry_by` field must be a valid UUID format.

6. **Bulk Operations**: Bulk retry operations are atomic - either all items succeed or none do. Individual failures within a bulk operation are reported separately.
