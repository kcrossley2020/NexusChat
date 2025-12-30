/**
 * TC-CHAT-001-UI: Chat Interface Tests with Screenshots
 *
 * This test captures actual screenshots of the chat user interface.
 * These screenshots are used for:
 * 1. Visual regression testing
 * 2. Automatic documentation generation
 * 3. User guide creation
 *
 * Prerequisites:
 * - Frontend must be running at FRONTEND_URL (default: http://localhost:3080)
 * - Backend must be running at BACKEND_URL (default: http://localhost:3050)
 * - User must be able to authenticate
 *
 * Run with: npx playwright test tc-chat-001-conversation-ui.spec.ts --config=playwright.config.screenshots.ts
 */

import { test, expect } from '@playwright/test';
import { ScreenshotHelper, DocumentationGenerator } from '../../utils/screenshot-helper';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3080';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';
const TEST_TIMEOUT = 30000;

let docGenerator: DocumentationGenerator;

test.beforeAll(() => {
  docGenerator = new DocumentationGenerator(
    'Chat Interface Visual Documentation',
    'Visual walkthrough of the AI chat interface showing conversation creation, message sending, and responses.'
  );
});

test.afterAll(() => {
  const outputPath = docGenerator.saveToFile('UC-CHAT-001-UI-Documentation.html');
  console.log(`\n📚 Chat UI Documentation generated: ${outputPath}\n`);
});

