# Curl Examples - Test Event Hub

Các ví dụ curl commands để test push events vào Event Hub.

## 📝 Cấu trúc cơ bản

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-here" \
  -d '{
    "event_type": "your.event.type",
    "version": "v1",
    "payload": { ... },
    "organization_id": "org-id",
    "user_id": "user-id"
  }'
```

## 🚀 Quick Test (đơn giản nhất)

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "user.created",
    "payload": {
      "user_id": "123",
      "email": "test@example.com"
    }
  }'
```

## 📋 Ví dụ chi tiết

### 1. User Created Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: user-created-$(date +%s)" \
  -d '{
    "event_type": "user.created",
    "version": "v1",
    "payload": {
      "user_id": "user-123",
      "email": "newuser@example.com",
      "name": "Nguyen Van A",
      "phone": "+84901234567",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "organization_id": "org-456",
    "user_id": "user-123"
  }'
```

### 2. User Updated Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: user-updated-$(date +%s)" \
  -d '{
    "event_type": "user.updated",
    "version": "v1",
    "payload": {
      "user_id": "user-123",
      "changes": {
        "email": "newemail@example.com",
        "phone": "+84909999999"
      },
      "updated_by": "admin-001",
      "updated_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "organization_id": "org-456",
    "user_id": "user-123"
  }'
```

### 3. Order Created Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-created-$(date +%s)" \
  -d '{
    "event_type": "order.created",
    "version": "v1",
    "payload": {
      "order_id": "order-789",
      "user_id": "user-456",
      "total_amount": 250000,
      "currency": "VND",
      "items": [
        {
          "product_id": "prod-1",
          "product_name": "Áo thun",
          "quantity": 2,
          "price": 100000
        },
        {
          "product_id": "prod-2",
          "product_name": "Quần jean",
          "quantity": 1,
          "price": 50000
        }
      ],
      "status": "pending",
      "shipping_address": {
        "street": "123 Nguyen Hue",
        "city": "Ho Chi Minh",
        "country": "Vietnam"
      }
    },
    "organization_id": "org-456",
    "user_id": "user-456"
  }'
```

### 4. Payment Completed Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: payment-completed-$(date +%s)" \
  -d '{
    "event_type": "payment.completed",
    "version": "v1",
    "payload": {
      "payment_id": "pay-123",
      "order_id": "order-789",
      "amount": 250000,
      "currency": "VND",
      "method": "credit_card",
      "card_last_four": "4242",
      "status": "success",
      "processed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "organization_id": "org-456"
  }'
```

### 5. Product Inventory Updated

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: inventory-updated-$(date +%s)" \
  -d '{
    "event_type": "product.inventory.updated",
    "version": "v1",
    "payload": {
      "product_id": "prod-1",
      "sku": "SHIRT-001",
      "old_quantity": 100,
      "new_quantity": 95,
      "change": -5,
      "reason": "order_fulfilled",
      "warehouse_id": "wh-001"
    },
    "organization_id": "org-456"
  }'
```

### 6. Email Notification Event

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: email-notification-$(date +%s)" \
  -d '{
    "event_type": "notification.email.queued",
    "version": "v1",
    "payload": {
      "notification_id": "notif-123",
      "to": "user@example.com",
      "subject": "Order Confirmation",
      "template": "order_confirmation",
      "variables": {
        "order_id": "order-789",
        "customer_name": "Nguyen Van A"
      },
      "priority": "high"
    },
    "organization_id": "org-456",
    "user_id": "user-123"
  }'
```

## 🔄 Test Ordering (FIFO)

Gửi nhiều events với cùng `organization_id` để test ordering:

```bash
# Gửi 5 events liên tiếp
for i in {1..5}; do
  curl -X POST http://localhost:3000/events \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: sequence-test-$i" \
    -d "{
      \"event_type\": \"user.created\",
      \"payload\": {
        \"sequence\": $i,
        \"message\": \"Event number $i\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
      },
      \"organization_id\": \"org-ordering-test\"
    }"
  echo ""
  sleep 0.2
done
```

Consumer sẽ nhận các events theo đúng thứ tự: 1, 2, 3, 4, 5

## 🔁 Test Idempotency

Gửi cùng event 2 lần với cùng `X-Idempotency-Key`:

```bash
# Lần 1 - tạo mới (202)
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: idempotency-test-123" \
  -d '{
    "event_type": "user.created",
    "payload": {
      "user_id": "test-idempotency",
      "email": "idempotent@test.com"
    }
  }'

# Lần 2 - duplicate (200, không tạo mới)
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: idempotency-test-123" \
  -d '{
    "event_type": "user.created",
    "payload": {
      "user_id": "test-idempotency",
      "email": "idempotent@test.com"
    }
  }'
```

Lần thứ 2 sẽ trả về event_id giống lần 1 và không tạo event mới.

## 📊 Test với jq (format JSON đẹp)

Thêm `| jq '.'` vào cuối curl command:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "user.created",
    "payload": {"user_id": "123"}
  }' | jq '.'
```

Output:
```json
{
  "event_id": "abc-123-def-456",
  "message": "Event accepted for processing",
  "latency_ms": 8
}
```

## 🔧 Script chạy tất cả

Hoặc dùng script có sẵn:

```bash
./examples/test-events.sh
```

## 💡 Tips

### Dynamic timestamp
```bash
$(date -u +%Y-%m-%dT%H:%M:%SZ)  # ISO 8601 UTC
$(date +%s)                      # Unix timestamp
```

### Unique Idempotency Key
```bash
-H "X-Idempotency-Key: test-$(date +%s)"
-H "X-Idempotency-Key: test-$(uuidgen)"
```

### Pretty print response
```bash
curl ... | jq '.'
```

### Save event_id to variable
```bash
RESPONSE=$(curl -s http://localhost:3000/events ...)
EVENT_ID=$(echo $RESPONSE | jq -r '.event_id')
echo "Event ID: $EVENT_ID"
```

## 🎯 One-liner nhanh

```bash
# Siêu đơn giản
curl -X POST http://localhost:3000/events -H "Content-Type: application/json" -d '{"event_type":"test.event","payload":{"message":"hello"}}'

# Với format đẹp
curl -X POST http://localhost:3000/events -H "Content-Type: application/json" -d '{"event_type":"test.event","payload":{"message":"hello"}}' | jq '.'
```

Chúc bạn test vui vẻ! 🚀

