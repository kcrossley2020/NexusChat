/**
 * TC-0.4: System Administrator Login Testing
 * ===========================================
 * Tests system administrator authentication with GUID password
 *
 * Test Coverage:
 * 1. System admin can login with GUID password
 * 2. JWT token contains correct admin privileges
 * 3. System admin account has special account_type
 * 4. Email verification is bypassed for system account
 * 5. Invalid credentials are rejected
 *
 * Prerequisites:
 * - System admin created in Snowflake via setup-system-admin-manual.sql
 * - Admin email: kcrossley@videxa.co
 * - Admin password: 8a093b79-bee6-4d70-8a98-2bc7657c8e7f
 */

import { test, expect } from '@playwright/test';

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';

// System Admin Credentials
const SYSTEM_ADMIN_EMAIL = 'kcrossley@videxa.co';
const SYSTEM_ADMIN_PASSWORD = '8a093b79-bee6-4d70-8a98-2bc7657c8e7f';
const SYSTEM_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Decode JWT token payload (without verification)
 * Used for testing purposes only
 */
function decodeJWT(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const payload = parts[1];
  const decoded = Buffer.from(payload, 'base64').toString('utf-8');
  return JSON.parse(decoded);
}

test.describe('TC-0.4: System Administrator Login', () => {

  test('should allow system admin to login with GUID password', async ({ request }) => {
    console.log('\n[TEST] System admin login with GUID password...');
    console.log(`Email: ${SYSTEM_ADMIN_EMAIL}`);
    console.log(`Password: ${SYSTEM_ADMIN_PASSWORD}`);

    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: SYSTEM_ADMIN_PASSWORD,
      },
    });

    console.log(`Response status: ${response.status()}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    console.log(`✓ Login successful`);
    console.log(`  User ID: ${body.user_id}`);
    console.log(`  Token length: ${body.token?.length} chars`);

    expect(body.user_id).toBe(SYSTEM_ADMIN_USER_ID);
    expect(body.token).toBeDefined();
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.expires_in).toBeDefined();
  });

  test('should return JWT token with system admin privileges', async ({ request }) => {
    console.log('\n[TEST] Validating system admin JWT token payload...');

    // Login
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: SYSTEM_ADMIN_PASSWORD,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    const token = loginBody.token;

    console.log(`✓ Token received: ${token.substring(0, 50)}...`);

    // Decode and validate JWT payload
    const decodedPayload = decodeJWT(token);

    console.log('Token payload:');
    console.log(`  user_id: ${decodedPayload.user_id}`);
    console.log(`  email: ${decodedPayload.email}`);
    console.log(`  email_verified: ${decodedPayload.email_verified}`);
    console.log(`  account_type: ${decodedPayload.account_type}`);

    // Validate required fields
    expect(decodedPayload.user_id).toBe(SYSTEM_ADMIN_USER_ID);
    expect(decodedPayload.email).toBe(SYSTEM_ADMIN_EMAIL);
    expect(decodedPayload.email_verified).toBe(true);

    // Validate account type is system_admin
    expect(decodedPayload.account_type).toBe('system_admin');

    // Validate token expiration (should be ~24 hours = 86400 seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresIn = decodedPayload.exp - currentTime;
    const expectedExpiry = 86400; // 24 hours in seconds

    console.log(`  Token expires in: ${expiresIn} seconds (~${Math.round(expiresIn / 3600)} hours)`);

    expect(expiresIn).toBeGreaterThan(expectedExpiry - 60); // Allow 60s variance
    expect(expiresIn).toBeLessThan(expectedExpiry + 60);

    // Validate issued time is recent (within last minute)
    const issuedSecondsAgo = currentTime - decodedPayload.iat;
    console.log(`  Token issued: ${issuedSecondsAgo} seconds ago`);
    expect(issuedSecondsAgo).toBeLessThan(60);

    console.log('✓ All JWT payload validations passed');
  });

  test('should reject invalid password for system admin', async ({ request }) => {
    console.log('\n[TEST] System admin with invalid password...');

    const response = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: 'wrong-password-123',
      },
    });

    console.log(`Response status: ${response.status()}`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    console.log(`Response: ${JSON.stringify(body)}`);

    expect(body.detail).toBe('Invalid email or password');
    console.log('✓ Invalid credentials correctly rejected');
  });

  test('should verify system admin has email_verified set to true', async ({ request }) => {
    console.log('\n[TEST] Verifying system admin email verification status...');

    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: SYSTEM_ADMIN_PASSWORD,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    const token = loginBody.token;

    // Decode JWT
    const decodedPayload = decodeJWT(token);

    console.log(`Email Verified: ${decodedPayload.email_verified}`);

    // System admin should have email_verified = true (bypassed)
    expect(decodedPayload.email_verified).toBe(true);

    console.log('✓ System admin email verification bypassed correctly');
  });

  test('should verify system admin account cannot be created via testing endpoint', async ({ request }) => {
    console.log('\n[TEST] Attempting to create duplicate system admin via testing endpoint...');

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: 'any-password',
        organization_name: 'Test Org',
        account_type: 'trial',
      },
    });

    console.log(`Response status: ${response.status()}`);

    // Should fail with validation error (422) or database error (500)
    expect([422, 500]).toContain(response.status());

    const body = await response.json();
    console.log(`Response: ${JSON.stringify(body)}`);

    // Email should be protected (validation error or duplicate key error)
    expect(body.detail).toBeTruthy();

    console.log('✓ System admin email protected from duplicate creation');
  });

  test('should verify system admin has special account type', async ({ request }) => {
    console.log('\n[TEST] Verifying system admin account type...');

    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: SYSTEM_ADMIN_EMAIL,
        password: SYSTEM_ADMIN_PASSWORD,
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    const token = loginBody.token;

    // Decode JWT
    const decodedPayload = decodeJWT(token);

    console.log(`Account Type: ${decodedPayload.account_type}`);
    console.log(`User ID: ${decodedPayload.user_id}`);
    console.log(`Organization: ${decodedPayload.organization_name || 'N/A'}`);

    // Verify account_type is system_admin (not trial, pro, or enterprise)
    expect(decodedPayload.account_type).toBe('system_admin');
    expect(decodedPayload.user_id).toBe(SYSTEM_ADMIN_USER_ID);

    console.log('✓ System admin has correct account type');
  });

  test('should maintain persistent user ID for system admin', async ({ request }) => {
    console.log('\n[TEST] Verifying system admin has persistent user ID...');

    // Login multiple times and verify same user ID
    const login1 = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: SYSTEM_ADMIN_EMAIL, password: SYSTEM_ADMIN_PASSWORD },
    });

    const login2 = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: SYSTEM_ADMIN_EMAIL, password: SYSTEM_ADMIN_PASSWORD },
    });

    expect(login1.status()).toBe(200);
    expect(login2.status()).toBe(200);

    const body1 = await login1.json();
    const body2 = await login2.json();

    console.log(`First login user ID: ${body1.user_id}`);
    console.log(`Second login user ID: ${body2.user_id}`);

    // User ID should be identical
    expect(body1.user_id).toBe(SYSTEM_ADMIN_USER_ID);
    expect(body2.user_id).toBe(SYSTEM_ADMIN_USER_ID);
    expect(body1.user_id).toBe(body2.user_id);

    console.log('✓ System admin maintains persistent user ID');
  });

});
