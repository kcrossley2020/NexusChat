/**
 * Debug Frontend Login Test
 * Tests the actual browser UI login with dynamically created test user
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3080';
const BACKEND_URL = 'http://localhost:3050';
let TEST_USER_EMAIL: string;
const TEST_USER_PASSWORD = 'TestPass123!';

test.describe('Frontend Login Debug', () => {
  test.beforeAll(async ({ request }) => {
    TEST_USER_EMAIL = `e2e-debug-login-${Date.now()}@example.com`;
    try {
      const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          organization_name: 'Debug Login Test',
          account_type: 'trial',
        },
      });
      if (response.status() === 200) {
        console.log(`✓ Test user created: ${TEST_USER_EMAIL}`);
      }
    } catch (e) {
      console.log('⚠️ Could not create test user');
    }
  });

  test.afterAll(async ({ request }) => {
    if (TEST_USER_EMAIL) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${TEST_USER_EMAIL}`);
      } catch (e) {}
    }
  });

  test('should login via browser UI', async ({ page }) => {
    test.skip(!TEST_USER_EMAIL, 'Test user not created');
    console.log('\n[TEST] Attempting frontend login via browser UI...');
    console.log(`URL: ${FRONTEND_URL}`);
    console.log(`Email: ${TEST_USER_EMAIL}`);
    console.log(`Password: ${TEST_USER_PASSWORD}`);

    // Navigate to the application
    await page.goto(FRONTEND_URL);
    console.log('✓ Navigated to frontend');

    // Wait for the login page to load
    await page.waitForLoadState('domcontentloaded');
    console.log('✓ Page loaded');

    // Take a screenshot before login
    await page.screenshot({ path: 'debug-before-login.png', fullPage: true });
    console.log('✓ Screenshot saved: debug-before-login.png');

    // Check if we're on the login page
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    // Look for login form elements
    const emailInput = page.locator('input[name="email"], input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[name="password"], input[type="password"], input[placeholder*="password" i]');
    const loginButton = page.locator('button:has-text("Continue"), button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]');

    // Wait for form to be visible
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Email input found');

    await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ Password input found');

    // Fill in the credentials
    await emailInput.fill(TEST_USER_EMAIL);
    console.log('✓ Email filled');

    await passwordInput.fill(TEST_USER_PASSWORD);
    console.log('✓ Password filled');

    // Take a screenshot after filling
    await page.screenshot({ path: 'debug-after-fill.png', fullPage: true });
    console.log('✓ Screenshot saved: debug-after-fill.png');

    // Click the login button
    await loginButton.click();
    console.log('✓ Login button clicked');

    // Wait for navigation or error message
    await page.waitForTimeout(3000);

    // Take a screenshot after login attempt
    await page.screenshot({ path: 'debug-after-login.png', fullPage: true });
    console.log('✓ Screenshot saved: debug-after-login.png');

    // Check for error messages
    const errorMessage = await page.locator('text=/unable to login/i, text=/invalid/i, text=/error/i, [role="alert"]').first().textContent().catch(() => null);

    if (errorMessage) {
      console.log(`❌ Error message found: ${errorMessage}`);
    } else {
      console.log('✓ No error message visible');
    }

    // Check if we got redirected (successful login)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check for localStorage token (common JWT storage)
    const token = await page.evaluate(() => {
      return localStorage.getItem('token') ||
             localStorage.getItem('authToken') ||
             localStorage.getItem('jwt') ||
             sessionStorage.getItem('token') ||
             sessionStorage.getItem('authToken');
    });

    if (token) {
      console.log(`✓ Token found in storage: ${token.substring(0, 50)}...`);
    } else {
      console.log('❌ No token found in storage');
    }

    // Check network requests
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('auth') || request.url().includes('login')) {
        requests.push(`${request.method()} ${request.url()}`);
      }
    });

    // Log all console messages from the browser
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    // Check for any visible errors in the page
    const allText = await page.locator('body').textContent();
    console.log(`\nPage contains "credentials": ${allText?.includes('credentials')}`);
    console.log(`Page contains "invalid": ${allText?.includes('invalid')}`);
    console.log(`Page contains "error": ${allText?.includes('error')}`);

    // If there's an error, let's debug the API call
    const apiResponse = await page.evaluate(async ({ email, password }) => {
      try {
        const response = await fetch('http://localhost:3050/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        return {
          status: response.status,
          ok: response.ok,
          data: data
        };
      } catch (error) {
        return {
          status: 0,
          ok: false,
          error: String(error)
        };
      }
    }, { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD });

    console.log('\n[API Test from Browser Context]');
    console.log(`Status: ${apiResponse.status}`);
    console.log(`OK: ${apiResponse.ok}`);
    console.log(`Response: ${JSON.stringify(apiResponse.data || apiResponse.error, null, 2)}`);

    // Keep browser open for debugging
    await page.waitForTimeout(5000);
  });

});
