/**
 * TC-AUTH-001: User Login Tests
 *
 * Tests the user login functionality including:
 * - Successful login with valid credentials
 * - Login rejection with invalid password
 * - Login rejection with non-existent user
 * - Session creation on successful login
 * - Token format validation
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
  return `e2e-auth-login-${Date.now()}@example.com`;
}

test.describe('TC-AUTH-001: User Login', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let testUserId: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Auth Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    testUserId = body.user_id;
    console.log(`Setup: Created test user ${testUserEmail}`);
  });

  test.afterAll(async ({ request }) => {
    // Cleanup test user
    if (testUserEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`);
        console.log(`Cleanup: Deleted test user ${testUserEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-001-01: Successful login returns valid tokens', async ({ request }) => {
    // Step 1: Login with valid credentials
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('Login successful');
    expect(body.token).toBeTruthy();
    expect(body.refresh_token).toBeTruthy();
    expect(body.user_id).toBe(testUserId);
    expect(body.expires_in).toBe(900); // 15 minutes in seconds

    // Step 4: Verify access token is valid JWT
    const accessPayload = decodeJWT(body.token);
    expect(accessPayload.user_id).toBe(testUserId);
    expect(accessPayload.email).toBe(testUserEmail);
    expect(accessPayload.email_verified).toBe(true);
    expect(accessPayload.token_type).toBe('access');
    expect(accessPayload.session_id).toBeTruthy();
    expect(accessPayload.exp).toBeTruthy();
    expect(accessPayload.iat).toBeTruthy();

    // Step 5: Verify refresh token is valid JWT
    const refreshPayload = decodeJWT(body.refresh_token);
    expect(refreshPayload.user_id).toBe(testUserId);
    expect(refreshPayload.token_type).toBe('refresh');
    expect(refreshPayload.jti).toBeTruthy(); // Unique token ID
    expect(refreshPayload.session_id).toBeTruthy();

    // Step 6: Verify session was created (same session_id in both tokens)
    expect(accessPayload.session_id).toBe(refreshPayload.session_id);

    console.log('TC-AUTH-001-01 PASSED: Login successful with valid tokens');
  });

  test('TC-AUTH-001-02: Login rejected with invalid password', async ({ request }) => {
    // Step 1: Attempt login with wrong password
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: 'WrongPassword123!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 401 response
    expect(response.status()).toBe(401);

    // Step 3: Verify error message is generic (prevents password validation attacks)
    const body = await response.json();
    expect(body.detail).toBe('Invalid email or password');

    console.log('TC-AUTH-001-02 PASSED: Login rejected for invalid password');
  });

  test('TC-AUTH-001-03: Login rejected with non-existent user', async ({ request }) => {
    // Step 1: Attempt login with non-existent email
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: 'nonexistent-user@example.com',
        password: 'TestPass123!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 401 response
    expect(response.status()).toBe(401);

    // Step 3: Verify error message is same as invalid password (prevents enumeration)
    const body = await response.json();
    expect(body.detail).toBe('Invalid email or password');

    console.log('TC-AUTH-001-03 PASSED: Login rejected for non-existent user');
  });
});

test.describe('TC-AUTH-001: Login Edge Cases', () => {
  test('TC-AUTH-001-04: Login rejected with missing credentials', async ({ request }) => {
    // Step 1: Attempt login with missing password
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: 'test@example.com'
        // password missing
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 422 validation error
    expect(response.status()).toBe(422);

    console.log('TC-AUTH-001-04 PASSED: Login rejected for missing credentials');
  });

  test('TC-AUTH-001-05: Login rejected with invalid email format', async ({ request }) => {
    // Step 1: Attempt login with invalid email
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: 'not-an-email',
        password: 'TestPass123!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 422 validation error
    expect(response.status()).toBe(422);

    console.log('TC-AUTH-001-05 PASSED: Login rejected for invalid email format');
  });
});
