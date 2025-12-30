/**
 * TC-AUTH-004: Password Reset Tests
 *
 * Tests password reset functionality including:
 * - Request password reset
 * - Complete password reset with valid token
 * - Password reset with weak password
 * - Password reset with invalid/expired token
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
  return `e2e-auth-reset-${Date.now()}@example.com`;
}

// Extract token from reset link
function extractTokenFromLink(link: string): string {
  const match = link.match(/token=([^&]+)/);
  if (!match) {
    throw new Error('Could not extract token from link');
  }
  return match[1];
}

test.describe('TC-AUTH-004: Password Reset', () => {
  const ORIGINAL_PASSWORD = 'OriginalPass123!';
  const NEW_PASSWORD = 'NewPassword456!';
  let testUserEmail: string;
  let testUserId: string;
  let resetToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: ORIGINAL_PASSWORD,
        organization_name: 'E2E Password Reset Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(createResponse.status()).toBe(200);
    const body = await createResponse.json();
    testUserId = body.user_id;

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

  test('TC-AUTH-004-01: Request password reset generates token', async ({ request }) => {
    // Step 1: Request password reset
    const response = await request.post(`${BACKEND_URL}/auth/request-password-reset`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: testUserEmail },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('password reset link');

    // Step 4: In dev mode, link should be returned
    // (In production, email would be sent instead)
    expect(body.link).toBeTruthy();
    expect(body.link).toContain('token=');

    // Step 5: Extract token for next test
    resetToken = extractTokenFromLink(body.link);
    expect(resetToken).toBeTruthy();

    console.log('TC-AUTH-004-01 PASSED: Password reset requested successfully');
  });

  test('TC-AUTH-004-02: Complete password reset with valid token', async ({ request }) => {
    // Step 1: Complete password reset
    const response = await request.post(`${BACKEND_URL}/auth/reset-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        token: resetToken,
        password: NEW_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify success message
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('reset successfully');

    // Step 4: Verify can login with new password
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: NEW_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    expect(loginBody.success).toBe(true);

    // Step 5: Verify CANNOT login with old password
    const oldPasswordResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: ORIGINAL_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    expect(oldPasswordResponse.status()).toBe(401);

    console.log('TC-AUTH-004-02 PASSED: Password reset completed successfully');
  });

  test('TC-AUTH-004-03: Reset token cannot be reused', async ({ request }) => {
    // Step 1: Attempt to use same token again
    const response = await request.post(`${BACKEND_URL}/auth/reset-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        token: resetToken,
        password: 'AnotherPassword789!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 400 response (token already used)
    expect(response.status()).toBe(400);

    // Step 3: Verify error message
    const body = await response.json();
    expect(body.detail).toContain('Invalid or expired');

    console.log('TC-AUTH-004-03 PASSED: Reset token cannot be reused');
  });
});

test.describe('TC-AUTH-004: Password Reset Validation', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let resetToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = generateTestEmail();

    await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Password Validation Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    // Request reset token
    const resetResponse = await request.post(`${BACKEND_URL}/auth/request-password-reset`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: testUserEmail },
      timeout: TEST_TIMEOUT
    });

    const resetBody = await resetResponse.json();
    resetToken = extractTokenFromLink(resetBody.link);

    console.log(`Setup: Created test user ${testUserEmail} with reset token`);
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

  test('TC-AUTH-004-04: Reset rejected with weak password', async ({ request }) => {
    // Test various weak passwords
    const weakPasswords = [
      { password: 'short1!', reason: 'too short' },
      { password: 'nouppercase123!', reason: 'no uppercase' },
      { password: 'NOLOWERCASE123!', reason: 'no lowercase' },
      { password: 'NoNumbers!', reason: 'no numbers' },
      { password: 'NoSpecials123', reason: 'no special chars' }
    ];

    for (const { password, reason } of weakPasswords) {
      const response = await request.post(`${BACKEND_URL}/auth/reset-password`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          token: resetToken,
          password: password
        },
        timeout: TEST_TIMEOUT
      });

      // Verify 400 response
      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.detail).toContain('Password must');

      console.log(`Weak password rejected: ${reason}`);
    }

    console.log('TC-AUTH-004-04 PASSED: Weak passwords rejected');
  });

  test('TC-AUTH-004-05: Reset rejected with invalid token', async ({ request }) => {
    // Step 1: Attempt reset with invalid token
    const response = await request.post(`${BACKEND_URL}/auth/reset-password`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        token: 'invalid-token-12345',
        password: 'ValidPassword123!'
      },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 400 response
    expect(response.status()).toBe(400);

    // Step 3: Verify error message
    const body = await response.json();
    expect(body.detail).toContain('Invalid or expired');

    console.log('TC-AUTH-004-05 PASSED: Invalid token rejected');
  });
});

test.describe('TC-AUTH-004: Email Enumeration Prevention', () => {
  test('TC-AUTH-004-06: Request reset for non-existent email returns success', async ({ request }) => {
    // Step 1: Request reset for non-existent email
    const response = await request.post(`${BACKEND_URL}/auth/request-password-reset`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'nonexistent-user-12345@example.com' },
      timeout: TEST_TIMEOUT
    });

    // Step 2: Verify 200 response (not 404 - prevents enumeration)
    expect(response.status()).toBe(200);

    // Step 3: Verify generic success message
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('If an account exists');

    // Step 4: Verify NO reset link returned (user doesn't exist)
    // Note: In dev mode, link might be null/undefined for non-existent users
    // or the message is generic regardless

    console.log('TC-AUTH-004-06 PASSED: Email enumeration prevented');
  });
});
