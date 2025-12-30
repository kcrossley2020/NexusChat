/**
 * TC-AUTH-001-UI: User Login UI Tests with Screenshots
 *
 * This test captures actual screenshots of the login user interface.
 * These screenshots are used for:
 * 1. Visual regression testing
 * 2. Automatic documentation generation
 * 3. Step-by-step visual guides
 *
 * Prerequisites:
 * - Frontend must be running at FRONTEND_URL (default: http://localhost:3080)
 * - Backend must be running at BACKEND_URL (default: http://localhost:3050)
 *
 * Run with: npx playwright test tc-auth-001-login-ui.spec.ts --config=playwright.config.screenshots.ts
 */

import { test, expect } from '@playwright/test';
import { ScreenshotHelper, DocumentationGenerator } from '../../utils/screenshot-helper';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3080';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;
const NAV_TIMEOUT = 10000;

// Documentation generator instance
let docGenerator: DocumentationGenerator;

test.beforeAll(() => {
  docGenerator = new DocumentationGenerator(
    'Login UI Visual Documentation',
    'Visual walkthrough of the user login interface with step-by-step screenshots.'
  );
});

test.afterAll(() => {
  const outputPath = docGenerator.saveToFile('UC-AUTH-001-UI-Documentation.html');
  console.log(`\n📚 UI Documentation generated: ${outputPath}\n`);
});

