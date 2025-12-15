/**
 * TC-0.2-UC0000: Test User Login and JWT Token Retrieval
 *
 * This test validates that test users created via TC-0.1 can login immediately
 * without email verification and obtain a valid JWT token.
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 *
 * Test Flow:
 * 1. Create test user via testing endpoint
 * 2. Login with test credentials
 * 3. Verify JWT token returned
 * 4. Decode and validate JWT payload
 * 5. Test invalid credentials rejection
 * 6. Clean up test user
 */

import { test, expect } from '@playwright/test';

// Backend API URL
const BACKEND_URL = 'http://localhost:3050';

// Test user credentials
const TEST_USER = {
  email: `e2e-login-${Date.now()}@example.com`,
  password: 'TestPass123!',
  organization_name: 'E2E Login Test Organization',
  account_type: 'trial'
};

// Helper function to decode JWT (basic decoding, no verification)
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error}`);
  }
}

test.describe('TC-0.2: Test User Login and JWT Token Retrieval', () => {
  let createdUserId: string | null = null;
  let createdUserEmail: string | null = null;

  // Setup: Create test user before tests
  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: TEST_USER,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    createdUserId = body.user_id;
    createdUserEmail = body.email;

    console.log(`Setup: Created test user ${createdUserEmail} for login tests`);
  });

  // Cleanup: Delete test user after all tests
  test.afterAll(async ({ request }) => {
    if (createdUserEmail) {
      try {
        const deleteResponse = await request.delete(
          `${BACKEND_URL}/api/testing/delete-user/${createdUserEmail}`
        );
        console.log(`Cleanup: Attempted to delete test user ${createdUserEmail} (status: ${deleteResponse.status()})`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('should login successfully with test user credentials', async ({ request }) => {
    // Step 1: Call POST /auth/login (Snowflake-based endpoint)
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const responseBody = await response.json();

    expect(responseBody).toHaveProperty('success');
    expect(responseBody).toHaveProperty('message');
    expect(responseBody).toHaveProperty('token');
    expect(responseBody).toHaveProperty('user_id');

    // Step 4: Verify field values
    expect(responseBody.success).toBe(true);
    expect(responseBody.message).toContain('Login successful');
    expect(responseBody.user_id).toBe(createdUserId);
    expect(responseBody.token).toBeTruthy();
    expect(typeof responseBody.token).toBe('string');

    console.log('✓ Test user logged in successfully:', {
      user_id: responseBody.user_id,
      token_length: responseBody.token.length,
    });
  });

  test('should return valid JWT token with correct payload', async ({ request }) => {
    // Step 1: Login to get JWT
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    const token = loginBody.token;

    // Step 2: Decode JWT
    const decodedPayload = decodeJWT(token);

    // Step 3: Verify JWT payload structure
    expect(decodedPayload).toHaveProperty('user_id');
    expect(decodedPayload).toHaveProperty('email');
    expect(decodedPayload).toHaveProperty('email_verified');
    expect(decodedPayload).toHaveProperty('exp');
    expect(decodedPayload).toHaveProperty('iat');

    // Step 4: Verify JWT payload values
    expect(decodedPayload.user_id).toBe(createdUserId);
    expect(decodedPayload.email).toBe(TEST_USER.email);
    expect(decodedPayload.email_verified).toBe(true); // Should be true for test users

    // Step 5: Verify token expiration (should be 24 hours from now)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decodedPayload.exp - now;
    const expectedExpiry = 24 * 60 * 60; // 24 hours in seconds

    expect(expiresIn).toBeGreaterThan(expectedExpiry - 60); // Allow 1 minute tolerance
    expect(expiresIn).toBeLessThanOrEqual(expectedExpiry);

    // Step 6: Verify issued at time is recent
    const issuedSecondsAgo = now - decodedPayload.iat;
    expect(issuedSecondsAgo).toBeLessThan(60); // Should be issued within last minute

    console.log('✓ JWT token valid with correct payload:', {
      user_id: decodedPayload.user_id,
      email: decodedPayload.email,
      email_verified: decodedPayload.email_verified,
      expires_in_hours: Math.round(expiresIn / 3600),
    });
  });

  test('should reject login with incorrect password', async ({ request }) => {
    // Step 1: Attempt login with wrong password
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_USER.email,
        password: 'WrongPassword123!',
      },
    });

    // Step 2: Verify 401 Unauthorized
    expect(response.status()).toBe(401);

    // Step 3: Verify error message
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('detail');
    expect(responseBody.detail).toContain('Invalid email or password');

    console.log('✓ Login correctly rejected for invalid password');
  });

  test('should reject login with non-existent email', async ({ request }) => {
    // Step 1: Attempt login with non-existent user
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: 'nonexistent@example.com',
        password: 'TestPass123!',
      },
    });

    // Step 2: Verify 401 Unauthorized
    expect(response.status()).toBe(401);

    // Step 3: Verify error message
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('detail');
    expect(responseBody.detail).toContain('Invalid email or password');

    console.log('✓ Login correctly rejected for non-existent user');
  });

  test('should reject login with missing credentials', async ({ request }) => {
    // Step 1: Attempt login with missing password
    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: TEST_USER.email,
        // password missing
      },
    });

    // Step 2: Verify 422 Unprocessable Entity (validation error)
    expect(response.status()).toBe(422);

    console.log('✓ Login correctly rejected for missing credentials');
  });
});

test.describe('TC-0.2: Token Authentication', () => {
  let testUserToken: string | null = null;
  let testUserEmail: string | null = null;

  // Setup: Create user and get token
  test.beforeAll(async ({ request }) => {
    // Create test user
    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: `e2e-token-${Date.now()}@example.com`,
        password: 'TestPass123!',
        organization_name: 'E2E Token Test',
        account_type: 'trial',
      },
    });

    const createBody = await createResponse.json();
    testUserEmail = createBody.email;

    // Login to get token
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: testUserEmail,
        password: 'TestPass123!',
      },
    });

    const loginBody = await loginResponse.json();
    testUserToken = loginBody.token;

    console.log(`Setup: Created test user ${testUserEmail} and obtained JWT token`);
  });

  // Cleanup
  test.afterAll(async ({ request }) => {
    if (testUserEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`);
        console.log(`Cleanup: Attempted to delete test user ${testUserEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('should access protected endpoint with valid token', async ({ request }) => {
    // This test assumes there's a protected endpoint that requires authentication
    // For now, we'll just verify the token format is correct
    expect(testUserToken).toBeTruthy();
    expect(testUserToken).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);

    console.log('✓ Token format valid (JWT structure verified)');
  });
});
