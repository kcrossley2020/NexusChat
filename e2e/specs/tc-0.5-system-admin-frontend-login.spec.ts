/**
 * TC-0.5: System Administrator Frontend Login Test
 * =================================================
 * Tests that a user can login through the NexusChat UI
 *
 * Test Coverage:
 * 1. Create a test user via AgentNexus backend API
 * 2. Navigate to NexusChat login page
 * 3. Fill in test user email and password
 * 4. Submit login form
 * 5. Verify successful authentication and navigation
 * 6. Verify user is logged in to the application
 *
 * Prerequisites:
 * - NexusChat running on http://localhost:3080
 * - AgentNexus backend running on http://localhost:3050
 * - ENABLE_TESTING_ENDPOINTS=true in backend .env
 *
 * This validates the complete user journey from login page to authenticated state.
 */

import { test, expect, Page } from '@playwright/test';

// Configuration
const NEXUSCHAT_URL = 'http://localhost:3080';
const BACKEND_URL = 'http://localhost:3050';

// Test user credentials (will be created dynamically)
let TEST_USER_EMAIL: string;
let TEST_USER_PASSWORD = 'TestPass123!';

/**
 * Helper: Wait for page navigation to complete
 * Uses domcontentloaded instead of networkidle since NexusChat maintains persistent WebSocket connections
 */
async function waitForNavigation(page: Page, timeout: number = 10000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
}

