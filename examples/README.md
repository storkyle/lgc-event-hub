# Example Consumer

Consumer đơn giản để test Event Hub. Consumer này sẽ nhận webhook requests từ Event Hub và log payload ra console.

## Cách sử dụng

### Bước 1: Khởi động Event Hub

Đảm bảo Event Hub đang chạy:

```bash
docker-compose up -d
```

### Bước 2: Chạy Example Consumer

Trong terminal mới, chạy consumer:

```bash
# Từ thư mục gốc của project
cd /Users/storkyle/Documents/workspaces/logical/projects/tools/event-hub

# Chạy consumer (sẽ lắng nghe trên port 4000)
npx tsx examples/simple-consumer.ts
```

Consumer sẽ chạy trên `http://localhost:4000` và sẵn sàng nhận webhooks.

### Bước 3: Đăng ký Subscriber

Đăng ký consumer của bạn vào Event Hub database để nhận events:

```bash
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub
```

Trong psql, chạy:

```sql
-- Đăng ký subscriber cho event type "user.created"
INSERT INTO subscribers (
  id,
  name,
  event_type,
  webhook_url,
  delivery_guarantee,
  ordering_enabled,
  ordering_key,
  retry_limit,
  retry_backoff_seconds,
  is_active,
  created_by
) VALUES (
  gen_random_uuid(),
  'Example Consumer',
  'user.created',
  'http://host.docker.internal:4000/webhook',
  'at_least_once',
  true,
  'organization_id',
  3,
  ARRAY[5, 30, 300],
  true,
  '5c53872a-4cff-40ec-8041-3ee859eb1e38'
);

-- Kiểm tra subscriber đã được tạo
SELECT id, name, event_type, webhook_url FROM subscribers;

-- Thoát psql
\q
```

**Lưu ý:** Sử dụng `host.docker.internal:4000` thay vì `localhost:4000` để Docker container có thể gọi đến service chạy trên máy host của bạn.

### Bước 4: Gửi Test Event

Gửi một event test tới Event Hub:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-$(date +%s)" \
  -d '{
    "event_type": "user.created",
    "version": "v1",
    "payload": {
      "user_id": "123",
      "email": "test@example.com",
      "name": "Test User",
      "created_at": "2025-10-01T12:00:00Z"
    },
    "organization_id": "org-456",
    "user_id": "user-123"
  }'
```

### Bước 5: Xem Logs

Kiểm tra terminal đang chạy consumer - bạn sẽ thấy webhook được nhận và payload được log ra:

```
========================================
[2025-10-01T12:00:00.000Z] 🎉 Webhook received!
========================================
Headers:
  - Message ID: abc-123-def-456
  - Event Type: user.created

Payload:
{
  "event_type": "user.created",
  "version": "v1",
  "payload": {
    "user_id": "123",
    "email": "test@example.com",
    "name": "Test User",
    "created_at": "2025-10-01T12:00:00Z"
  },
  "organization_id": "org-456",
  "user_id": "user-123"
}
========================================
```

## Test với các Event Types khác

Để test với các event types khác, đăng ký thêm subscribers:

```sql
-- Subscriber cho event type "order.created"
INSERT INTO subscribers (
  id, name, event_type, webhook_url,
  delivery_guarantee, ordering_enabled, ordering_key,
  retry_limit, retry_backoff_seconds, is_active, created_by
) VALUES (
  gen_random_uuid(),
  'Example Consumer - Orders',
  'order.created',
  'http://host.docker.internal:4000/webhook',
  'at_least_once',
  true,
  'organization_id',
  3,
  ARRAY[5, 30, 300],
  true,
  'admin'
);
```

Sau đó gửi event với event_type tương ứng:

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-test-$(date +%s)" \
  -d '{
    "event_type": "order.created",
    "version": "v1",
    "payload": {
      "order_id": "order-789",
      "total_amount": 150.00,
      "items": ["item1", "item2"]
    },
    "organization_id": "org-456"
  }'
```

## Kiểm tra hoạt động

### 1. Kiểm tra events đã được nhận

```bash
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c "SELECT id, event_type, status, created_at FROM events ORDER BY created_at DESC LIMIT 5;"
```

### 2. Kiểm tra messages đã được gửi

```bash
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c "SELECT m.id, m.status, m.retry_count, s.name FROM messages m JOIN subscribers s ON m.subscriber_id = s.id ORDER BY m.created_at DESC LIMIT 5;"
```

### 3. Kiểm tra delivery attempts

```bash
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c "SELECT message_id, attempt_number, http_status, attempted_at FROM delivery_attempts ORDER BY attempted_at DESC LIMIT 5;"
```

## Test Retry Logic

Để test retry logic, tạm dừng consumer (Ctrl+C) trước khi gửi event. Event Hub sẽ retry theo cấu hình:

1. Gửi event khi consumer đang tắt
2. Xem logs của dispatcher workers: `docker-compose logs -f dispatcher`
3. Bật lại consumer
4. Event Hub sẽ retry và consumer sẽ nhận được webhook

## Test Ordering

Gửi nhiều events với cùng `organization_id` để test FIFO ordering:

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/events \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: order-test-$i" \
    -d "{
      \"event_type\": \"user.created\",
      \"payload\": {\"sequence\": $i, \"message\": \"Event $i\"},
      \"organization_id\": \"org-test-123\"
    }"
  sleep 0.1
done
```

Consumer sẽ nhận events theo đúng thứ tự 1, 2, 3, 4, 5.

## Troubleshooting

### Consumer không nhận webhook

1. Kiểm tra consumer đang chạy: `curl http://localhost:4000/health`
2. Kiểm tra subscriber đã được tạo:
   ```sql
   SELECT * FROM subscribers WHERE is_active = true;
   ```
3. Kiểm tra logs của dispatcher workers:
   ```bash
   docker-compose logs dispatcher
   ```
4. Kiểm tra webhook URL có đúng không (phải dùng `host.docker.internal` cho Docker)

### Events stuck ở status "pending"

Kiểm tra fan-out worker đang chạy:

```bash
docker-compose logs fanout
```

### Messages stuck ở status "delivering"

Kiểm tra dispatcher workers:

```bash
docker-compose logs dispatcher
```

Cleanup worker sẽ tự động recover messages bị stuck sau 60 giây.
