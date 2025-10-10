# Subscribers CRUD API

This document describes the RESTful API endpoints for managing subscribers in the Event Hub system.

## Overview

The Subscribers API provides endpoints to:

- List subscribers with filtering
- Get specific subscriber details
- Create new subscribers
- Update existing subscribers
- Deactivate subscribers (soft delete)
- Permanently delete subscribers
- Reactivate deactivated subscribers

## Endpoints

### 1. List Subscribers

**GET** `/subscribers`

Retrieves all subscribers with optional filtering.

#### Query Parameters

- `limit` (optional): Number of items to return (default: 50)
- `offset` (optional): Number of items to skip (default: 0)
- `event_type` (optional): Filter by event type
- `is_active` (optional): Filter by active status (true/false)

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "User Service",
      "event_type": "user.created",
      "webhook_url": "https://api.example.com/webhooks/user-events",
      "delivery_guarantee": "at_least_once",
      "ordering_enabled": true,
      "ordering_key": "user_id",
      "retry_limit": 3,
      "retry_backoff_seconds": [5, 30, 300],
      "is_active": true,
      "created_by": "uuid",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 2. Get Subscriber

**GET** `/subscribers/:id`

Retrieves a specific subscriber by its ID.

#### Path Parameters

- `id`: Subscriber UUID

#### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "User Service",
    "event_type": "user.created",
    "webhook_url": "https://api.example.com/webhooks/user-events",
    "delivery_guarantee": "at_least_once",
    "ordering_enabled": true,
    "ordering_key": "user_id",
    "retry_limit": 3,
    "retry_backoff_seconds": [5, 30, 300],
    "is_active": true,
    "created_by": "uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### 3. Create Subscriber

**POST** `/subscribers`

Creates a new subscriber.

#### Request Body

```json
{
  "name": "User Service",
  "event_type": "user.created",
  "webhook_url": "https://api.example.com/webhooks/user-events",
  "delivery_guarantee": "at_least_once",
  "ordering_enabled": true,
  "ordering_key": "user_id",
  "retry_limit": 3,
  "retry_backoff_seconds": [5, 30, 300],
  "is_active": true,
  "created_by": "uuid"
}
```

#### Request Body Parameters

- `name` (required): Subscriber name
- `event_type` (required): Event type to subscribe to
- `webhook_url` (required): Webhook URL for event delivery
- `delivery_guarantee` (optional): "at_least_once" or "at_most_once" (default: "at_least_once")
- `ordering_enabled` (optional): Enable ordering (default: false)
- `ordering_key` (optional): "organization_id", "user_id", or null (default: null)
- `retry_limit` (optional): Maximum retry attempts (default: 3, max: 10)
- `retry_backoff_seconds` (optional): Array of retry delays in seconds (default: [5, 30, 300])
- `is_active` (optional): Active status (default: true)
- `created_by` (required): UUID of the user creating the subscriber

#### Response

```json
{
  "success": true,
  "message": "Subscriber created successfully",
  "data": {
    "subscriber_id": "uuid",
    "message": "Subscriber created successfully"
  }
}
```

### 4. Update Subscriber

**PUT** `/subscribers/:id`

Updates an existing subscriber. All fields are optional.

#### Path Parameters

- `id`: Subscriber UUID

#### Request Body

```json
{
  "name": "Updated User Service",
  "webhook_url": "https://api.example.com/webhooks/user-events-v2",
  "retry_limit": 5,
  "is_active": false
}
```

#### Response

```json
{
  "success": true,
  "message": "Subscriber updated successfully",
  "data": {
    "subscriber_id": "uuid",
    "message": "Subscriber updated successfully"
  }
}
```

### 5. Deactivate Subscriber

**DELETE** `/subscribers/:id`

Soft deletes a subscriber by setting `is_active = false`.

#### Path Parameters

- `id`: Subscriber UUID

#### Response

```json
{
  "success": true,
  "message": "Subscriber deactivated successfully",
  "data": {
    "subscriber_id": "uuid",
    "message": "Subscriber deactivated successfully"
  }
}
```

### 6. Permanently Delete Subscriber

**DELETE** `/subscribers/:id/hard`

Permanently deletes a subscriber. Only allowed if no messages are associated.

#### Path Parameters

- `id`: Subscriber UUID

#### Response

```json
{
  "success": true,
  "message": "Subscriber permanently deleted",
  "data": {
    "subscriber_id": "uuid",
    "message": "Subscriber permanently deleted"
  }
}
```

#### Error Response (if messages exist)

