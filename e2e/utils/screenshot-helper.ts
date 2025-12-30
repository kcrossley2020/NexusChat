/**
 * Screenshot Helper for E2E Tests
 *
 * Provides utilities for:
 * 1. Capturing screenshots at each test step
 * 2. Storing baselines for regression testing
 * 3. Comparing current vs baseline screenshots
 * 4. Generating documentation from screenshots
 */

import { Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { screenshotConfig, TestStep, TestCase, TestSuite } from '../config/screenshot-config';

export class ScreenshotHelper {
  private page: Page;
  private testInfo: TestInfo;
  private testCase: TestCase;
  private stepCounter: number = 0;
  private screenshotPaths: string[] = [];

  constructor(page: Page, testInfo: TestInfo, useCase: string, description: string) {
    this.page = page;
    this.testInfo = testInfo;
    this.testCase = {
      id: testInfo.testId,
      name: testInfo.title,
      description: description,
      useCase: useCase,
      steps: [],
      startTime: new Date(),
      status: 'running'
    };

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = [
      screenshotConfig.screenshotsDir,
      screenshotConfig.baselinesDir,
      screenshotConfig.currentDir,
      screenshotConfig.diffDir,
      screenshotConfig.docsDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Capture a screenshot for a specific test step
   * Stores both current and baseline versions for regression testing
   */
  async captureStep(stepName: string, description: string): Promise<string> {
    this.stepCounter++;
    const timestamp = new Date();

    // Generate filename
    const sanitizedTestName = this.testInfo.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const sanitizedStepName = stepName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `${sanitizedTestName}-${screenshotConfig.stepPrefix}-${this.stepCounter}-${sanitizedStepName}.png`;

    // Paths for current run and baseline
    const currentPath = path.join(screenshotConfig.currentDir, filename);
    const baselinePath = path.join(screenshotConfig.baselinesDir, filename);

    // Capture screenshot
    await this.page.screenshot({
      path: currentPath,
      fullPage: screenshotConfig.settings.fullPage,
      animations: screenshotConfig.settings.animations
    });

    // If no baseline exists, create one
    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log(`📸 Created baseline: ${filename}`);
    } else {
      console.log(`📸 Captured: ${filename} (baseline exists for comparison)`);
    }

    // Record step
    const step: TestStep = {
      stepNumber: this.stepCounter,
      name: stepName,
      description: description,
      screenshotPath: currentPath,
      status: 'passed',
      timestamp: timestamp
    };

    this.testCase.steps.push(step);
    this.screenshotPaths.push(currentPath);

    // Attach to Playwright report
    await this.testInfo.attach(`Step ${this.stepCounter}: ${stepName}`, {
      path: currentPath,
      contentType: 'image/png'
    });

    return currentPath;
  }

  /**
   * Capture screenshot on action (before and after)
   */
  async captureAction(actionName: string, action: () => Promise<void>): Promise<void> {
    await this.captureStep(`before-${actionName}`, `Before: ${actionName}`);
    await action();
    await this.captureStep(`after-${actionName}`, `After: ${actionName}`);
  }

  /**
   * Complete the test and generate metadata
   */
  complete(status: 'passed' | 'failed'): TestCase {
    this.testCase.endTime = new Date();
    this.testCase.status = status;
    return this.testCase;
  }

  /**
   * Get all screenshot paths from this test
   */
  getScreenshotPaths(): string[] {
    return this.screenshotPaths;
  }

  /**
   * Get the test case data for documentation generation
   */
  getTestCase(): TestCase {
    return this.testCase;
  }
}

/**
 * Documentation Generator
 * Creates HTML documentation from test results and screenshots
 */
export class DocumentationGenerator {
  private testSuite: TestSuite;

  constructor(suiteName: string, description: string) {
    this.testSuite = {
      name: suiteName,
      description: description,
      testCases: [],
      generatedAt: new Date()
    };
  }

  addTestCase(testCase: TestCase): void {
    this.testSuite.testCases.push(testCase);
  }

  /**
   * Generate HTML documentation from all test cases
   */
  generateHTML(): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.testSuite.name} - E2E Test Documentation</title>
  <style>
    :root {
      --primary-color: #1a365d;
      --secondary-color: #2b6cb0;
      --accent-color: #f6ad55;
      --success-color: #48bb78;
      --error-color: #fc8181;
      --bg-color: #1a202c;
      --card-bg: #2d3748;
      --text-color: #e2e8f0;
      --border-color: #4a5568;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      padding: 2rem;
      text-align: center;
      border-bottom: 4px solid var(--accent-color);
    }

    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .header p {
      opacity: 0.9;
      font-size: 1.1rem;
    }

    .meta-info {
      background: var(--card-bg);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .meta-label {
      font-weight: 600;
      color: var(--accent-color);
    }

    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      width: 280px;
      height: 100vh;
      background: var(--card-bg);
      border-right: 1px solid var(--border-color);
      overflow-y: auto;
      padding-top: 1rem;
      z-index: 100;
    }

    .sidebar h2 {
      padding: 1rem 1.5rem;
      font-size: 1.2rem;
      color: var(--accent-color);
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-nav {
      list-style: none;
    }

    .sidebar-nav li {
      border-bottom: 1px solid var(--border-color);
    }

    .sidebar-nav a {
      display: block;
      padding: 0.75rem 1.5rem;
      color: var(--text-color);
      text-decoration: none;
      transition: background 0.2s;
    }

    .sidebar-nav a:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .sidebar-nav .status {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 0.5rem;
    }

    .sidebar-nav .status.passed { background: var(--success-color); }
    .sidebar-nav .status.failed { background: var(--error-color); }

    .main-content {
      margin-left: 280px;
      padding: 2rem;
    }

    .test-case {
      background: var(--card-bg);
      border-radius: 8px;
      margin-bottom: 2rem;
      overflow: hidden;
      border: 1px solid var(--border-color);
    }

    .test-case-header {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      padding: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .test-case-header h3 {
      font-size: 1.3rem;
    }

    .test-case-header .use-case {
      background: var(--accent-color);
      color: var(--primary-color);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .test-case-body {
      padding: 1.5rem;
    }

    .test-description {
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      border-left: 4px solid var(--accent-color);
    }

    .steps {
      display: grid;
      gap: 1.5rem;
    }

    .step {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .step-number {
      background: var(--secondary-color);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }

    .step-content h4 {
      margin-bottom: 0.5rem;
      color: var(--accent-color);
    }

    .step-screenshot {
      margin-top: 1rem;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid var(--border-color);
    }

    .step-screenshot img {
      width: 100%;
      height: auto;
      display: block;
    }

    .step-screenshot:hover {
      border-color: var(--accent-color);
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .status-badge.passed {
      background: var(--success-color);
      color: white;
    }

    .status-badge.failed {
      background: var(--error-color);
      color: white;
    }

    .summary {
      background: var(--card-bg);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .summary-item {
      text-align: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }

    .summary-item .count {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--accent-color);
    }

    .summary-item .label {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .sidebar {
        position: static;
        width: 100%;
        height: auto;
      }
      .main-content {
        margin-left: 0;
      }
    }
  </style>
</head>
<body>
  <nav class="sidebar">
    <h2>Test Cases</h2>
    <ul class="sidebar-nav">
      ${this.testSuite.testCases.map((tc, i) => `
        <li>
          <a href="#test-${i}">
            <span class="status ${tc.status}"></span>
            ${tc.name}
          </a>
        </li>
      `).join('')}
    </ul>
  </nav>

  <main class="main-content">
    <header class="header">
      <h1>${this.testSuite.name}</h1>
      <p>${this.testSuite.description}</p>
    </header>

    <div class="meta-info">
      <div class="meta-item">
        <span class="meta-label">Generated:</span>
        <span>${this.testSuite.generatedAt.toLocaleString()}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Tests:</span>
        <span>${this.testSuite.testCases.length}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Passed:</span>
        <span>${this.testSuite.testCases.filter(tc => tc.status === 'passed').length}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Failed:</span>
        <span>${this.testSuite.testCases.filter(tc => tc.status === 'failed').length}</span>
      </div>
    </div>

    <div class="summary">
      <div class="summary-item">
        <div class="count">${this.testSuite.testCases.length}</div>
        <div class="label">Total Test Cases</div>
      </div>
      <div class="summary-item">
        <div class="count">${this.testSuite.testCases.reduce((sum, tc) => sum + tc.steps.length, 0)}</div>
        <div class="label">Total Steps</div>
      </div>
      <div class="summary-item">
        <div class="count">${this.testSuite.testCases.filter(tc => tc.status === 'passed').length}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-item">
        <div class="count">${this.testSuite.testCases.filter(tc => tc.status === 'failed').length}</div>
        <div class="label">Failed</div>
      </div>
    </div>

    ${this.testSuite.testCases.map((tc, i) => `
      <article class="test-case" id="test-${i}">
        <div class="test-case-header">
          <h3>${tc.name}</h3>
          <span class="use-case">${tc.useCase}</span>
        </div>
        <div class="test-case-body">
          <div class="test-description">
            <strong>Description:</strong> ${tc.description}
            <br><br>
            <span class="status-badge ${tc.status}">${tc.status.toUpperCase()}</span>
          </div>

          <div class="steps">
            ${tc.steps.map(step => `
              <div class="step">
                <div class="step-number">${step.stepNumber}</div>
                <div class="step-content">
                  <h4>${step.name}</h4>
                  <p>${step.description}</p>
                  ${step.screenshotPath ? `
                    <div class="step-screenshot">
                      <img src="${path.relative(screenshotConfig.docsDir, step.screenshotPath)}"
                           alt="Step ${step.stepNumber}: ${step.name}"
                           loading="lazy">
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </article>
    `).join('')}
  </main>
</body>
</html>
    `;

    return html;
  }

  /**
   * Save documentation to file
   */
  saveToFile(filename?: string): string {
    const outputPath = path.join(
      screenshotConfig.docsDir,
      filename || screenshotConfig.docs.outputFile
    );

    fs.writeFileSync(outputPath, this.generateHTML());
    console.log(`📄 Documentation generated: ${outputPath}`);

    return outputPath;
  }
}

/**
 * Visual Regression Helper
 * Compares current screenshots against baselines
 */
export async function compareWithBaseline(
  page: Page,
  testInfo: TestInfo,
  name: string
): Promise<boolean> {
  const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const filename = `${sanitizedName}.png`;

  // Use Playwright's built-in visual comparison
  await expect(page).toHaveScreenshot(filename, {
    threshold: screenshotConfig.settings.threshold,
    animations: screenshotConfig.settings.animations
  });

  return true;
}

// Re-export for convenience
import { expect } from '@playwright/test';
export { expect };
