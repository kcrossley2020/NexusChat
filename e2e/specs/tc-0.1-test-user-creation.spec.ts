/**
 * TC-0.1-UC0000: Test User Creation via API (Bypass Email Verification)
 *
 * This test validates that the authentication bypass endpoint works correctly
 * for automated E2E testing. It creates a test user directly in Snowflake
 * without requiring email verification.
 *
 * Prerequisites:
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 * - Snowflake connection configured
 *
 * Test Flow:
 * 1. Call POST /api/testing/create-user with test credentials
 * 2. Verify 200 response with user_id
 * 3. Verify response structure matches expected output
 * 4. Clean up test user after test
 */

import { test, expect } from '@playwright/test';

// Backend API URL
const BACKEND_URL = 'http://localhost:3050';

// Test user credentials
const TEST_USER = {
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  organization_name: 'E2E Test Organization',
  account_type: 'trial'
};

test.describe('TC-0.1: Test User Creation via API', () => {
  let createdUserId: string | null = null;
  let createdUserEmail: string | null = null;

  // Cleanup after test
  test.afterEach(async ({ request }) => {
    if (createdUserId && createdUserEmail) {
      try {
        const deleteResponse = await request.delete(
          `${BACKEND_URL}/api/testing/delete-user/${createdUserEmail}`
        );
        console.log(`Cleanup: Attempted to delete test user ${createdUserEmail} (status: ${deleteResponse.status()})`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
      // Reset for next test
      createdUserId = null;
      createdUserEmail = null;
    }
  });

  test('should create test user with email verification bypassed', async ({ request }) => {
    // Step 1: Call POST /api/testing/create-user
    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: TEST_USER,
    });

    // Step 2: Verify 200 response
    expect(response.status()).toBe(200);

    // Step 3: Verify response structure
    const responseBody = await response.json();

    // Check required fields
    expect(responseBody).toHaveProperty('success');
    expect(responseBody).toHaveProperty('user_id');
    expect(responseBody).toHaveProperty('email');
    expect(responseBody).toHaveProperty('message');

    // Verify field values
    expect(responseBody.success).toBe(true);
    expect(responseBody.email).toBe(TEST_USER.email);
    expect(responseBody.user_id).toBeTruthy();
    expect(typeof responseBody.user_id).toBe('string');
    expect(responseBody.message).toContain('Test user created successfully');

    // Store user_id and email for cleanup
    createdUserId = responseBody.user_id;
    createdUserEmail = responseBody.email;

    console.log('✓ Test user created successfully:', {
      user_id: responseBody.user_id,
      email: responseBody.email,
    });
  });

  test('should reject duplicate email registration', async ({ request }) => {
    // Use a unique email for this test to avoid conflicts with test 1
    const uniqueTestUser = {
      ...TEST_USER,
      email: `e2e-duplicate-${Date.now()}@example.com`,
    };

    // Create first user
    const firstResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: uniqueTestUser,
    });

    expect(firstResponse.status()).toBe(200);
    const firstBody = await firstResponse.json();
    createdUserId = firstBody.user_id;
    createdUserEmail = uniqueTestUser.email;

    // Attempt to create duplicate
    const duplicateResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: uniqueTestUser,
    });

    // Should fail with 409 Conflict
    expect(duplicateResponse.status()).toBe(409);

    const duplicateBody = await duplicateResponse.json();
    expect(duplicateBody.detail).toContain('already exists');

    console.log('✓ Duplicate email correctly rejected');
  });

  test('should reject invalid email format', async ({ request }) => {
    const invalidUser = {
      ...TEST_USER,
      email: 'invalid-email-format',
    };

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: invalidUser,
    });

    // Should fail with 422 Unprocessable Entity (Pydantic validation)
    expect(response.status()).toBe(422);

    console.log('✓ Invalid email format correctly rejected');
  });

  test('should reject weak password', async ({ request }) => {
    const weakPasswordUser = {
      ...TEST_USER,
      email: `e2e-weak-${Date.now()}@example.com`,
      password: 'weak',
    };

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: weakPasswordUser,
    });

    // Should fail with 422 Unprocessable Entity (Pydantic min_length validation)
    expect(response.status()).toBe(422);

    console.log('✓ Weak password correctly rejected');
  });
});

test.describe('TC-0.1: Testing Endpoint Security', () => {
  test('should return 404 when ENABLE_TESTING_ENDPOINTS=false', async ({ request }) => {
    // NOTE: This test will only pass if ENABLE_TESTING_ENDPOINTS is set to false
    // In normal E2E testing, this endpoint should be enabled, so this test
    // is more for documentation purposes

    // Skip this test if testing endpoints are enabled
    const healthResponse = await request.get(`${BACKEND_URL}/api/testing/health`);

    if (healthResponse.status() === 200) {
      console.log('⊘ Skipped: Testing endpoints are enabled (expected for E2E testing)');
      test.skip();
    }

    // If we get here, testing endpoints are disabled
    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: TEST_USER,
    });

    expect(response.status()).toBe(404);
    console.log('✓ Testing endpoint correctly returns 404 when disabled');
  });
});