```json
{
  "success": false,
  "error": "Cannot delete subscriber with 5 associated messages. Deactivate instead."
}
```

### 7. Reactivate Subscriber

**POST** `/subscribers/:id/reactivate`

Reactivates a deactivated subscriber by setting `is_active = true`.

#### Path Parameters

- `id`: Subscriber UUID

#### Response

```json
{
  "success": true,
  "message": "Subscriber reactivated successfully",
  "data": {
    "subscriber_id": "uuid",
    "message": "Subscriber reactivated successfully"
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
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `409`: Conflict (cannot delete subscriber with messages)
- `500`: Internal Server Error

## Validation Rules

### Required Fields (Create)

- `name`: Non-empty string
- `event_type`: Non-empty string
- `webhook_url`: Valid URL
- `created_by`: Valid UUID

### Optional Fields

- `delivery_guarantee`: "at_least_once" or "at_most_once"
- `ordering_enabled`: Boolean
- `ordering_key`: "organization_id", "user_id", or null
- `retry_limit`: Number between 0 and 10
- `retry_backoff_seconds`: Array of numbers between 0 and 3600
- `is_active`: Boolean

## Usage Examples

### Using curl

```bash
# List all subscribers
curl -X GET "http://localhost:3000/subscribers"

# List subscribers for specific event type
curl -X GET "http://localhost:3000/subscribers?event_type=user.created&limit=10"

# Get specific subscriber
curl -X GET "http://localhost:3000/subscribers/123e4567-e89b-12d3-a456-426614174000"

# Create new subscriber
curl -X POST "http://localhost:3000/subscribers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Service",
    "event_type": "user.created",
    "webhook_url": "https://api.example.com/webhooks/user-events",
    "delivery_guarantee": "at_least_once",
    "ordering_enabled": true,
    "ordering_key": "user_id",
    "retry_limit": 3,
    "retry_backoff_seconds": [5, 30, 300],
    "is_active": true,
    "created_by": "987fcdeb-51a2-43d7-8f9e-123456789abc"
  }'

# Update subscriber
curl -X PUT "http://localhost:3000/subscribers/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated User Service",
    "retry_limit": 5
  }'

# Deactivate subscriber
curl -X DELETE "http://localhost:3000/subscribers/123e4567-e89b-12d3-a456-426614174000"

# Reactivate subscriber
curl -X POST "http://localhost:3000/subscribers/123e4567-e89b-12d3-a456-426614174000/reactivate"

# Permanently delete subscriber (only if no messages)
curl -X DELETE "http://localhost:3000/subscribers/123e4567-e89b-12d3-a456-426614174000/hard"
```

### Using JavaScript/TypeScript

```typescript
// List subscribers
const response = await fetch("/subscribers?event_type=user.created");
const subscribers = await response.json();

// Create subscriber
const createResponse = await fetch("/subscribers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "User Service",
    event_type: "user.created",
    webhook_url: "https://api.example.com/webhooks/user-events",
    delivery_guarantee: "at_least_once",
    ordering_enabled: true,
    ordering_key: "user_id",
    retry_limit: 3,
    retry_backoff_seconds: [5, 30, 300],
    is_active: true,
    created_by: "987fcdeb-51a2-43d7-8f9e-123456789abc",
  }),
});

// Update subscriber
const updateResponse = await fetch(
  "/subscribers/123e4567-e89b-12d3-a456-426614174000",
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Updated User Service",
      retry_limit: 5,
    }),
  }
);

// Deactivate subscriber
const deleteResponse = await fetch(
  "/subscribers/123e4567-e89b-12d3-a456-426614174000",
  {
    method: "DELETE",
  }
);

// Reactivate subscriber
const reactivateResponse = await fetch(
  "/subscribers/123e4567-e89b-12d3-a456-426614174000/reactivate",
  {
    method: "POST",
  }
);
```

## Important Notes

1. **Soft Delete**: The standard DELETE endpoint deactivates subscribers rather than permanently deleting them.

2. **Hard Delete**: Permanent deletion is only allowed when no messages are associated with the subscriber.

3. **Ordering**: When `ordering_enabled` is true, `ordering_key` must be specified.

4. **Retry Configuration**: `retry_backoff_seconds` should be an array of increasing values representing delay between retries.

5. **Webhook URL**: Must be a valid URL that can receive HTTP POST requests.

6. **Authentication**: All endpoints require proper authentication headers (X-Service-Token).

7. **Audit Trail**: All operations are logged with timestamps and user information.
