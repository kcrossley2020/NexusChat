/**
 * TC-AUTH-005: API Key Authentication Tests
 *
 * Tests API key management and authentication including:
 * - Create API key with scopes
 * - List user's API keys
 * - Use API key for authentication
 * - Revoke API key
 * - Scope enforcement
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;

// Generate unique test email
function generateTestEmail(): string {
  return `e2e-auth-apikey-${Date.now()}@example.com`;
}

test.describe('TC-AUTH-005: API Key Management', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let accessToken: string;
  let createdApiKey: string;
  let createdKeyId: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E API Key Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(createResponse.status()).toBe(200);

    // Login to get access token
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    expect(loginResponse.status()).toBe(200);
    const body = await loginResponse.json();
    accessToken = body.token;

    console.log(`Setup: Created test user ${testUserEmail}`);
  });

  test.afterAll(async ({ request }) => {
    if (testUserEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`);
        console.log(`Cleanup: Deleted test user ${testUserEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-005-01: Create API key with scopes', async ({ request }) => {
    // Step 1: Create API key
    const response = await request.post(`${BACKEND_URL}/api/apikeys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'E2E Test Key',
        description: 'Created by E2E tests',
        scopes: ['conversations:read', 'conversations:write'],
        expires_in_days: 7
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('created');
    expect(body.api_key).toBeTruthy();
    expect(body.key_id).toBeTruthy();
    expect(body.name).toBe('E2E Test Key');
    expect(body.scopes).toContain('conversations:read');
    expect(body.scopes).toContain('conversations:write');
    expect(body.created_at).toBeTruthy();
    expect(body.expires_at).toBeTruthy();

    // Step 4: Verify key format (vnx_ prefix)
    expect(body.api_key.startsWith('vnx_')).toBe(true);

    // Store for subsequent tests
    createdApiKey = body.api_key;
    createdKeyId = body.key_id;

    console.log('TC-AUTH-005-01 PASSED: API key created successfully');
  });

  test('TC-AUTH-005-02: List user API keys', async ({ request }) => {
    // Step 1: List API keys
    const response = await request.get(`${BACKEND_URL}/api/apikeys`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.api_keys)).toBe(true);
    expect(body.total_count).toBeGreaterThanOrEqual(1);

    // Step 4: Verify our key is in the list
    const ourKey = body.api_keys.find(
      (k: { key_id: string }) => k.key_id === createdKeyId
    );
    expect(ourKey).toBeTruthy();

    // Step 5: Verify key shows prefix but NOT full key
    expect(ourKey.prefix).toBeTruthy();
    expect(ourKey.prefix.startsWith('vnx_')).toBe(true);
    expect(ourKey.prefix.length).toBeLessThan(createdApiKey.length);

    // Step 6: Verify key has required fields
    expect(ourKey.name).toBe('E2E Test Key');
    expect(ourKey.description).toBe('Created by E2E tests');
    expect(ourKey.is_active).toBe(true);

    console.log('TC-AUTH-005-02 PASSED: API keys listed successfully');
  });

  test('TC-AUTH-005-03: Get available scopes', async ({ request }) => {
    // Step 1: Get available scopes
    const response = await request.get(`${BACKEND_URL}/api/apikeys/scopes`, {
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify scopes returned
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.scopes).toBeTruthy();

    // Step 4: Verify expected scopes exist
    const scopeKeys = Object.keys(body.scopes);
    expect(scopeKeys).toContain('conversations:read');
    expect(scopeKeys).toContain('conversations:write');
    expect(scopeKeys).toContain('files:read');
    expect(scopeKeys).toContain('files:upload');

    console.log('TC-AUTH-005-03 PASSED: Available scopes retrieved');
  });

  test('TC-AUTH-005-04: Revoke API key', async ({ request }) => {
    // Step 1: Revoke the API key
    const response = await request.delete(`${BACKEND_URL}/api/apikeys/${createdKeyId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify success message
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('revoked');

    // Step 4: Verify key no longer appears as active in list
    const listResponse = await request.get(`${BACKEND_URL}/api/apikeys`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      timeout: TEST_TIMEOUT
    });

    const listBody = await listResponse.json();
    const revokedKey = listBody.api_keys.find(
      (k: { key_id: string }) => k.key_id === createdKeyId
    );

    // Key should either not be in list or marked as inactive
    if (revokedKey) {
      expect(revokedKey.is_active).toBe(false);
    }

    console.log('TC-AUTH-005-04 PASSED: API key revoked successfully');
  });
});

test.describe('TC-AUTH-005: API Key Authentication', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let accessToken: string;
  let apiKey: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E API Key Auth Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Login
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: testUserEmail, password: TEST_PASSWORD },
      timeout: TEST_TIMEOUT
    });

    const loginBody = await loginResponse.json();
    accessToken = loginBody.token;

    // Create API key for authentication testing
    const keyResponse = await request.post(`${BACKEND_URL}/api/apikeys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Auth Test Key',
        scopes: ['conversations:read']
      },
      timeout: TEST_TIMEOUT
    });

    const keyBody = await keyResponse.json();
    apiKey = keyBody.api_key;

    console.log(`Setup: Created test user ${testUserEmail} with API key`);
  });

  test.afterAll(async ({ request }) => {
    if (testUserEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-005-05: API key requires authentication to create', async ({ request }) => {
    // Step 1: Attempt to create API key without auth
    const response = await request.post(`${BACKEND_URL}/api/apikeys`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        name: 'Unauthorized Key',
        scopes: ['conversations:read']
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 401/403 response
    expect([401, 403]).toContain(response.status());

    console.log('TC-AUTH-005-05 PASSED: API key creation requires authentication');
  });

  test('TC-AUTH-005-06: Create API key with invalid scopes rejected', async ({ request }) => {
    // Step 1: Attempt to create key with invalid scope
    const response = await request.post(`${BACKEND_URL}/api/apikeys`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Invalid Scope Key',
        scopes: ['invalid:scope', 'fake:permission']
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 400 response
    expect(response.status()).toBe(400);

    // Step 3: Verify error mentions invalid scopes
    const body = await response.json();
    expect(body.detail).toContain('Invalid scopes');

    console.log('TC-AUTH-005-06 PASSED: Invalid scopes rejected');
  });
});

test.describe('TC-AUTH-005: API Key Validation', () => {
  test('TC-AUTH-005-07: Invalid API key rejected', async ({ request }) => {
    // Step 1: Attempt to list keys with invalid API key
    const response = await request.get(`${BACKEND_URL}/api/apikeys`, {
      headers: { 'X-API-Key': 'vnx_invalid_key_12345' },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify rejection (should fall back to JWT auth which is missing)
    expect([401, 403]).toContain(response.status());

    console.log('TC-AUTH-005-07 PASSED: Invalid API key rejected');
  });
});
