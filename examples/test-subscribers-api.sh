#!/bin/bash

# Subscribers CRUD API Test Script
# This script demonstrates how to use the Subscribers management API

API_BASE_URL="http://localhost:3000"

echo "=== Subscribers CRUD API Test Script ==="
echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: List subscribers
echo "1. Testing GET /subscribers"
echo "Command: curl -X GET \"$API_BASE_URL/subscribers\""
curl -X GET "$API_BASE_URL/subscribers" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 2: List subscribers with filters
echo "2. Testing GET /subscribers with filters"
echo "Command: curl -X GET \"$API_BASE_URL/subscribers?event_type=user.created&limit=5\""
curl -X GET "$API_BASE_URL/subscribers?event_type=user.created&limit=5" \
  -H "Accept: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 3: Test validation for create subscriber (should fail)
echo "3. Testing POST /subscribers (should fail validation)"
echo "Command: curl -X POST \"$API_BASE_URL/subscribers\" -d '{\"name\":\"\",\"event_type\":\"invalid\",\"webhook_url\":\"not-a-url\",\"created_by\":\"invalid-uuid\"}'"
curl -X POST "$API_BASE_URL/subscribers" \
  -H "Content-Type: application/json" \
  -d '{"name":"","event_type":"invalid","webhook_url":"not-a-url","created_by":"invalid-uuid"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 4: Test validation for update subscriber (should fail)
echo "4. Testing PUT /subscribers/invalid-id (should fail validation)"
echo "Command: curl -X PUT \"$API_BASE_URL/subscribers/invalid-id\" -d '{\"webhook_url\":\"not-a-url\",\"retry_limit\":15}'"
curl -X PUT "$API_BASE_URL/subscribers/invalid-id" \
  -H "Content-Type: application/json" \
  -d '{"webhook_url":"not-a-url","retry_limit":15}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 5: Test with valid data (should fail with 404 for non-existent subscriber)
echo "5. Testing PUT /subscribers/non-existent-id (should fail with 404)"
echo "Command: curl -X PUT \"$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000\" -d '{\"name\":\"Updated Subscriber\"}'"
curl -X PUT "$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Subscriber"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 6: Test delete non-existent subscriber (should fail with 404)
echo "6. Testing DELETE /subscribers/non-existent-id (should fail with 404)"
echo "Command: curl -X DELETE \"$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000\""
curl -X DELETE "$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

# Test 7: Test reactivate non-existent subscriber (should fail with 404)
echo "7. Testing POST /subscribers/non-existent-id/reactivate (should fail with 404)"
echo "Command: curl -X POST \"$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000/reactivate\""
curl -X POST "$API_BASE_URL/subscribers/123e4567-e89b-12d3-a456-426614174000/reactivate" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
echo ""

echo "=== Test completed ==="
echo ""
echo "Note: To test actual CRUD functionality, you need:"
echo "1. A running Event Hub server"
echo "2. Valid subscriber IDs from the GET /subscribers endpoint"
echo "3. Proper authentication headers (X-Service-Token)"
echo ""
echo "Example of a real create command (replace with actual values):"
echo "curl -X POST \"$API_BASE_URL/subscribers\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"X-Service-Token: your-token\" \\"
echo "  -d '{"
echo "    \"name\": \"User Service\","
echo "    \"event_type\": \"user.created\","
echo "    \"webhook_url\": \"https://api.example.com/webhooks/user-events\","
echo "    \"delivery_guarantee\": \"at_least_once\","
echo "    \"ordering_enabled\": true,"
echo "    \"ordering_key\": \"user_id\","
echo "    \"retry_limit\": 3,"
echo "    \"retry_backoff_seconds\": [5, 30, 300],"
echo "    \"is_active\": true,"
echo "    \"created_by\": \"987fcdeb-51a2-43d7-8f9e-123456789abc\""
echo "  }'"
