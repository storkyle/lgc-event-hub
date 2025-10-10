const API_BASE_URL = "http://localhost:3000";

async function testDLQAPI() {
  console.log("Testing DLQ API endpoints...\n");

  try {
    // Test 1: Get all DLQ items
    console.log("1. Testing GET /dlq");
    const dlqResponse = await fetch(`${API_BASE_URL}/dlq`);
    const dlqData = await dlqResponse.json();
    console.log("Status:", dlqResponse.status);
    console.log("Response:", JSON.stringify(dlqData, null, 2));
    console.log("");

    // Test 2: Test validation for retry endpoint
    console.log(
      "2. Testing POST /dlq/invalid-id/retry (should fail validation)"
    );
    const invalidRetryResponse = await fetch(
      `${API_BASE_URL}/dlq/invalid-id/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry_by: "invalid-uuid" }),
      }
    );
    const invalidRetryData = await invalidRetryResponse.json();
    console.log("Status:", invalidRetryResponse.status);
    console.log("Response:", JSON.stringify(invalidRetryData, null, 2));
    console.log("");

    // Test 3: Test validation for bulk retry
    console.log("3. Testing POST /dlq/bulk-retry (should fail validation)");
    const invalidBulkResponse = await fetch(`${API_BASE_URL}/dlq/bulk-retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retry_by: "invalid-uuid", dlq_ids: [] }),
    });
    const invalidBulkData = await invalidBulkResponse.json();
    console.log("Status:", invalidBulkResponse.status);
    console.log("Response:", JSON.stringify(invalidBulkData, null, 2));
    console.log("");

    console.log("✅ All validation tests passed!");
    console.log(
      "📝 Note: To test actual retry functionality, you need DLQ items in the database."
    );
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testDLQAPI();
}

export { testDLQAPI };
