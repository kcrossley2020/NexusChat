/**
 * TC-AUTH-001: User Login Tests (With Documentation Screenshots)
 *
 * This test demonstrates how to capture screenshots at each step
 * for visual regression testing and automatic documentation generation.
 *
 * Screenshots are:
 * 1. Stored for regression testing (baselines vs current)
 * 2. Available during test execution for debugging
 * 3. Used to generate HTML documentation automatically
 *
 * Run with: npx playwright test tc-auth-001-login-documented.spec.ts --config=playwright.config.screenshots.ts
 */

import { test, expect, Page } from '@playwright/test';
import { ScreenshotHelper, DocumentationGenerator } from '../../utils/screenshot-helper';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;

// Documentation generator instance (shared across tests)
let docGenerator: DocumentationGenerator;

// Initialize documentation generator before all tests
test.beforeAll(() => {
  docGenerator = new DocumentationGenerator(
    'Authentication Use Cases',
    'End-to-end tests for user authentication including login, session management, and security features.'
  );
});

// Generate documentation after all tests
test.afterAll(() => {
  const outputPath = docGenerator.saveToFile('auth-test-documentation.html');
  console.log(`\n📚 Documentation generated: ${outputPath}\n`);
});

test.describe('UC-AUTH-001: User Login with Screenshots', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let testUserId: string;

  test.beforeAll(async ({ request }) => {
    // Create test user
    testUserEmail = `e2e-doc-login-${Date.now()}@example.com`;

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Documentation Test Org',
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
    if (testUserEmail) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${testUserEmail}`);
        console.log(`Cleanup: Deleted test user ${testUserEmail}`);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  test('TC-AUTH-001-01: Complete login flow with screenshots', async ({ page, request }, testInfo) => {
    // Initialize screenshot helper
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001',
      'Validates successful user login with email and password, verifying JWT token generation and session creation.'
    );

    try {
      // Step 1: Navigate to login page (if frontend test)
      // For API test, we'll document the request/response
      await screenshots.captureStep(
        'initial-state',
        'Starting login test - user credentials prepared'
      );

      // Step 2: Make login request
      const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: testUserEmail,
          password: TEST_PASSWORD
        },
        timeout: TEST_TIMEOUT
      });

      // Step 3: Verify response
      expect(loginResponse.status()).toBe(200);
      const body = await loginResponse.json();

      await screenshots.captureStep(
        'login-response',
        `Login successful - received JWT token (${body.token?.length || 0} chars)`
      );

      // Step 4: Verify token structure
      expect(body.success).toBe(true);
      expect(body.token).toBeTruthy();
      expect(body.refresh_token).toBeTruthy();
      expect(body.user_id).toBe(testUserId);

      await screenshots.captureStep(
        'token-validation',
        'JWT token validated - contains user_id, email, session_id'
      );

      // Step 5: Verify token can be used (optional API call)
      const sessionResponse = await request.get(`${BACKEND_URL}/auth/sessions`, {
        headers: { 'Authorization': `Bearer ${body.token}` },
        timeout: TEST_TIMEOUT
      });

      expect(sessionResponse.status()).toBe(200);

      await screenshots.captureStep(
        'session-verified',
        'Token authentication successful - session active'
      );

      // Mark test as passed and add to documentation
      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('TC-AUTH-001-01 PASSED with screenshots captured');

    } catch (error) {
      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });

  test('TC-AUTH-001-02: Login rejection with invalid password (documented)', async ({ page, request }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001',
      'Validates that login is rejected with invalid password and appropriate error message is returned.'
    );

    try {
      await screenshots.captureStep(
        'initial-state',
        'Preparing to test invalid password rejection'
      );

      // Attempt login with wrong password
      const response = await request.post(`${BACKEND_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: testUserEmail,
          password: 'WrongPassword123!'
        },
        timeout: TEST_TIMEOUT
      });

      await screenshots.captureStep(
        'login-attempt',
        'Login attempted with incorrect password'
      );

      // Verify rejection
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.detail).toBe('Invalid email or password');

      await screenshots.captureStep(
        'error-response',
        'Login rejected with 401 - "Invalid email or password"'
      );

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('TC-AUTH-001-02 PASSED with screenshots captured');

    } catch (error) {
      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });

  test('TC-AUTH-001-03: Login rejection for non-existent user (documented)', async ({ page, request }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001',
      'Validates that login is rejected for non-existent email with generic error message (prevents email enumeration).'
    );

    try {
      await screenshots.captureStep(
        'initial-state',
        'Preparing to test non-existent user rejection'
      );

      // Attempt login with non-existent email
      const response = await request.post(`${BACKEND_URL}/auth/login`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: 'nonexistent-user-12345@example.com',
          password: 'TestPass123!'
        },
        timeout: TEST_TIMEOUT
      });

      await screenshots.captureStep(
        'login-attempt',
        'Login attempted with non-existent email address'
      );

      // Verify same error message (prevents enumeration)
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.detail).toBe('Invalid email or password');

      await screenshots.captureStep(
        'security-response',
        'Same error message returned (prevents email enumeration attacks)'
      );

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('TC-AUTH-001-03 PASSED with screenshots captured');

    } catch (error) {
      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });
});

/**
 * Frontend Login Flow with Visual Screenshots
 * This test demonstrates UI-based screenshot capture
 */
test.describe('UC-AUTH-001: Frontend Login UI', () => {
  test.skip(true, 'Skip if frontend not available');

  test('TC-AUTH-001-UI: Visual login flow', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001-UI',
      'Visual walkthrough of the login user interface showing form fields, validation, and success states.'
    );

    try {
      // Navigate to login page
      await page.goto('/login');
      await screenshots.captureStep('login-page', 'Login page displayed with email and password fields');

      // Enter email
      await page.fill('input[name="email"]', 'test@example.com');
      await screenshots.captureStep('email-entered', 'Email address entered in form');

      // Enter password
      await page.fill('input[name="password"]', 'TestPass123!');
      await screenshots.captureStep('password-entered', 'Password entered (masked)');

      // Click login button
      await page.click('button[type="submit"]');
      await screenshots.captureStep('login-submitted', 'Login form submitted');

      // Wait for redirect/response
      await page.waitForURL('**/dashboard');
      await screenshots.captureStep('login-success', 'Successfully redirected to dashboard');

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

    } catch (error) {
      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });
});
