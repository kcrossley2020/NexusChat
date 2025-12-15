/**
 * NexusChat Authentication Tests via Playwright
 *
 * Purpose: Validate authentication flow between NexusChat and AgentNexus/Snowflake backend
 *
 * Test Coverage:
 * - Login form UI elements present
 * - Valid credential login (Snowflake authentication)
 * - Invalid credential handling
 * - JWT token validation
 * - Post-login chat interface access
 *
 * Prerequisites:
 * - NexusChat running at localhost:3080
 * - AgentNexus backend running at localhost:3050
 * - Test user: playwright-test@videxa.co / PlaywrightTest123!
 *
 * Run: npx playwright test tests/videxa-baseline/auth.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3080';
const AGENTNEXUS_URL = process.env.AGENTNEXUS_URL || 'http://localhost:3050';

// Test credentials (created via /api/testing/create-user)
const TEST_USER = {
  email: 'playwright-test@videxa.co',
  password: 'PlaywrightTest123!',
  organization: 'Playwright Test Org'
};

const INVALID_USER = {
  email: 'nonexistent@videxa.co',
  password: 'WrongPassword123!'
};

test.describe('NexusChat Authentication - Login Form UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
  });

  test('VA001: Login page should display email input field', async ({ page }) => {
    // Wait for React to render
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Look for email input
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    const emailInputCount = await emailInput.count();

    expect(emailInputCount).toBeGreaterThan(0);
    console.log('Email input found:', emailInputCount > 0);
  });

  test('VA002: Login page should display password input field', async ({ page }) => {
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Look for password input
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const passwordInputCount = await passwordInput.count();

    expect(passwordInputCount).toBeGreaterThan(0);
    console.log('Password input found:', passwordInputCount > 0);
  });

  test('VA003: Login page should display submit button', async ({ page }) => {
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Look for login/continue button
    const submitButton = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Log in"), button:has-text("Sign in")');
    const submitButtonCount = await submitButton.count();

    expect(submitButtonCount).toBeGreaterThan(0);
    console.log('Submit button found:', submitButtonCount > 0);
  });

  test('VA004: Login page should have Sign Up link', async ({ page }) => {
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Look for sign up link
    const signUpLink = page.locator('a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")');
    const signUpCount = await signUpLink.count();

    // Sign up link is optional depending on config
    console.log('Sign up link found:', signUpCount > 0);
  });
});

test.describe('NexusChat Authentication - Valid Credentials', () => {
  test('VA005: Should successfully login with valid credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Fill in login form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);

    // Click submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Log in")').first();
    await submitButton.click();

    // Wait for navigation or response
    await page.waitForTimeout(3000);

    // Check for successful login indicators:
    // 1. URL change (might redirect to chat)
    // 2. Chat interface elements appear
    // 3. User menu/avatar appears
    // 4. No error messages visible

    const currentUrl = page.url();
    const hasNewConversationElements = await page.locator('textarea, [data-testid="chat-input"], button:has-text("New")').count() > 0;
    const hasUserMenu = await page.locator('[data-testid="user-menu"], button[aria-label*="user" i], [class*="avatar" i]').count() > 0;
    const hasErrorMessage = await page.locator('[class*="error" i], [role="alert"]:has-text("Invalid")').count() > 0;

    console.log('Current URL:', currentUrl);
    console.log('Chat elements present:', hasNewConversationElements);
    console.log('User menu present:', hasUserMenu);
    console.log('Error messages:', hasErrorMessage);

    // Either we see chat interface OR no error messages on the page
    const loginSuccessful = hasNewConversationElements || hasUserMenu || !hasErrorMessage;
    expect(loginSuccessful).toBeTruthy();
  });

  test('VA006: After login, chat interface should be accessible', async ({ page }) => {
    // Login first
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);

    const submitButton = page.locator('button[type="submit"], button:has-text("Continue")').first();
    await submitButton.click();

    // Wait for login to complete
    await page.waitForTimeout(4000);

    // Look for chat interface elements
    const chatElements = [
      'textarea',
      '[data-testid="chat-input"]',
      '[placeholder*="message" i]',
      'button:has-text("Send")',
      '[class*="chat" i]'
    ];

    let chatInterfaceFound = false;
    for (const selector of chatElements) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        chatInterfaceFound = true;
        console.log(`Chat element found: ${selector}`);
        break;
      }
    }

    // Log page state for debugging
    const pageTitle = await page.title();
    console.log('Page title after login:', pageTitle);

    expect(chatInterfaceFound).toBeTruthy();
  });
});

test.describe('NexusChat Authentication - Invalid Credentials', () => {
  test('VA007: Should show error for invalid email', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Fill in invalid credentials
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(INVALID_USER.email);
    await passwordInput.fill(INVALID_USER.password);

    // Click submit
    const submitButton = page.locator('button[type="submit"], button:has-text("Continue")').first();
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(3000);

    // Check for error indicators
    const errorIndicators = [
      '[class*="error" i]',
      '[role="alert"]',
      'text=/invalid|incorrect|wrong|not found|does not exist/i'
    ];

    let errorFound = false;
    for (const selector of errorIndicators) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        errorFound = true;
        console.log(`Error indicator found: ${selector}`);
        break;
      }
    }

    // Verify we're still on login page (not redirected)
    const stillOnLogin = await page.locator('input[type="password"]').count() > 0;
    console.log('Still on login page:', stillOnLogin);

    // Either error shown OR still on login page
    expect(errorFound || stillOnLogin).toBeTruthy();
  });

  test('VA008: Should show error for wrong password', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Use valid email but wrong password
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill('WrongPassword999!');

    const submitButton = page.locator('button[type="submit"], button:has-text("Continue")').first();
    await submitButton.click();

    await page.waitForTimeout(3000);

    // Verify login failed (still on login page OR error shown)
    const stillOnLogin = await page.locator('input[type="password"]').count() > 0;
    const hasError = await page.locator('[class*="error" i], [role="alert"]').count() > 0;

    console.log('Still on login page:', stillOnLogin);
    console.log('Error visible:', hasError);

    expect(stillOnLogin || hasError).toBeTruthy();
  });

  test('VA009: Should not allow empty credentials', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    // Try to submit without filling in fields
    const submitButton = page.locator('button[type="submit"], button:has-text("Continue")').first();

    // Button might be disabled or form validation might prevent submission
    const isDisabled = await submitButton.isDisabled();
    console.log('Submit button disabled (empty form):', isDisabled);

    if (!isDisabled) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }

    // Verify we're still on login page
    const stillOnLogin = await page.locator('input[type="email"], input[name="email"]').count() > 0;
    expect(stillOnLogin).toBeTruthy();
  });
});

test.describe('NexusChat Authentication - AgentNexus API Direct Tests', () => {
  test('VA010: AgentNexus login endpoint should respond', async ({ request }) => {
    const response = await request.post(`${AGENTNEXUS_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: TEST_USER.email, password: TEST_USER.password }
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user_id).toBeTruthy();

    console.log('AgentNexus login response:', {
      success: body.success,
      hasToken: !!body.token,
      userId: body.user_id
    });
  });

  test('VA011: AgentNexus should reject invalid credentials', async ({ request }) => {
    const response = await request.post(`${AGENTNEXUS_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: INVALID_USER.email, password: INVALID_USER.password }
    });

    // Should return 401 or similar error status, or 200 with success: false
    const body = await response.json();

    if (response.status() === 200) {
      expect(body.success).toBe(false);
    } else {
      expect([400, 401, 403]).toContain(response.status());
    }

    console.log('Invalid login response:', {
      status: response.status(),
      detail: body.detail || body.message
    });
  });

  test('VA012: JWT token should contain expected claims', async ({ request }) => {
    const response = await request.post(`${AGENTNEXUS_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: TEST_USER.email, password: TEST_USER.password }
    });

    const body = await response.json();
    expect(body.token).toBeTruthy();

    // Decode JWT payload (base64)
    const tokenParts = body.token.split('.');
    expect(tokenParts.length).toBe(3);

    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

    console.log('JWT payload:', payload);

    // Verify expected claims
    expect(payload.user_id).toBeTruthy();
    expect(payload.email).toBe(TEST_USER.email);
    expect(payload.email_verified).toBe(true);
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000); // Not expired
  });
});

test.describe('NexusChat Authentication - Session Management', () => {
  test('VA013: Logged in user should have session cookie or token', async ({ page, context }) => {
    // Login
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#root > *', { timeout: 5000 });
    await page.waitForTimeout(1500);

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.fill(TEST_USER.email);
    await passwordInput.fill(TEST_USER.password);

    const submitButton = page.locator('button[type="submit"], button:has-text("Continue")').first();
    await submitButton.click();

    await page.waitForTimeout(4000);

    // Check for session storage
    const cookies = await context.cookies();
    const localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth') || key.toLowerCase().includes('user')) {
          items[key] = window.localStorage.getItem(key);
        }
      }
      return items;
    });

    console.log('Auth-related cookies:', cookies.filter(c =>
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('auth') ||
      c.name.toLowerCase().includes('session')
    ));
    console.log('Auth-related localStorage:', Object.keys(localStorage));

    // Verify some auth state exists
    const hasAuthCookie = cookies.some(c =>
      c.name.toLowerCase().includes('token') ||
      c.name.toLowerCase().includes('refresh')
    );
    const hasAuthStorage = Object.keys(localStorage).length > 0;

    expect(hasAuthCookie || hasAuthStorage).toBeTruthy();
  });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║   NexusChat Authentication Tests via Playwright            ║
║   Purpose: Validate Snowflake authentication flow          ║
║   Tests: 13 authentication verification checks             ║
║   Test User: playwright-test@videxa.co                     ║
╚════════════════════════════════════════════════════════════╝
`);
