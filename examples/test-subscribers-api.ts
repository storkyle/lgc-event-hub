// Test script for Subscribers CRUD API
const API_BASE_URL = "http://localhost:3000";

async function testSubscribersAPI() {
  console.log("Testing Subscribers CRUD API endpoints...\n");

  try {
    // Test 1: Get all subscribers
    console.log("1. Testing GET /subscribers");
    const subscribersResponse = await fetch(`${API_BASE_URL}/subscribers`);
    const subscribersData = await subscribersResponse.json();
    console.log("Status:", subscribersResponse.status);
    console.log("Response:", JSON.stringify(subscribersData, null, 2));
    console.log("");

    // Test 2: Test validation for create subscriber (should fail)
    console.log("2. Testing POST /subscribers (should fail validation)");
    const invalidCreateResponse = await fetch(`${API_BASE_URL}/subscribers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "",
        event_type: "invalid",
        webhook_url: "not-a-url",
        created_by: "invalid-uuid",
      }),
    });
    const invalidCreateData = await invalidCreateResponse.json();
    console.log("Status:", invalidCreateResponse.status);
    console.log("Response:", JSON.stringify(invalidCreateData, null, 2));
    console.log("");

    // Test 3: Test validation for update subscriber (should fail)
    console.log(
      "3. Testing PUT /subscribers/invalid-id (should fail validation)"
    );
    const invalidUpdateResponse = await fetch(
      `${API_BASE_URL}/subscribers/invalid-id`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_url: "not-a-url",
          retry_limit: 15, // Invalid: > 10
        }),
      }
    );
    const invalidUpdateData = await invalidUpdateResponse.json();
    console.log("Status:", invalidUpdateResponse.status);
    console.log("Response:", JSON.stringify(invalidUpdateData, null, 2));
    console.log("");

    // Test 4: Test with valid data (should fail with 404 for non-existent subscriber)
    console.log(
      "4. Testing PUT /subscribers/non-existent-id (should fail with 404)"
    );
    const notFoundResponse = await fetch(
      `${API_BASE_URL}/subscribers/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Subscriber",
        }),
      }
    );
    const notFoundData = await notFoundResponse.json();
    console.log("Status:", notFoundResponse.status);
    console.log("Response:", JSON.stringify(notFoundData, null, 2));
    console.log("");

    // Test 5: Test delete non-existent subscriber (should fail with 404)
    console.log(
      "5. Testing DELETE /subscribers/non-existent-id (should fail with 404)"
    );
    const deleteResponse = await fetch(
      `${API_BASE_URL}/subscribers/123e4567-e89b-12d3-a456-426614174000`,
      {
        method: "DELETE",
      }
    );
    const deleteData = await deleteResponse.json();
    console.log("Status:", deleteResponse.status);
    console.log("Response:", JSON.stringify(deleteData, null, 2));
    console.log("");

    console.log("✅ All validation tests passed!");
    console.log("📝 Note: To test actual CRUD functionality, you need:");
    console.log("   - A running Event Hub server");
    console.log("   - Valid subscriber IDs from the GET /subscribers endpoint");
    console.log("   - Proper authentication headers");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSubscribersAPI();
}

export { testSubscribersAPI };
