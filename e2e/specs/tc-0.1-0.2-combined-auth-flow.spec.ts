/**
 * TC-0.1+0.2 Combined: Complete Authentication Flow
 *
 * This test validates the complete authentication flow by chaining:
 * - TC-0.1: Test user creation
 * - TC-0.2: Test user login and JWT token retrieval
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 *
 * Test Flow:
 * 1. Create test user via testing endpoint (TC-0.1)
 * 2. Immediately login with created credentials (TC-0.2)
 * 3. Verify JWT token is valid
 * 4. Decode and validate JWT payload
 * 5. Clean up test user
 *
 * This validates the E2E authentication bypass works end-to-end.
 */

import { test, expect } from '@playwright/test';

// Backend API URL
const BACKEND_URL = 'http://localhost:3050';

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

test.describe('TC-0.1+0.2: Complete Authentication Flow', () => {
  let testUserEmail: string;
  let testUserId: string;
  let testPassword: string;

  test('should create test user and immediately login to obtain JWT token', async ({ request }) => {
    test.setTimeout(60000); // 60 second timeout
    // Generate unique test user credentials
    testUserEmail = `e2e-combined-${Date.now()}@example.com`;
    testPassword = 'TestPass123!';

    // =================================================================
    // STEP 1: Create test user (TC-0.1)
    // =================================================================
    console.log('\n=== TC-0.1: Creating test user ===');
    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: testUserEmail,
        password: testPassword,
        organization_name: 'E2E Combined Test Org',
        account_type: 'trial',
      },
    });

    // Verify user creation succeeded
    expect(createResponse.status()).toBe(200);
    const createBody = await createResponse.json();

    expect(createBody).toHaveProperty('success');
    expect(createBody).toHaveProperty('user_id');
    expect(createBody).toHaveProperty('email');
    expect(createBody.success).toBe(true);
    expect(createBody.email).toBe(testUserEmail);

    testUserId = createBody.user_id;

    console.log('✓ Test user created successfully:', {
      user_id: testUserId,
      email: testUserEmail,
    });

    // =================================================================
    // STEP 2: Login with test user (TC-0.2)
    // =================================================================
    console.log('\n=== TC-0.2: Logging in with test user ===');
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: testUserEmail,
        password: testPassword,
      },
    });

    // Verify login succeeded
    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();

    expect(loginBody).toHaveProperty('success');
    expect(loginBody).toHaveProperty('message');
    expect(loginBody).toHaveProperty('token');
    expect(loginBody).toHaveProperty('user_id');

    expect(loginBody.success).toBe(true);
    expect(loginBody.message).toContain('Login successful');
    expect(loginBody.user_id).toBe(testUserId);
    expect(loginBody.token).toBeTruthy();

    const token = loginBody.token;

    console.log('✓ Login successful:', {
      user_id: loginBody.user_id,
      token_length: token.length,
    });

    // =================================================================
    // STEP 3: Verify JWT token payload
    // =================================================================
    console.log('\n=== Verifying JWT token payload ===');
    const decodedPayload = decodeJWT(token);

    // Verify JWT structure
    expect(decodedPayload).toHaveProperty('user_id');
    expect(decodedPayload).toHaveProperty('email');
    expect(decodedPayload).toHaveProperty('email_verified');
    expect(decodedPayload).toHaveProperty('exp');
    expect(decodedPayload).toHaveProperty('iat');

    // Verify JWT values
    expect(decodedPayload.user_id).toBe(testUserId);
    expect(decodedPayload.email).toBe(testUserEmail);
    expect(decodedPayload.email_verified).toBe(true); // Should be true for test users

    // Verify token expiration (should be 24 hours from now)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decodedPayload.exp - now;
    const expectedExpiry = 24 * 60 * 60; // 24 hours in seconds

    expect(expiresIn).toBeGreaterThan(expectedExpiry - 60); // Allow 1 minute tolerance
    expect(expiresIn).toBeLessThanOrEqual(expectedExpiry);

    // Verify issued at time is recent
    const issuedSecondsAgo = now - decodedPayload.iat;
    expect(issuedSecondsAgo).toBeLessThan(60); // Should be issued within last minute

    console.log('✓ JWT token valid:', {
      user_id: decodedPayload.user_id,
      email: decodedPayload.email,
      email_verified: decodedPayload.email_verified,
      expires_in_hours: Math.round(expiresIn / 3600),
      issued_seconds_ago: issuedSecondsAgo,
    });

    // =================================================================
    // STEP 4: Cleanup
    // =================================================================
    console.log('\n=== Cleaning up test user ===');
    try {
      const deleteResponse = await request.delete(
        `${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`
      );
      console.log(`✓ Cleanup attempted (status: ${deleteResponse.status()})`);
    } catch (error) {
      console.error('⚠️ Cleanup failed (expected due to Snowflake permissions):', error);
    }

    // =================================================================
    // FINAL SUMMARY
    // =================================================================
    console.log('\n=== ✓ COMBINED TEST PASSED ===');
    console.log('Successfully validated complete authentication flow:');
    console.log('  1. Test user created in Snowflake');
    console.log('  2. User logged in without email verification');
    console.log('  3. JWT token obtained and validated');
    console.log('  4. Token contains correct user information');
    console.log('=====================================\n');
  });

  test('should handle the complete flow with invalid credentials rejection', async ({ request }) => {
    test.setTimeout(60000); // 60 second timeout
    // Generate unique test user credentials
    const uniqueEmail = `e2e-combined-invalid-${Date.now()}@example.com`;
    const validPassword = 'TestPass123!';
    const invalidPassword = 'WrongPass123!';

    // Create test user
    console.log('\n=== Creating test user for invalid credential test ===');
    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: uniqueEmail,
        password: validPassword,
        organization_name: 'E2E Invalid Creds Test',
        account_type: 'trial',
      },
    });

    expect(createResponse.status()).toBe(200);
    const createBody = await createResponse.json();
    const userId = createBody.user_id;

    console.log('✓ Test user created');

    // Attempt login with INVALID password
    console.log('\n=== Attempting login with invalid password ===');
    const invalidLoginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: uniqueEmail,
        password: invalidPassword,
      },
    });

    // Verify login was rejected
    expect(invalidLoginResponse.status()).toBe(401);
    const invalidBody = await invalidLoginResponse.json();
    expect(invalidBody.detail).toContain('Invalid email or password');

    console.log('✓ Invalid password correctly rejected');

    // Now attempt login with VALID password
    console.log('\n=== Attempting login with valid password ===');
    const validLoginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: uniqueEmail,
        password: validPassword,
      },
    });

    // Verify login succeeded
    expect(validLoginResponse.status()).toBe(200);
    const validBody = await validLoginResponse.json();
    expect(validBody.success).toBe(true);
    expect(validBody.user_id).toBe(userId);

    console.log('✓ Valid password accepted, login successful');

    // Cleanup
    try {
      await request.delete(`${BACKEND_URL}/api/testing/delete-user/${uniqueEmail}`);
      console.log('✓ Cleanup attempted');
    } catch (error) {
      console.error('⚠️ Cleanup failed');
    }

    console.log('\n=== ✓ INVALID CREDENTIALS TEST PASSED ===\n');
  });
});