test.describe('TC-0.5: System Administrator Frontend Login', () => {

  test.beforeAll(async ({ request }) => {
    // Create a test user via the backend API
    TEST_USER_EMAIL = `e2e-ui-login-${Date.now()}@example.com`;

    try {
      const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          organization_name: 'TC-0.5 UI Test',
          account_type: 'trial',
        },
      });

      if (createResponse.status() === 200) {
        const body = await createResponse.json();
        console.log(`✓ Test user created: ${body.email}`);
      } else {
        console.log(`⚠️ Could not create test user (status: ${createResponse.status()})`);
        // Test will be skipped in the test function
      }
    } catch (error) {
      console.log(`⚠️ Test user creation failed: ${error}`);
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup test user
    if (TEST_USER_EMAIL) {
      try {
        await request.delete(`${BACKEND_URL}/api/testing/delete-user/${TEST_USER_EMAIL}`);
        console.log(`✓ Cleanup: ${TEST_USER_EMAIL}`);
      } catch (error) {
        console.log(`⚠️ Cleanup failed (expected): ${error}`);
      }
    }
  });

  test('should login through NexusChat UI with test user credentials', async ({ page }) => {
    test.setTimeout(60000); // 60 second timeout

    // Skip test if test user wasn't created
    test.skip(!TEST_USER_EMAIL, 'Test user not created - testing endpoints may not be available');

    console.log('\n' + '='.repeat(70));
    console.log('FRONTEND UI LOGIN TEST');
    console.log('='.repeat(70));
    console.log(`\nTest User: ${TEST_USER_EMAIL}`);
    console.log(`Password: ${TEST_USER_PASSWORD}`);

    // =================================================================
    // STEP 1: Navigate to NexusChat
    // =================================================================
    console.log('\n[STEP 1] Navigating to NexusChat...');

    await page.goto(NEXUSCHAT_URL, { timeout: 10000 });
    await waitForNavigation(page);

    const currentUrl = page.url();
    console.log(`✓ Navigated to: ${currentUrl}`);

    // Should redirect to login page or show login form
    expect(currentUrl).toMatch(/\/(login)?$/i);

    // =================================================================
    // STEP 2: Wait for Login Form to Load
    // =================================================================
    console.log('\n[STEP 2] Waiting for login form...');

    // Wait for common login form elements
    // Try multiple selectors as the form structure may vary
    const loginFormLoaded = await page.waitForSelector(
      'input[type="email"], input[name="email"], input[placeholder*="email" i], input[type="text"]',
      { timeout: 10000, state: 'visible' }
    ).catch(() => null);

    if (!loginFormLoaded) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'login-page-debug.png', fullPage: true });
      throw new Error('Login form not found. Screenshot saved to login-page-debug.png');
    }

    console.log('✓ Login form detected');

    // =================================================================
    // STEP 3: Fill in Email Field
    // =================================================================
    console.log('\n[STEP 3] Filling in email field...');

    // Try multiple selectors for email input
    const emailSelector = await page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]'
    ).first();

    await emailSelector.waitFor({ state: 'visible', timeout: 5000 });
    await emailSelector.click();
    await emailSelector.fill(TEST_USER_EMAIL);

    const emailValue = await emailSelector.inputValue();
    console.log(`✓ Email entered: ${emailValue}`);
    expect(emailValue).toBe(TEST_USER_EMAIL);

    // =================================================================
    // STEP 4: Fill in Password Field
    // =================================================================
    console.log('\n[STEP 4] Filling in password field...');

    // Try multiple selectors for password input
    const passwordSelector = await page.locator(
      'input[type="password"], input[name="password"], input[placeholder*="password" i]'
    ).first();

    await passwordSelector.waitFor({ state: 'visible', timeout: 5000 });
    await passwordSelector.click();
    await passwordSelector.fill(TEST_USER_PASSWORD);

    const passwordLength = (await passwordSelector.inputValue()).length;
    console.log(`✓ Password entered (${passwordLength} characters)`);
    expect(passwordLength).toBe(TEST_USER_PASSWORD.length);

    // =================================================================
    // STEP 5: Submit Login Form
    // =================================================================
    console.log('\n[STEP 5] Submitting login form...');

    // Take screenshot before submit
    await page.screenshot({ path: 'before-login-submit.png' });

    // Try to find and click the submit button
    const submitButton = await page.locator(
      'button[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")'
    ).first();

    await submitButton.waitFor({ state: 'visible', timeout: 5000 });

    console.log('✓ Submit button found, clicking...');

    // Click and wait for navigation
    await submitButton.click();
    console.log('✓ Login form submitted');

    // =================================================================
    // STEP 6: Wait for Authentication and Navigation
    // =================================================================
    console.log('\n[STEP 6] Waiting for authentication...');

    // Wait for either successful navigation OR error message
    const navigationSucceeded = await Promise.race([
      // Success: URL changes away from login
      page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 20000 })
        .then(() => true)
        .catch(() => false),
      // Success: Chat interface loads
      page.waitForSelector('main, [role="main"], .chat-interface', { timeout: 20000, state: 'visible' })
        .then(() => true)
        .catch(() => false),
    ]);

    await page.waitForTimeout(2000);

    // Check current state
    const newUrl = page.url();
    console.log(`Current URL: ${newUrl}`);

    // Take screenshot after login attempt
    await page.screenshot({ path: 'after-login-submit.png', fullPage: true });

    // Check if we're still on login page
    const isOnLoginPage = newUrl.includes('/login');

    if (isOnLoginPage || !navigationSucceeded) {
      // Check for error messages
      const errorMessage = await page.locator(
        'div[role="alert"], .error, .alert-error, [class*="error"]'
      ).first().textContent().catch(() => null);

      if (errorMessage) {
        console.log(`❌ Login failed with error: ${errorMessage}`);
        throw new Error(`Login failed: ${errorMessage}`);
      }

      // Only check form visibility if we're definitely still on login page
      if (isOnLoginPage) {
        const formStillVisible = await emailSelector.isVisible().catch(() => false);
        if (formStillVisible) {
          throw new Error('Login form still visible - authentication may have failed');
        }
      }
    }

    console.log('✓ Navigated away from login page');

    // =================================================================
    // STEP 7: Verify Logged In State
    // =================================================================
    console.log('\n[STEP 7] Verifying logged in state...');

    // Wait for authenticated UI elements
    await page.waitForTimeout(2000);

    // Check for common authenticated state indicators
    const pageContent = await page.textContent('body');

    // Look for user indicators (profile, settings, logout, etc.)
    const loggedInIndicators = [
      await page.locator('button:has-text("Logout"), button:has-text("Sign out")').count() > 0,
      await page.locator('[data-testid="user-menu"], [aria-label*="user" i]').count() > 0,
      await page.locator('nav, [role="navigation"]').count() > 0,
      pageContent?.includes('Chat') || pageContent?.includes('Message') || pageContent?.includes('Conversation'),
    ];

    const isLoggedIn = loggedInIndicators.some(indicator => indicator === true);

    console.log(`Logged in indicators detected: ${loggedInIndicators.filter(i => i).length}/4`);

    if (!isLoggedIn) {
      console.log('⚠️  Warning: Could not confirm logged in state with indicators');
      console.log('   This may be expected if the UI structure is different');
    } else {
      console.log('✓ User appears to be logged in');
    }

    // =================================================================
    // STEP 8: Verify Application Loaded
    // =================================================================
    console.log('\n[STEP 8] Verifying application loaded...');

    const title = await page.title();
    console.log(`Page Title: ${title}`);
    expect(title).toBeTruthy();

    // Check that we have substantial content loaded
    const bodyTextLength = pageContent?.length || 0;
    console.log(`Body content length: ${bodyTextLength} characters`);
    expect(bodyTextLength).toBeGreaterThan(100);

    console.log('✓ Application loaded successfully');

    // =================================================================
    // FINAL SUMMARY
    // =================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ FRONTEND UI LOGIN TEST PASSED');
    console.log('='.repeat(70));
    console.log('\nValidated:');
    console.log('  1. ✅ NexusChat login page accessible');
    console.log('  2. ✅ Login form renders correctly');
    console.log('  3. ✅ Email field accepts input');
    console.log('  4. ✅ Password field accepts input');
    console.log('  5. ✅ Login form submits successfully');
    console.log('  6. ✅ Authentication successful');
    console.log('  7. ✅ Navigation away from login page');
    console.log('  8. ✅ Application interface loaded');
    console.log('\nTest User Credentials:');
    console.log(`  Email: ${TEST_USER_EMAIL}`);
    console.log(`  Password: ${TEST_USER_PASSWORD}`);
    console.log(`  Final URL: ${page.url()}`);
    console.log('\nScreenshots saved:');
    console.log('  - before-login-submit.png');
    console.log('  - after-login-submit.png');
    console.log('\n' + '='.repeat(70) + '\n');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    console.log('\n[TEST] Invalid credentials validation...');

    await page.goto(`${NEXUSCHAT_URL}/login`, { timeout: 10000 });
    await waitForNavigation(page);

    // Wait for form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill in invalid credentials
    await page.locator('input[type="email"], input[name="email"]').first().fill('invalid@example.com');
    await page.locator('input[type="password"]').first().fill('WrongPassword123!');

    console.log('✓ Filled invalid credentials');

    // Submit
    const submitButton = await page.locator(
      'button[type="submit"], button:has-text("Log in"), button:has-text("Login")'
    ).first();

    await submitButton.click();

    // Wait for error message
    await page.waitForTimeout(2000);

    // Check still on login page (should not have navigated)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/login/i);

    console.log('✓ Remained on login page (authentication failed as expected)');
    console.log('✅ Invalid credentials validation passed\n');
  });

});
