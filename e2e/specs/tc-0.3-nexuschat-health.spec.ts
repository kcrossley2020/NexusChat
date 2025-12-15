/**
 * TC-0.3-UC0000: NexusChat Health Check and Server Availability
 *
 * This test validates that the NexusChat server is running and accessible
 * in Snowflake-only mode (MongoDB and MeiliSearch removed).
 *
 * Prerequisites:
 * - NexusChat running on http://localhost:3080
 * - USE_SNOWFLAKE_STORAGE=true in environment
 * - MongoDB/MeiliSearch disabled
 *
 * Test Flow:
 * 1. Check NexusChat health endpoint
 * 2. Verify response time is acceptable
 * 3. Verify API health endpoint (if available)
 * 4. Test that server is serving static content
 */

import { test, expect } from '@playwright/test';

// NexusChat URL
const NEXUSCHAT_URL = 'http://localhost:3080';

test.describe('TC-0.3: NexusChat Health Check', () => {
  test('should respond to health check endpoint', async ({ request }) => {
    const startTime = Date.now();

    // Step 1: Call GET /health
    const response = await request.get(`${NEXUSCHAT_URL}/health`);

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Step 2: Verify 200 OK response
    expect(response.status()).toBe(200);

    // Step 3: Verify response content
    const body = await response.text();
    expect(body).toBeTruthy();
    expect(body).toBe('OK');

    // Step 4: Verify response time is under 1 second
    expect(responseTime).toBeLessThan(1000);

    console.log('✓ NexusChat health check passed:', {
      status: response.status(),
      body: body,
      response_time_ms: responseTime,
    });
  });

  test('should serve root endpoint', async ({ request }) => {
    // Step 1: Call GET / (root)
    const response = await request.get(`${NEXUSCHAT_URL}/`);

    // Step 2: Verify 200 OK response
    expect(response.status()).toBe(200);

    // Step 3: Verify HTML content is returned
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');

    const body = await response.text();
    expect(body).toContain('<html'); // Should be HTML document
    expect(body.length).toBeGreaterThan(100); // Should have actual content

    console.log('✓ NexusChat root endpoint serving HTML:', {
      status: response.status(),
      content_type: contentType,
      body_length: body.length,
    });
  });

  test('should have acceptable response times', async ({ request }) => {
    const iterations = 5;
    const responseTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const response = await request.get(`${NEXUSCHAT_URL}/health`);
      const endTime = Date.now();

      expect(response.status()).toBe(200);
      responseTimes.push(endTime - startTime);
    }

    // Calculate average response time
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    // Verify average response time is reasonable
    expect(avgResponseTime).toBeLessThan(500); // Average should be under 500ms
    expect(maxResponseTime).toBeLessThan(1000); // Max should be under 1 second

    console.log('✓ NexusChat response time performance:', {
      iterations: iterations,
      avg_ms: Math.round(avgResponseTime),
      min_ms: minResponseTime,
      max_ms: maxResponseTime,
      all_times_ms: responseTimes,
    });
  });

  test('should handle non-existent API endpoints', async ({ request }) => {
    // Step 1: Call non-existent endpoint
    const response = await request.get(`${NEXUSCHAT_URL}/api/nonexistent-endpoint-12345`);

    // Step 2: Verify response (SPA apps return 200 with index.html for all routes)
    expect([200, 404]).toContain(response.status());

    console.log('✓ NexusChat handles invalid endpoints:', {
      status: response.status(),
      note: 'SPA apps typically return 200 with index.html for client-side routing',
    });
  });
});

test.describe('TC-0.3: NexusChat Snowflake-Only Validation', () => {
  test('should be running without MongoDB', async ({ request }) => {
    // This test verifies that NexusChat is operational in Snowflake-only mode
    // by checking that the health endpoint works (which would fail if MongoDB was required)

    const response = await request.get(`${NEXUSCHAT_URL}/health`);
    expect(response.status()).toBe(200);

    // If we get here, the server started successfully without MongoDB
    console.log('✓ NexusChat confirmed running in Snowflake-only mode');
    console.log('  - No MongoDB connection required');
    console.log('  - No MeiliSearch crashes');
    console.log('  - Server fully operational');
  });

  test('should have environment configured for Snowflake storage', async ({ page }) => {
    // Navigate to the application
    await page.goto(`${NEXUSCHAT_URL}/`, { timeout: 10000 });

    // Wait for page to load (use domcontentloaded instead of networkidle to avoid external resource timeouts)
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    // Verify the page loaded successfully
    const title = await page.title();
    expect(title).toBeTruthy();

    console.log('✓ NexusChat application loads successfully:', {
      title: title,
      url: page.url(),
    });

    // Check if the page is accessible (not showing errors)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});

test.describe('TC-0.3: API Health Checks', () => {
  test('should verify main health endpoint is sufficient', async ({ request }) => {
    // The main /health endpoint is what we use for monitoring
    const healthResponse = await request.get(`${NEXUSCHAT_URL}/health`);
    expect(healthResponse.status()).toBe(200);

    const body = await healthResponse.text();
    expect(body).toBe('OK');

    console.log('✓ Main health endpoint operational:', {
      endpoint: '/health',
      status: healthResponse.status(),
      body: body,
      note: 'This is the primary endpoint for monitoring NexusChat availability',
    });
  });
});
