/**
 * TC-AUTH-002: Token Refresh Tests
 *
 * Tests the token refresh functionality including:
 * - Successful token refresh with rotation
 * - Token refresh rejected with expired token
 * - Token reuse attack detection
 * - Suspicious activity detection
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 */

import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;

// Helper function to decode JWT payload
function decodeJWT(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
  return JSON.parse(payload);
}

// Generate unique test email
function generateTestEmail(): string {
  return `e2e-auth-refresh-${Date.now()}@example.com`;
}

test.describe('TC-AUTH-002: Token Refresh', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let accessToken: string;
  let refreshToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Refresh Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(createResponse.status()).toBe(200);

    // Login to get initial tokens
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
    refreshToken = body.refresh_token;

    console.log(`Setup: Created test user ${testUserEmail} and obtained tokens`);
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

  test('TC-AUTH-002-01: Successful token refresh with rotation', async ({ request }) => {
    // Step 1: Refresh token
    const response = await request.post(`${BACKEND_URL}/auth/refresh`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        refresh_token: refreshToken
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Token refreshed');
    expect(body.token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(body.expires_in).toBe(900); // 15 minutes

    // Step 4: Verify NEW access token is different from original
    expect(body.token).not.toBe(accessToken);

    // Step 5: Verify NEW refresh token is different from original (rotation)
    expect(body.refresh_token).not.toBe(refreshToken);

    // Step 6: Verify new tokens have same session_id
    const newAccessPayload = decodeJWT(body.token);
    const newRefreshPayload = decodeJWT(body.refresh_token);
    expect(newAccessPayload.session_id).toBe(newRefreshPayload.session_id);

    // Step 7: Verify new refresh token has different JTI
    const oldRefreshPayload = decodeJWT(refreshToken);
    expect(newRefreshPayload.jti).not.toBe(oldRefreshPayload.jti);

    // Update tokens for subsequent tests
    accessToken = body.token;
    refreshToken = body.refresh_token;

    console.log('TC-AUTH-002-01 PASSED: Token refresh successful with rotation');
  });

  test('TC-AUTH-002-02: Refresh rejected with invalid token', async ({ request }) => {
    // Step 1: Attempt refresh with invalid token
    const response = await request.post(`${BACKEND_URL}/auth/refresh`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        refresh_token: 'invalid.token.here'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 401 response
    expect(response.status()).toBe(401);

    // Step 3: Verify error message
    const body = await response.json();
    expect(body.detail).toContain('Invalid refresh token');

    console.log('TC-AUTH-002-02 PASSED: Refresh rejected for invalid token');
  });

  test('TC-AUTH-002-03: Refresh rejected with access token (wrong type)', async ({ request }) => {
    // Step 1: Attempt refresh with access token instead of refresh token
    const response = await request.post(`${BACKEND_URL}/auth/refresh`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        refresh_token: accessToken // Using access token instead of refresh
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 401 response
    expect(response.status()).toBe(401);

    // Step 3: Verify error message
    const body = await response.json();
    expect(body.detail).toContain('Invalid token type');

    console.log('TC-AUTH-002-03 PASSED: Refresh rejected for wrong token type');
  });
});

test.describe('TC-AUTH-002: Token Reuse Detection', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let originalRefreshToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Reuse Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(createResponse.status()).toBe(200);
    console.log(`Setup: Created test user ${testUserEmail} for reuse detection test`);
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

  test('TC-AUTH-002-04: Token reuse attack detection', async ({ request }) => {
    // Step 1: Login to get fresh tokens
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    originalRefreshToken = loginBody.refresh_token;

    // Step 2: Use refresh token successfully (this rotates it)
    const firstRefreshResponse = await request.post(`${BACKEND_URL}/auth/refresh`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        refresh_token: originalRefreshToken
      },
      timeout: TEST_TIMEOUT
    });

    expect(firstRefreshResponse.status()).toBe(200);

    // Step 3: Attempt to REUSE the original (now-invalid) refresh token
    const reuseResponse = await request.post(`${BACKEND_URL}/auth/refresh`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        refresh_token: originalRefreshToken // Attempting to reuse rotated token
      },
      timeout: TEST_TIMEOUT
    });

    // Step 4: Verify 401 response - token reuse detected
    expect(reuseResponse.status()).toBe(401);

    // Step 5: Verify security message about token reuse
    const body = await reuseResponse.json();
    expect(body.detail).toContain('Token reuse detected');

    console.log('TC-AUTH-002-04 PASSED: Token reuse attack detected and prevented');
  });
});
