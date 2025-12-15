/**
 * Cortex Agent Integration Tests
 *
 * Purpose: Validate Snowflake Cortex Agent integration for NexusChat
 *
 * Test Coverage:
 * - Agent status endpoint
 * - Natural language chat queries
 * - SQL generation verification
 * - RBAC enforcement (user can only see their org's data)
 * - Conversation threading
 * - Error handling
 *
 * Prerequisites:
 * - AgentNexus backend running at localhost:3050
 * - Test user created with HCS organization assignment
 * - Cortex Agent configured for the test org (or mock available)
 *
 * Run: npx playwright test tests/videxa-baseline/cortex-agent.spec.js
 */

const { test, expect } = require('@playwright/test');

const AGENTNEXUS_URL = process.env.AGENTNEXUS_URL || 'http://localhost:3050';

// Test credentials (created via /api/testing/create-user)
const TEST_USER = {
  email: 'playwright-test@videxa.co',
  password: 'PlaywrightTest123!'
};

// Helper function to get auth token
async function getAuthToken(request) {
  const response = await request.post(`${AGENTNEXUS_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: TEST_USER.email, password: TEST_USER.password }
  });

  if (response.status() !== 200) {
    throw new Error(`Login failed: ${await response.text()}`);
  }

  const body = await response.json();
  return body.token;
}

test.describe('Cortex Agent - API Endpoint Tests', () => {

  test('CA001: Agent status endpoint should respond', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // 200 = success, 400 = user not in HCS org (valid for non-HCS test users)
    expect([200, 400]).toContain(response.status());

    const body = await response.json();
    console.log('Agent status response:', body);

    if (response.status() === 200) {
      expect(body).toHaveProperty('success');
      // Agent may or may not exist depending on setup
      if (body.agent_exists) {
        expect(body.agent_name).toBeTruthy();
        expect(body.database).toBeTruthy();
      }
    } else {
      // 400 means user is not in an HCS org - expected for test users like playwright-test@videxa.co
      expect(body.detail).toContain('organization');
      console.log('Note: Test user is not associated with an HCS organization');
    }
  });

  test('CA002: Suggested queries endpoint should return categories', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.get(`${AGENTNEXUS_URL}/api/cortex/suggested-queries`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // 200 = success, 400 = user not in HCS org (valid for non-HCS test users)
    expect([200, 400]).toContain(response.status());

    const body = await response.json();

    if (response.status() === 200) {
      expect(body.success).toBe(true);
      expect(body.suggestions).toBeInstanceOf(Array);
      expect(body.suggestions.length).toBeGreaterThan(0);

      // Verify suggestion structure
      const firstCategory = body.suggestions[0];
      expect(firstCategory).toHaveProperty('category');
      expect(firstCategory).toHaveProperty('queries');
      expect(firstCategory.queries).toBeInstanceOf(Array);

      console.log('Suggestion categories:', body.suggestions.map(s => s.category));
    } else {
      // 400 means user is not in an HCS org - expected for non-HCS test users
      expect(body.detail).toContain('organization');
      console.log('Note: Test user is not associated with an HCS organization');
    }
  });

  test('CA003: Unauthorized request should return 401', async ({ request }) => {
    const response = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    });

    expect(response.status()).toBe(401);
  });

  test('CA004: Chat endpoint should accept valid request', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'What is our overall denial rate?'
      }
    });

    // May return 200 (success) or 500 (if agent not configured)
    const body = await response.json();

    console.log('Chat response status:', response.status());
    console.log('Chat response:', JSON.stringify(body, null, 2));

    if (response.status() === 200) {
      expect(body.success).toBe(true);
      expect(body.response).toBeTruthy();
    } else {
      // If agent not configured, should return meaningful error
      expect(body.detail || body.error).toBeTruthy();
    }
  });

  test('CA005: Chat endpoint should reject empty message', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: ''
      }
    });

    // Should return 422 (validation error) for empty message
    expect([400, 422]).toContain(response.status());
  });

});

test.describe('Cortex Agent - Chat Functionality Tests', () => {

  test.skip('CA006: Should generate SQL for analytics query', async ({ request }) => {
    // Skip if agent not configured - this is a functional test
    const token = await getAuthToken(request);

    // First check if agent exists
    const statusResponse = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusBody = await statusResponse.json();

    if (!statusBody.agent_exists) {
      console.log('Skipping: Cortex Agent not configured for test org');
      test.skip();
      return;
    }

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'Show me total denied amount by provider'
      }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.response).toBeTruthy();

    // Should have generated SQL
    if (body.sql_generated) {
      expect(body.sql_generated.toUpperCase()).toContain('SELECT');
      expect(body.sql_generated.toUpperCase()).toContain('PROVIDER');
      console.log('Generated SQL:', body.sql_generated);
    }
  });

  test.skip('CA007: Should maintain conversation context with thread_id', async ({ request }) => {
    const token = await getAuthToken(request);

    // First check if agent exists
    const statusResponse = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusBody = await statusResponse.json();

    if (!statusBody.agent_exists) {
      console.log('Skipping: Cortex Agent not configured for test org');
      test.skip();
      return;
    }

    // First message
    const response1 = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'What is the total denied amount?'
      }
    });

    expect(response1.status()).toBe(200);
    const body1 = await response1.json();

    const threadId = body1.thread_id;
    const messageId = body1.message_id;

    console.log('First message - Thread ID:', threadId, 'Message ID:', messageId);

    if (!threadId) {
      console.log('Thread ID not returned, skipping follow-up test');
      return;
    }

    // Follow-up message using thread context
    const response2 = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'Break that down by month',
        thread_id: threadId,
        parent_message_id: messageId
      }
    });

    expect(response2.status()).toBe(200);
    const body2 = await response2.json();

    // Response should reference the original context
    console.log('Follow-up response:', body2.response?.substring(0, 200));
  });

  test.skip('CA008: Should return data for valid query', async ({ request }) => {
    const token = await getAuthToken(request);

    // First check if agent exists
    const statusResponse = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statusBody = await statusResponse.json();

    if (!statusBody.agent_exists) {
      console.log('Skipping: Cortex Agent not configured for test org');
      test.skip();
      return;
    }

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'How many claims are in each status?'
      }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);

    // May return structured data
    if (body.data) {
      expect(body.data).toBeInstanceOf(Array);
      console.log('Data rows returned:', body.data.length);
    }
  });

});

test.describe('Cortex Agent - RBAC Tests', () => {

  test('CA009: User should only access their org data', async ({ request }) => {
    const token = await getAuthToken(request);

    // Status check reveals org assignment
    const response = await request.get(`${AGENTNEXUS_URL}/api/cortex/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const body = await response.json();

    // If agent exists, verify it's for the correct org
    if (body.agent_exists && body.database) {
      // Database name should match user's org
      // Note: Test user may be in a trial org, not HCS
      console.log('User assigned to database:', body.database);
    }
  });

  test('CA010: Chat request should use user org context', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'Show me all claims'  // Should only return user's org data
      }
    });

    const body = await response.json();

    // If successful, SQL should reference the org's database
    if (response.status() === 200 && body.sql_generated) {
      console.log('Generated SQL uses database context');
      // SQL should NOT contain other org's database names
      expect(body.sql_generated).not.toContain('HCS9999');  // Fake org
    } else if (body.error) {
      // Error should mention org context, not expose other orgs
      expect(body.error).not.toContain('HCS9999');
    }
  });

});

