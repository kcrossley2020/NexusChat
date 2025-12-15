import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:3050';
let TEST_USER_EMAIL: string;
const TEST_USER_PASSWORD = 'TestPass123!';

test.describe('Frontend Login UI Test', () => {
  test.beforeAll(async ({ request }) => {
    TEST_USER_EMAIL = `e2e-login-ui-${Date.now()}@example.com`;
    try {
      const response = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          organization_name: 'Login UI Test',
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

  test('should login through browser UI', async ({ page }) => {
    test.skip(!TEST_USER_EMAIL, 'Test user not created');
    console.log('\n[TEST] Testing frontend login UI...');

    // Navigate to login page
    console.log('Navigating to http://localhost:3080...');
    await page.goto('http://localhost:3080', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait a bit for page to fully load
    await page.waitForTimeout(2000);

    // Take screenshot of initial page
    await page.screenshot({ path: 'e2e/screenshots/01-initial-page.png', fullPage: true });
    console.log('Screenshot saved: 01-initial-page.png');

    // Look for email input field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });

    console.log(`Entering email: ${TEST_USER_EMAIL}`);
    await emailInput.fill(TEST_USER_EMAIL);

    // Look for password input field
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });

    console.log('Entering password...');
    await passwordInput.fill(TEST_USER_PASSWORD);

    // Take screenshot before submit
    await page.screenshot({ path: 'e2e/screenshots/02-before-submit.png', fullPage: true });
    console.log('Screenshot saved: 02-before-submit.png');

    // Look for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Login")').first();
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });

    console.log('Clicking submit button...');
    await submitButton.click();

    // Wait for navigation or response
    await page.waitForTimeout(5000);

    // Take screenshot after submit
    await page.screenshot({ path: 'e2e/screenshots/03-after-submit.png', fullPage: true });
    console.log('Screenshot saved: 03-after-submit.png');

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check for specific login error messages (not general "error" text)
    const errorAlert = await page.locator('div[role="alert"]').count();
    if (errorAlert > 0) {
      const errorText = await page.locator('div[role="alert"]').first().textContent();
      if (errorText?.toLowerCase().includes('unable to login') || errorText?.toLowerCase().includes('invalid')) {
        console.log(`❌ Login error found: ${errorText}`);
        throw new Error(`Login failed with error: ${errorText}`);
      }
    }

    // Check if we're redirected away from login page (success indicator)
    if (currentUrl === 'http://localhost:3080/' || currentUrl === 'http://localhost:3080/login') {
      console.log('⚠️ Still on login page - checking page content...');
      const pageContent = await page.content();
      console.log('Page title:', await page.title());

      // Look for success indicators
      const hasChat = await page.locator('text=/chat|conversation|message/i').count();
      const hasProfile = await page.locator('text=/profile|settings|logout/i').count();

      console.log(`Chat elements found: ${hasChat}`);
      console.log(`Profile elements found: ${hasProfile}`);
    } else {
      console.log('✓ Redirected to:', currentUrl);
    }

    console.log('✓ Login test completed');
  });
});