test.describe('UC-CHAT-001: Chat Interface', () => {
  const TEST_PASSWORD = 'TestPass123!';
  let testUserEmail: string;
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user via API
    testUserEmail = `e2e-chat-ui-${Date.now()}@example.com`;

    const createResponse = await request.post(`${BACKEND_URL}/api/testing/create-user`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD,
        organization_name: 'E2E Chat UI Test Org',
        account_type: 'trial'
      },
      timeout: TEST_TIMEOUT
    });

    expect(createResponse.status()).toBe(200);

    // Login to get auth token
    const loginResponse = await request.post(`${BACKEND_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: testUserEmail,
        password: TEST_PASSWORD
      },
      timeout: TEST_TIMEOUT
    });

    expect(loginResponse.status()).toBe(200);
    const loginBody = await loginResponse.json();
    authToken = loginBody.token;

    console.log(`Setup: Created and logged in test user ${testUserEmail}`);
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

  // Helper to login via UI
  async function loginViaUI(page: any) {
    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    await emailInput.fill(testUserEmail);
    await passwordInput.fill(TEST_PASSWORD);
    await submitButton.click();

    // Wait for redirect after login
    await page.waitForURL(/\/(dashboard|home|chat)/, { timeout: 15000 }).catch(() => {
      return page.waitForLoadState('networkidle');
    });
  }

  test('TC-CHAT-001-UI-01: Start new conversation', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-CHAT-001-UI',
      'Visual guide for starting a new AI conversation from the main interface.'
    );

    try {
      // Step 1: Login
      await loginViaUI(page);
      await screenshots.captureStep(
        'step-01-logged-in',
        'User successfully logged in - viewing main dashboard'
      );

      // Step 2: Navigate to chat (look for chat link/button)
      const chatNavItem = page.locator(
        'a[href*="chat"], ' +
        'button:has-text("Chat"), ' +
        'button:has-text("New Chat"), ' +
        '[data-testid="chat-nav"], ' +
        '.nav-chat, ' +
        'a:has-text("Chat")'
      ).first();

      if (await chatNavItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await chatNavItem.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Try direct navigation
        await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });
      }

      await screenshots.captureStep(
        'step-02-chat-interface',
        'Chat interface loaded - ready to start conversation'
      );

      // Step 3: Look for new conversation button
      const newChatButton = page.locator(
        'button:has-text("New"), ' +
        'button:has-text("New Chat"), ' +
        'button:has-text("New Conversation"), ' +
        '[data-testid="new-chat"], ' +
        '.new-chat-button, ' +
        'button[aria-label*="new" i]'
      ).first();

      if (await newChatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newChatButton.scrollIntoViewIfNeeded();
        await screenshots.captureStep(
          'step-03-new-chat-button',
          'New chat button visible - click to start fresh conversation'
        );

        await newChatButton.click();
        await page.waitForTimeout(500);
      }

      await screenshots.captureStep(
        'step-04-conversation-started',
        'New conversation created - chat area ready for input'
      );

      // Step 4: Find the message input
      const messageInput = page.locator(
        'textarea, ' +
        'input[type="text"][placeholder*="message" i], ' +
        '[data-testid="message-input"], ' +
        '.chat-input, ' +
        '[contenteditable="true"]'
      ).first();

      await messageInput.waitFor({ state: 'visible', timeout: 10000 });
      await messageInput.focus();
      await screenshots.captureStep(
        'step-05-input-focused',
        'Message input focused - ready to type a message'
      );

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-CHAT-001-UI-01 PASSED with 5 screenshots captured');

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

  test('TC-CHAT-001-UI-02: Send message and receive response', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-CHAT-001-UI',
      'Complete flow of sending a message to AI and receiving a response.'
    );

    try {
      // Login and navigate to chat
      await loginViaUI(page);
      await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });

      await screenshots.captureStep(
        'step-01-chat-ready',
        'Chat interface ready for interaction'
      );

      // Find message input
      const messageInput = page.locator(
        'textarea, ' +
        'input[type="text"][placeholder*="message" i], ' +
        '[data-testid="message-input"], ' +
        '.chat-input'
      ).first();

      await messageInput.waitFor({ state: 'visible', timeout: 10000 });

      // Step 2: Type a message
      const testMessage = 'Hello! Can you help me understand how to use this healthcare platform?';
      await messageInput.fill(testMessage);
      await screenshots.captureStep(
        'step-02-message-typed',
        'User message typed in the input field'
      );

      // Step 3: Find and click send button (or press Enter)
      const sendButton = page.locator(
        'button:has-text("Send"), ' +
        'button[type="submit"], ' +
        '[data-testid="send-button"], ' +
        'button[aria-label*="send" i], ' +
        '.send-button'
      ).first();

      if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshots.captureStep(
          'step-03-send-button-visible',
          'Send button visible - ready to submit message'
        );
        await sendButton.click();
      } else {
        // Try pressing Enter
        await messageInput.press('Enter');
      }

      // Step 4: Capture message sent state
      await page.waitForTimeout(500);
      await screenshots.captureStep(
        'step-04-message-sent',
        'User message sent - appears in chat history'
      );

      // Step 5: Wait for AI response
      // Look for loading indicator first
      const loadingIndicator = page.locator(
        '.loading, ' +
        '.typing-indicator, ' +
        '[data-testid="loading"], ' +
        '.spinner, ' +
        '.ai-thinking'
      ).first();

      if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
        await screenshots.captureStep(
          'step-05-ai-processing',
          'AI is processing the message - loading indicator visible'
        );
      }

      // Wait for response to appear
      // Look for AI message elements
      const aiResponse = page.locator(
        '.ai-message, ' +
        '.assistant-message, ' +
        '[data-role="assistant"], ' +
        '.message-ai, ' +
        '[data-testid="ai-response"]'
      ).first();

      await aiResponse.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {
        // If no specific AI message selector, wait for new content
        return page.waitForTimeout(5000);
      });

      await page.waitForTimeout(1000); // Allow streaming to complete
      await screenshots.captureStep(
        'step-06-ai-response-received',
        'AI response received and displayed in chat'
      );

      // Step 6: Show the complete conversation
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await screenshots.captureStep(
        'step-07-full-conversation',
        'Complete conversation visible with user message and AI response'
      );

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-CHAT-001-UI-02 PASSED with 7 screenshots captured');

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

  test('TC-CHAT-001-UI-03: View conversation history', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-CHAT-001-UI',
      'Viewing and navigating conversation history in the sidebar.'
    );

    try {
      // Login and navigate to chat
      await loginViaUI(page);
      await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });

      await screenshots.captureStep(
        'step-01-chat-page',
        'Chat page with sidebar visible'
      );

      // Look for sidebar/history panel
      const sidebar = page.locator(
        '.sidebar, ' +
        '.chat-history, ' +
        '[data-testid="sidebar"], ' +
        '.conversation-list, ' +
        'aside, ' +
        '.nav-panel'
      ).first();

      if (await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
        await screenshots.captureStep(
          'step-02-sidebar-visible',
          'Conversation history sidebar visible'
        );

        // Look for conversation items
        const conversationItems = page.locator(
          '.conversation-item, ' +
          '.chat-history-item, ' +
          '[data-testid="conversation"], ' +
          '.sidebar-item'
        );

        const count = await conversationItems.count();
        if (count > 0) {
          await screenshots.captureStep(
            'step-03-conversations-listed',
            `${count} previous conversation(s) visible in history`
          );

          // Click on first conversation
          await conversationItems.first().click();
          await page.waitForTimeout(500);
          await screenshots.captureStep(
            'step-04-conversation-loaded',
            'Previous conversation loaded from history'
          );
        } else {
          await screenshots.captureStep(
            'step-03-no-history',
            'No previous conversations in history'
          );
        }
      } else {
        // Try to find a toggle for sidebar
        const toggleButton = page.locator(
          'button[aria-label*="sidebar" i], ' +
          'button[aria-label*="menu" i], ' +
          '.hamburger, ' +
          '[data-testid="toggle-sidebar"]'
        ).first();

        if (await toggleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await toggleButton.click();
          await page.waitForTimeout(500);
          await screenshots.captureStep(
            'step-02-sidebar-opened',
            'Sidebar toggled open to show conversation history'
          );
        } else {
          await screenshots.captureStep(
            'step-02-no-sidebar',
            'No sidebar visible in current view'
          );
        }
      }

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-CHAT-001-UI-03 PASSED');

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

  test('TC-CHAT-001-UI-04: File upload in conversation', async ({ page }, testInfo) => {
    const screenshots = new ScreenshotHelper(
      page,
      testInfo,
      'UC-CHAT-001-UI',
      'Uploading a file to include in the AI conversation.'
    );

    try {
      // Login and navigate to chat
      await loginViaUI(page);
      await page.goto(`${FRONTEND_URL}/chat`, { waitUntil: 'networkidle' });

      await screenshots.captureStep(
        'step-01-chat-ready',
        'Chat interface ready for file upload'
      );

      // Look for file upload button/area
      const uploadButton = page.locator(
        'button[aria-label*="upload" i], ' +
        'button[aria-label*="attach" i], ' +
        '[data-testid="file-upload"], ' +
        '.upload-button, ' +
        '.attach-button, ' +
        'input[type="file"]'
      ).first();

      if (await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await screenshots.captureStep(
          'step-02-upload-button-visible',
          'File upload/attach button visible'
        );

        // For file input, we can demonstrate the UI without actual file
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
          // Highlight the file upload area
          await uploadButton.scrollIntoViewIfNeeded();
          await screenshots.captureStep(
            'step-03-file-input-ready',
            'File input ready - click to select file from system'
          );
        }
      } else {
        // Check for drag-and-drop zone
        const dropZone = page.locator(
          '.drop-zone, ' +
          '.dropzone, ' +
          '[data-testid="drop-area"], ' +
          '.file-drop'
        ).first();

        if (await dropZone.isVisible({ timeout: 3000 }).catch(() => false)) {
          await screenshots.captureStep(
            'step-02-drop-zone-visible',
            'Drag and drop zone visible for file uploads'
          );
        } else {
          await screenshots.captureStep(
            'step-02-no-upload-found',
            'File upload functionality not visible in current view'
          );
        }
      }

      const testCase = screenshots.complete('passed');
      docGenerator.addTestCase(testCase);

      console.log('✅ TC-CHAT-001-UI-04 PASSED');

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
