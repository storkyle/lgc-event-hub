#!/bin/bash
# Các ví dụ curl commands để test Event Hub

# Màu sắc
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════╗"
echo "║     Event Hub - Test Events                ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# 1. User Created Event (cơ bản)
echo -e "${BLUE}[1] User Created Event${NC}"
echo "────────────────────────────────────────────"
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: user-created-$(date +%s)" \
  -d '{
    "event_type": "user.created",
    "version": "v1",
    "payload": {
      "user_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59",
      "email": "newuser@example.com",
      "name": "Nguyen Van A",
      "created_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    },
    "organization_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59",
    "user_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59"
  }' | jq '.'
echo ""
echo ""

# 2. Order Created Event
echo -e "${BLUE}[2] Order Created Event${NC}"
echo "────────────────────────────────────────────"
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: order-created-$(date +%s)" \
  -d '{
    "event_type": "booking:created",
    "version": "v1",
    "payload": {
      "order_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59",
      "user_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59",
      "total_amount": 250000,
      "currency": "VND",
      "items": [
        {"product_id": "prod-1", "quantity": 2, "price": 100000},
        {"product_id": "prod-2", "quantity": 1, "price": 50000}
      ],
      "status": "pending"
    },
    "organization_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59"
  }' | jq '.'
echo ""
echo ""

# 3. Payment Completed Event
echo -e "${BLUE}[3] Payment Completed Event${NC}"
echo "────────────────────────────────────────────"
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: payment-completed-$(date +%s)" \
  -d '{
    "event_type": "payment.completed",
    "version": "v1",
    "payload": {
      "payment_id": "pay-123",
      "order_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59",
      "amount": 250000,
      "method": "credit_card",
      "status": "success"
    },
    "organization_id": "75af9989-0071-4ef6-b9ad-58af8a6daa59"
  }' | jq '.'
echo ""
echo ""

echo -e "${GREEN}✓ Đã gửi 3 test events${NC}"
echo ""
echo "Kiểm tra consumer terminal để xem webhooks!"
echo ""

