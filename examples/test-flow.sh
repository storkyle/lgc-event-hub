#!/bin/bash
# Script test nhanh Event Hub flow

set -e

echo "╔═════════════════════════════════════════════╗"
echo "║   Event Hub - Test Flow Script             ║"
echo "╚═════════════════════════════════════════════╝"
echo ""

# Màu sắc
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Kiểm tra Event Hub đang chạy
echo -e "${BLUE}[1/4]${NC} Kiểm tra Event Hub..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Event Hub đang chạy"
else
    echo -e "${YELLOW}⚠${NC} Event Hub chưa chạy. Đang khởi động..."
    docker-compose up -d
    echo "Đợi services khởi động (15 giây)..."
    sleep 15
fi

# 2. Kiểm tra Consumer đang chạy
echo ""
echo -e "${BLUE}[2/4]${NC} Kiểm tra Consumer..."
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Consumer đang chạy trên port 4000"
else
    echo -e "${YELLOW}⚠${NC} Consumer chưa chạy."
    echo "Vui lòng chạy consumer trong terminal khác:"
    echo "  pnpm run dev:consumer"
    echo ""
    exit 1
fi

# 3. Đăng ký subscriber (nếu chưa có)
echo ""
echo -e "${BLUE}[3/4]${NC} Kiểm tra Subscriber..."

# Kiểm tra subscriber đã tồn tại chưa
SUBSCRIBER_COUNT=$(docker exec event-hub-postgres-1 psql -U eventhub -d eventhub -t -c \
  "SELECT COUNT(*) FROM subscribers WHERE name = 'Example Consumer' AND is_active = true;" 2>/dev/null || echo "0")

if [ "$SUBSCRIBER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Subscriber 'Example Consumer' đã tồn tại"
else
    echo "Đang đăng ký subscriber..."
    docker exec event-hub-postgres-1 psql -U eventhub -d eventhub > /dev/null 2>&1 << EOF
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
  'admin'
);
EOF
    echo -e "${GREEN}✓${NC} Subscriber đã được đăng ký"
fi

# 4. Gửi test event
echo ""
echo -e "${BLUE}[4/4]${NC} Gửi test event..."

TIMESTAMP=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: test-$TIMESTAMP" \
  -d '{
    "event_type": "user.created",
    "version": "v1",
    "payload": {
      "user_id": "test-123",
      "email": "test@example.com",
      "name": "Test User",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "organization_id": "org-test",
    "user_id": "user-test-123"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "202" ]; then
    echo -e "${GREEN}✓${NC} Event đã được gửi"
    echo ""
    echo "$BODY" | jq '.'
    
    EVENT_ID=$(echo "$BODY" | jq -r '.event_id')
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✓ Test hoàn tất!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🎉 Kiểm tra terminal chạy consumer để xem webhook!"
    echo ""
    echo "Event ID: $EVENT_ID"
    echo ""
    echo "Để xem chi tiết trong database:"
    echo "  docker exec -it event-hub-postgres-1 psql -U eventhub -d eventhub"
    echo "  SELECT * FROM events WHERE id = '$EVENT_ID';"
    echo ""
    
else
    echo -e "${YELLOW}⚠${NC} Có lỗi xảy ra (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi

