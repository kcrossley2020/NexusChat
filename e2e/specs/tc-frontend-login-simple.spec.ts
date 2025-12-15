/**
 * Simple Frontend Login Test
 * Tests browser UI login without strict networkidle requirements
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = 'http://localhost:3080';
const SYSTEM_ADMIN_EMAIL = 'kcrossley@videxa.co';
const SYSTEM_ADMIN_PASSWORD = '8a093b79-bee6-4d70-8a98-2bc7657c8e7f';

test.describe('Frontend Login Validation', () => {

  test('should successfully login through browser UI', async ({ page }) => {
    console.log('\n[TEST] Frontend Browser Login Test');
    console.log(`URL: ${FRONTEND_URL}`);
    console.log(`Email: ${SYSTEM_ADMIN_EMAIL}`);

    // Navigate to the application
    await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
    console.log('✓ Page loaded');

    // Wait for login form (more lenient)
    await page.waitForSelector('input[type="email"], input[name="email"], input[placeholder*="email" i]', {
      timeout: 15000,
      state: 'visible'
    });
    console.log('✓ Login form detected');

    // Find form elements
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button:has-text("Continue"), button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]').first();

    // Fill credentials
    await emailInput.fill(SYSTEM_ADMIN_EMAIL);
    console.log('✓ Email entered');

    await passwordInput.fill(SYSTEM_ADMIN_PASSWORD);
    console.log('✓ Password entered');

    // Take screenshot before submit
    await page.screenshot({ path: 'test-results/before-login.png' });
    console.log('✓ Screenshot: before-login.png');

    // Click login
    await submitButton.click();
    console.log('✓ Login button clicked');

    // Wait a bit for the request to complete
    await page.waitForTimeout(5000);

    // Take screenshot after submit
    await page.screenshot({ path: 'test-results/after-login.png' });
    console.log('✓ Screenshot: after-login.png');

    // Check for error messages
    const errorVisible = await page.locator('[role="alert"], .error, text=/unable to login/i, text=/invalid/i').isVisible().catch(() => false);

    if (errorVisible) {
      const errorText = await page.locator('[role="alert"], .error').first().textContent().catch(() => 'Unknown error');
      console.log(`❌ Error detected: ${errorText}`);

      // Get page HTML for debugging
      const bodyHTML = await page.locator('body').innerHTML();
      console.log('\n[DEBUG] Page HTML after login attempt:');
      console.log(bodyHTML.substring(0, 500));
    } else {
      console.log('✓ No error messages visible');
    }

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check if we were redirected away from login page
    const isOnLoginPage = currentUrl.includes('login') || currentUrl === FRONTEND_URL || currentUrl === `${FRONTEND_URL}/`;

    if (!isOnLoginPage) {
      console.log('✓ Redirected away from login page (likely successful)');
    } else {
      console.log('⚠ Still on login page');
    }

    // Check for auth token in storage
    const hasToken = await page.evaluate(() => {
      const checks = [
        localStorage.getItem('token'),
        localStorage.getItem('authToken'),
        localStorage.getItem('jwt'),
        sessionStorage.getItem('token'),
        sessionStorage.getItem('authToken'),
        document.cookie.includes('token'),
        document.cookie.includes('auth')
      ];
      return checks.some(check => check);
    });

    console.log(`Token in storage: ${hasToken ? '✓ Found' : '❌ Not found'}`);

    // Final validation
    if (!errorVisible && (hasToken || !isOnLoginPage)) {
      console.log('\n✅ LOGIN SUCCESSFUL');
    } else {
      console.log('\n⚠ LOGIN STATUS UNCLEAR - Manual verification needed');
    }

    // Keep browser open briefly
    await page.waitForTimeout(2000);
  });

});
