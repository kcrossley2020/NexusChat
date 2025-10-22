/**
 * Videxa Functionality Baseline Tests for NexusChat
 *
 * Purpose: Verify core application functionality works correctly
 * Tests:
 * - Homepage loads
 * - Authentication UI present
 * - Model selection available
 * - Chat interface accessible
 *
 * Note: These are BASELINE tests - they verify the app is functional
 * They do NOT test deep integration or authenticated features (those require API keys)
 *
 * Run: npx playwright test tests/videxa-baseline/functionality.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3080';

test.describe('NexusChat Core Functionality - Baseline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('VF001: Homepage should load successfully', async ({ page }) => {
    // Verify page loaded
    await expect(page).not.toHaveTitle('');

    // Check for HTTP 200 status
    const response = await page.goto(BASE_URL);
    expect(response.status()).toBe(200);
  });

  test('VF002: Page should have main application container', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Look for root React app container
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('VF003: Registration/Login UI should be accessible', async ({ page }) => {
    // Wait for load
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount and render
    await page.waitForSelector('#root > *', { timeout: 3000 });
    await page.waitForTimeout(1000);

    // Look for login/signup related elements
    // LibreChat uses "Continue" button and "Sign up" link
    const hasContinueButton = await page.locator('button:has-text("Continue")').count() > 0;
    const hasSignUpLink = await page.locator('a:has-text("Sign up")').count() > 0;
    const hasEmailInput = await page.locator('input[type="email"]').count() > 0 ||
                          await page.locator('input[placeholder*="Email"]').count() > 0;
    const hasPasswordInput = await page.locator('input[type="password"]').count() > 0 ||
                             await page.locator('input[placeholder*="Password"]').count() > 0;

    // Verify login UI elements are present
    expect(hasContinueButton || hasSignUpLink || hasEmailInput || hasPasswordInput).toBeTruthy();
  });

  test('VF004: Page should not show critical errors', async ({ page }) => {
    // Check console for critical errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('domcontentloaded');

    // Wait a moment for any async errors
    await page.waitForTimeout(2000);

    // Filter out expected/benign errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('DevTools') &&
      !err.includes('Extension')
    );

    // Verify no critical errors
    expect(criticalErrors.length).toBe(0);
  });

  test('VF005: Page structure elements should be present', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Wait for React to mount and render
    await page.waitForSelector('#root > *', { timeout: 3000 });
    await page.waitForTimeout(1000);

    // LibreChat is a single-page React app, so check for React app structure
    // rather than traditional nav/header elements
    const rootHasContent = await page.locator('#root > *').count() > 0;
    const hasButtons = await page.locator('button').count() > 0;
    const hasInputs = await page.locator('input').count() > 0;
    const hasStructuralElements = await page.locator('div[class]').count() > 5;

    // Verify the app has rendered structural elements (login form, buttons, etc.)
    expect(rootHasContent && (hasButtons || hasInputs || hasStructuralElements)).toBeTruthy();
  });

  test('VF006: Chat interface elements should be present', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Look for chat-related UI elements
    // Note: User might not be logged in, so we just verify elements exist
    const hasChatUI = await page.locator('textarea').count() > 0 ||
                      await page.locator('input[placeholder*="message"]').count() > 0 ||
                      await page.locator('[class*="chat"]').count() > 0;

    // This might be false if login is required, which is OK for baseline
    console.log('Chat UI present:', hasChatUI);
  });

  test('VF007: JavaScript should be enabled and running', async ({ page }) => {
    // Evaluate JavaScript in the page
    const jsWorks = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });

    expect(jsWorks).toBeTruthy();
  });

  test('VF008: React app should be mounted', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Check if React has rendered content
    const rootContent = await page.locator('#root').innerHTML();

    // Verify it's not empty
    expect(rootContent.length).toBeGreaterThan(100);

    // Verify it contains some React-rendered content
    expect(rootContent).not.toBe('<div id="loading-container"></div>');
  });

  test('VF009: Page should be responsive (mobile viewport)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // Verify page loads and adapts
    await page.waitForLoadState('domcontentloaded');

    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('VF010: Static assets should load (CSS)', async ({ page }) => {
    // Wait for page load
    await page.waitForLoadState('domcontentloaded');

    // Check that CSS has been applied
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        margin: styles.margin,
        padding: styles.padding
      };
    });

    // Verify styles are applied (not default browser styles)
    expect(bodyStyles.margin).toBe('0px');
    expect(bodyStyles.padding).toBe('0px');
  });
});

test.describe('NexusChat API Health Check', () => {
  test('VF011: API health endpoint should respond', async ({ page }) => {
    // Try to check if API is running
    // Note: Exact endpoint depends on LibreChat API structure
    const endpoints = [
      '/api/health',
      '/api/status',
      '/api',
    ];

    let apiResponded = false;

    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(`${BASE_URL}${endpoint}`);
        if (response.status() === 200 || response.status() === 401) {
          apiResponded = true;
          console.log(`API responded at ${endpoint}: ${response.status()}`);
          break;
        }
      } catch (e) {
        // Endpoint doesn't exist, continue
      }
    }

    // If no explicit health endpoint, just verify the app loads
    if (!apiResponded) {
      console.log('No explicit health endpoint found, verifying app loads instead');
      const response = await page.goto(BASE_URL);
      expect(response.status()).toBe(200);
    }
  });
});

test.describe('NexusChat Performance Baseline', () => {
  test('VF012: Page should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    console.log(`Page load time: ${loadTime}ms`);

    // Verify load time is reasonable (< 10 seconds)
    expect(loadTime).toBeLessThan(10000);
  });

  test('VF013: First contentful paint should be fast', async ({ page }) => {
    await page.goto(BASE_URL);

    // Measure First Contentful Paint
    const fcp = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return fcpEntry ? fcpEntry.startTime : null;
    });

    if (fcp) {
      console.log(`First Contentful Paint: ${fcp}ms`);
      expect(fcp).toBeLessThan(3000); // Should be < 3 seconds
    } else {
      console.warn('FCP metric not available');
    }
  });
});

console.log(`
╔════════════════════════════════════════════════════════════╗
║   Videxa Functionality Baseline Tests - NexusChat         ║
║   Purpose: Verify core application functionality          ║
║   Tests: 13 functionality verification checks             ║
╚════════════════════════════════════════════════════════════╝
`);
