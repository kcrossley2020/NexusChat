/**
 * Playwright Configuration for Screenshot-Based Testing
 *
 * This configuration enables:
 * 1. Screenshot capture on every test step
 * 2. Baseline storage for visual regression
 * 3. HTML report with embedded screenshots
 * 4. Documentation generation support
 *
 * Use this config for:
 * - Visual regression testing
 * - Documentation generation
 * - Test case validation with screenshots
 *
 * Run with: npx playwright test --config=playwright.config.screenshots.ts
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3080';

export default defineConfig({
  testDir: 'specs/',
  outputDir: 'specs/.test-results',

  // Run tests sequentially to ensure consistent screenshots
  fullyParallel: false,
  workers: 1,

  // Don't fail fast - capture all screenshots even if some tests fail
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for screenshot consistency

  // Extended timeouts for screenshot capture
  timeout: 60000,
  expect: {
    timeout: 15000,
    // Visual comparison settings
    toHaveScreenshot: {
      threshold: 0.2, // 20% pixel difference allowed
      animations: 'disabled',
      scale: 'device',
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  // Rich reporting with screenshots
  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',
      attachmentsBaseURL: './screenshots/'
    }],
    ['json', {
      outputFile: 'test-results.json'
    }],
    ['list', { printSteps: true }]
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on', // Capture trace for all tests
    video: 'on', // Record video for all tests
    screenshot: 'on', // Capture screenshot after each test

    // Browser settings for consistent screenshots
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,

    ignoreHTTPSErrors: true,
    headless: true,

    // Consistent locale/timezone for screenshots
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Action timeouts
    navigationTimeout: 30000,
    actionTimeout: 15000,

    // Extra HTTP headers (e.g., for API testing)
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  // Snapshot directory for visual regression baselines
  snapshotDir: './screenshots/baselines',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  projects: [
    // Desktop Chrome - Primary
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Desktop Firefox - Secondary
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Tablet view
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro 11'],
      },
    },

    // Mobile view
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],

  // Global setup/teardown for screenshot tests
  globalSetup: require.resolve('./setup/screenshot-global-setup'),
  globalTeardown: require.resolve('./setup/screenshot-global-teardown'),
});
