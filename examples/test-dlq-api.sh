#!/bin/bash

# DLQ API Test Script
# This script demonstrates how to use the Dead Letter Queue management API

API_BASE_URL="http://localhost:3000"

echo "=== DLQ API Test Script ==="
echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: List DLQ items
echo "1. Testing GET /dlq"
echo "Command: curl -X GET \"$API_BASE_URL/dlq?limit=5\""
curl -X GET "$API_BASE_URL/dlq?limit=5" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 2: Test validation (should fail)
echo "2. Testing POST /dlq/invalid-id/retry (should fail validation)"
echo "Command: curl -X POST \"$API_BASE_URL/dlq/invalid-id/retry\" -d '{\"retry_by\": \"invalid-uuid\"}'"
curl -X POST "$API_BASE_URL/dlq/invalid-id/retry" \
  -H "Content-Type: application/json" \
  -d '{"retry_by": "invalid-uuid"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 3: Test bulk retry validation (should fail)
echo "3. Testing POST /dlq/bulk-retry (should fail validation)"
echo "Command: curl -X POST \"$API_BASE_URL/dlq/bulk-retry\" -d '{\"retry_by\": \"invalid-uuid\", \"dlq_ids\": []}'"
curl -X POST "$API_BASE_URL/dlq/bulk-retry" \
  -H "Content-Type: application/json" \
  -d '{"retry_by": "invalid-uuid", "dlq_ids": []}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 4: Test with valid UUID format (should fail with 404)
echo "4. Testing POST /dlq/non-existent-id/retry (should fail with 404)"
echo "Command: curl -X POST \"$API_BASE_URL/dlq/123e4567-e89b-12d3-a456-426614174000/retry\" -d '{\"retry_by\": \"987fcdeb-51a2-43d7-8f9e-123456789abc\"}'"
curl -X POST "$API_BASE_URL/dlq/123e4567-e89b-12d3-a456-426614174000/retry" \
  -H "Content-Type: application/json" \
  -d '{"retry_by": "987fcdeb-51a2-43d7-8f9e-123456789abc"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

echo "=== Test completed ==="
echo ""
echo "Note: To test actual retry functionality, you need:"
echo "1. DLQ items in the database"
echo "2. A running Event Hub server"
echo "3. Valid DLQ item IDs from the GET /dlq endpoint"
echo ""
echo "Example of a real retry command (replace with actual DLQ ID):"
echo "curl -X POST \"$API_BASE_URL/dlq/ACTUAL_DLQ_ID/retry\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"retry_by\": \"987fcdeb-51a2-43d7-8f9e-123456789abc\"}'"