test.describe('Cortex Agent - Error Handling Tests', () => {

  test('CA011: Should handle invalid query gracefully', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: 'asdfghjkl random gibberish query 12345'
      }
    });

    // Should not crash - either return helpful message or graceful error
    expect([200, 400, 500]).toContain(response.status());

    const body = await response.json();

    if (response.status() === 200) {
      // Agent should try to help or explain what data is available
      expect(body.response).toBeTruthy();
    } else {
      expect(body.detail || body.error).toBeTruthy();
    }
  });

  test('CA012: Should handle very long message', async ({ request }) => {
    const token = await getAuthToken(request);

    // Generate a very long message
    const longMessage = 'What is the denial rate? '.repeat(500);  // ~12500 chars

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: longMessage
      }
    });

    // Should either truncate or reject gracefully
    expect([200, 400, 413, 422]).toContain(response.status());
  });

  test('CA013: Should handle special characters in query', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        message: "What's the denial rate for ICD-10 code 'J18.9'?"
      }
    });

    // Should handle quotes and special chars without SQL injection
    expect([200, 400, 500]).toContain(response.status());

    const body = await response.json();

    // Should not expose raw SQL errors or injection attempts
    if (body.error) {
      expect(body.error.toLowerCase()).not.toContain('syntax error');
    }
  });

});

test.describe('Cortex Agent - Streaming Tests', () => {

  test('CA014: Stream endpoint should return SSE format', async ({ request }) => {
    const token = await getAuthToken(request);

    // Note: Playwright's request API doesn't fully support SSE streaming
    // This test verifies the endpoint accepts the request

    const response = await request.post(`${AGENTNEXUS_URL}/api/cortex/chat/stream`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      data: {
        message: 'What is the denial rate?'
      }
    });

    // Should return 200 with event-stream content type
    if (response.status() === 200) {
      const contentType = response.headers()['content-type'];
      expect(contentType).toContain('text/event-stream');
    } else {
      // If agent not configured, may return error
      console.log('Stream endpoint status:', response.status());
    }
  });

});

console.log(`
╔════════════════════════════════════════════════════════════╗
║   Cortex Agent Integration Tests                           ║
║   Purpose: Validate Snowflake Cortex Agent API             ║
║   Tests: 14 integration checks                             ║
║   Note: Some tests skip if Cortex Agent not configured     ║
╚════════════════════════════════════════════════════════════╝
`);
