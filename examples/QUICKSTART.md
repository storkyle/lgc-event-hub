# Quick Start - Test Event Hub với Example Consumer

Hướng dẫn nhanh để test Event Hub hoạt động trong 5 phút.

## Bước 1: Khởi động Event Hub

```bash
cd /Users/storkyle/Documents/workspaces/logical/projects/tools/event-hub
docker-compose up -d
```

Đợi khoảng 10-15 giây để tất cả services khởi động.

## Bước 2: Chạy Example Consumer

Mở terminal mới và chạy:

```bash
pnpm run dev:consumer
```

Bạn sẽ thấy:
```
╔════════════════════════════════════════════╗
║       Example Consumer Service             ║
╚════════════════════════════════════════════╝
✓ Listening on http://localhost:4000
✓ Webhook endpoint: http://localhost:4000/webhook
✓ Health check: http://localhost:4000/health

🎯 Ready to receive webhooks from Event Hub!

Waiting for events...
```

## Bước 3: Chạy Test Script

Mở terminal thứ 3 và chạy:

```bash
./examples/test-flow.sh
```

Script này sẽ tự động:
- ✅ Kiểm tra Event Hub đang chạy
- ✅ Kiểm tra Consumer đang chạy
- ✅ Đăng ký subscriber (nếu chưa có)
- ✅ Gửi test event

## Bước 4: Xem Kết Quả

Quay lại terminal chạy consumer (Bước 2), bạn sẽ thấy webhook được nhận:

```
========================================
[2025-10-01T12:00:00.000Z] 🎉 Webhook received!
========================================
Headers:
  - Message ID: abc-123-def-456
  - Event Type: user.created

Payload:
{
  "user_id": "test-123",
  "email": "test@example.com",
  "name": "Test User",
  "created_at": "2025-10-01T12:00:00Z"
}
========================================
```

## ✨ Xong!

Event Hub của bạn đã hoạt động! Event đã được:
1. ✅ Nhận bởi API Server
2. ✅ Lưu vào PostgreSQL
3. ✅ Fan-out tạo message cho subscriber
4. ✅ Dispatcher gửi webhook đến consumer
5. ✅ Consumer nhận và log payload

## Test thêm

### Gửi event thủ công

```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: manual-test-$(date +%s)" \
  -d '{
    "event_type": "user.created",
    "version": "v1",
    "payload": {
      "user_id": "456",
      "email": "manual@test.com",
      "action": "manual_test"
    },
    "organization_id": "org-manual"
  }'
```

### Gửi nhiều events (test ordering)

```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/events \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: batch-$i" \
    -d "{
      \"event_type\": \"user.created\",
      \"payload\": {\"sequence\": $i, \"message\": \"Event number $i\"},
      \"organization_id\": \"org-batch-test\"
    }"
  echo ""
  sleep 0.2
done
```

Consumer sẽ nhận events theo đúng thứ tự 1, 2, 3, 4, 5 (FIFO ordering).

## Kiểm tra Database

```bash
# Xem events
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c \
  "SELECT id, event_type, status, created_at FROM events ORDER BY created_at DESC LIMIT 5;"

# Xem messages
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c \
  "SELECT m.id, m.status, m.retry_count, s.name FROM messages m JOIN subscribers s ON m.subscriber_id = s.id ORDER BY m.created_at DESC LIMIT 5;"

# Xem delivery attempts
docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub -c \
  "SELECT message_id, attempt_number, http_status, attempted_at FROM delivery_attempts ORDER BY attempted_at DESC LIMIT 5;"
```

## Xem Logs

```bash
# Tất cả logs
docker-compose logs -f

# Chỉ API server
docker-compose logs -f api

# Chỉ Dispatcher workers
docker-compose logs -f dispatcher

# Chỉ Fan-out worker
docker-compose logs -f fanout
```

## Test Retry Logic

1. **Dừng consumer** (Ctrl+C trong terminal chạy consumer)
2. **Gửi event** bằng curl
3. **Xem logs dispatcher** - sẽ thấy retry attempts:
   ```bash
   docker-compose logs -f dispatcher
   ```
4. **Bật lại consumer** - event sẽ được deliver thành công

## Dọn dẹp

```bash
# Dừng tất cả
docker-compose down

# Dừng và xóa volumes (xóa data)
docker-compose down -v
```

## Troubleshooting

### Consumer không nhận webhook

Kiểm tra:
```bash
# Health check consumer
curl http://localhost:4000/health

# Xem logs dispatcher
docker-compose logs dispatcher | tail -50

# Kiểm tra subscriber
docker exec event-hub-postgres-1 psql -U eventhub -d eventhub -c \
  "SELECT id, name, webhook_url, is_active FROM subscribers;"
```

### Webhook URL không đúng

Nếu chạy consumer trên Docker, URL phải là `http://host.docker.internal:4000/webhook` thay vì `http://localhost:4000/webhook`.

Nếu chạy consumer trên máy host (local), dùng `host.docker.internal` để Docker có thể gọi đến máy host.

## Tài liệu đầy đủ

Xem thêm chi tiết tại:
- [examples/README.md](./README.md) - Hướng dẫn chi tiết
- [README.md](../README.md) - Tài liệu chính
- [ARCHITECTURE.md](../ARCHITECTURE.md) - Kiến trúc hệ thống