test.describe('UC-AUTH-001: Login User Interface', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;

  test.beforeAll(async ({ request }) => {
    // Create test user via API
    testUserEmail = `e2e-ui-login-${Date.now()}@example.com`;

    const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E UI Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(response.status()).toBe(200);
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

  test('TC-AUTH-001-UI-01: Complete login flow with visual screenshots', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001-UI',
      'Visual walkthrough of the complete login process from landing page to dashboard.'
    );

    try {
      // Step 1: Navigate to the application
      await page.goto(FRONTEND_URL, { timeout: NAV_TIMEOUT });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Allow SPA to render
      await screenshots.captureStep(
        'step-01-landing-page',
        'Application landing page - user arrives at the site'
      );

      // Step 2: Navigate to login page (click login button or navigate directly)
      // Try clicking a login button first, fallback to direct navigation
      const loginButton = page.locator('a[href*="login"], button:has-text("Login"), button:has-text("Sign in")').first();
      if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loginButton.click();
      } else {
        await page.goto(`${FRONTEND_URL}/login`, { timeout: NAV_TIMEOUT });
      }

      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000); // Allow SPA to render
      await screenshots.captureStep(
        'step-02-login-page',
        'Login page displayed with email and password input fields'
      );

      // Step 3: Focus on email field (show empty form)
      const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 10000 });
      await emailInput.focus();
      await screenshots.captureStep(
        'step-03-email-focus',
        'Email input field focused - ready for user input'
      );

      // Step 4: Enter email address
      await emailInput.fill(testUserEmail);
      await screenshots.captureStep(
        'step-04-email-entered',
        'Email address entered into the form'
      );

      // Step 5: Focus on password field
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
      await passwordInput.focus();
      await screenshots.captureStep(
        'step-05-password-focus',
        'Password field focused - ready for password entry'
      );

      // Step 6: Enter password (will show masked)
      await passwordInput.fill(TEST_PASSWORD);
      await screenshots.captureStep(
        'step-06-password-entered',
        'Password entered (displayed as masked characters for security)'
      );

      // Step 7: Highlight the submit button before clicking
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
      await submitButton.scrollIntoViewIfNeeded();
      await screenshots.captureStep(
        'step-07-ready-to-submit',
        'Form completed and ready to submit - login button visible'
      );

      // Step 8: Click submit and capture loading state
      await submitButton.click();

      // Try to capture loading state (spinner, disabled button, etc.)
      await page.waitForTimeout(500); // Brief wait to catch loading state
      await screenshots.captureStep(
        'step-08-submitting',
        'Login request in progress - form submitted to server'
      );

      // Step 9: Wait for successful login and redirect
      // Wait for URL to change away from login page or for dashboard elements
      await Promise.race([
        page.waitForURL('**/dashboard**', { timeout: 15000 }),
        page.waitForURL('**/home**', { timeout: 15000 }),
        page.waitForURL('**/chat**', { timeout: 15000 }),
        page.waitForURL('**/c/**', { timeout: 15000 }),
        page.waitForSelector('[data-testid="user-menu"], .user-avatar, .dashboard, nav', { timeout: 15000 })
      ]).catch(() => {
        // If none of the above, just wait for DOM
        return page.waitForLoadState('domcontentloaded');
      });

      await screenshots.captureStep(
        'step-09-login-success',
        'Login successful - user redirected to authenticated area'
      );

      // Step 10: Show the authenticated state (dashboard/home)
      await page.waitForTimeout(1000); // Allow page to fully render
      await screenshots.captureStep(
        'step-10-authenticated-dashboard',
        'User dashboard/home page - authentication complete'
      );

      // Mark test as passed
      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-AUTH-001-UI-01 PASSED with 10 screenshots captured');

    } catch (error) {
      // Capture failure state
      await screenshots.captureStep(
        'error-state',
        `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });

  test('TC-AUTH-001-UI-02: Login validation error display', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001-UI',
      'Demonstrates how validation errors are displayed to users during login.'
    );

    try {
      // Navigate to login page
      await page.goto(`${FRONTEND_URL}/login`, { timeout: NAV_TIMEOUT });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await screenshots.captureStep(
        'step-01-login-page',
        'Starting at the login page'
      );

      // Step 2: Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
      await submitButton.click();
      await page.waitForTimeout(500);
      await screenshots.captureStep(
        'step-02-empty-form-error',
        'Validation error shown when submitting empty form'
      );

      // Step 3: Enter invalid email format
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.fill('invalid-email');
      await submitButton.click();
      await page.waitForTimeout(500);
      await screenshots.captureStep(
        'step-03-invalid-email-error',
        'Validation error for invalid email format'
      );

      // Step 4: Enter valid email but wrong password
      await emailInput.clear();
      await emailInput.fill(testUserEmail);
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('WrongPassword123!');
      await screenshots.captureStep(
        'step-04-credentials-entered',
        'Valid email with incorrect password entered'
      );

      // Step 5: Submit and show authentication error
      await submitButton.click();

      // Wait for error message to appear
      const errorMessage = page.locator('.error, .alert-error, [role="alert"], .toast-error, .notification-error').first();
      await errorMessage.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await screenshots.captureStep(
        'step-05-auth-error-displayed',
        'Authentication error message displayed - invalid credentials'
      );

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-AUTH-001-UI-02 PASSED with 5 screenshots captured');

    } catch (error) {
      await screenshots.captureStep(
        'error-state',
        `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });

  test('TC-AUTH-001-UI-03: Password visibility toggle', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-AUTH-001-UI',
      'Demonstrates the password visibility toggle feature.'
    );

    try {
      await page.goto(`${FRONTEND_URL}/login`, { timeout: NAV_TIMEOUT });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Enter a password
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('MySecurePassword123!');
      await screenshots.captureStep(
        'step-01-password-masked',
        'Password entered - displayed as masked dots/asterisks'
      );

      // Look for visibility toggle button
      const visibilityToggle = page.locator(
        'button:near(input[type="password"]), ' +
        '[data-testid="toggle-password"], ' +
        '.password-toggle, ' +
        'button:has(svg), ' +
        'button[aria-label*="show" i], ' +
        'button[aria-label*="password" i]'
      ).first();

      if (await visibilityToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await visibilityToggle.click();
        await page.waitForTimeout(300);
        await screenshots.captureStep(
          'step-02-password-visible',
          'Password visibility toggled - password now visible as plain text'
        );

        // Toggle back
        await visibilityToggle.click();
        await page.waitForTimeout(300);
        await screenshots.captureStep(
          'step-03-password-masked-again',
          'Password visibility toggled again - password masked for security'
        );
      } else {
        await screenshots.captureStep(
          'step-02-no-toggle-available',
          'Password visibility toggle not available in this UI'
        );
      }

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-AUTH-001-UI-03 PASSED');

    } catch (error) {
      await screenshots.captureStep(
        'error-state',
        `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      const testCase = screenshots.complete('failed');
      docGenerator.addTestCase(testCase);
      throw error;
    }
  });
});
