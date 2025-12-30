/**
 * Global Teardown for Screenshot-Based Testing
 *
 * Runs after all tests to:
 * 1. Generate HTML documentation from test results
 * 2. Create visual regression report
 * 3. Copy screenshots to documentation folder
 */

import * as fs from 'fs';
import * as path from 'path';

const screenshotsDir = path.resolve(__dirname, '../screenshots');
const currentDir = path.join(screenshotsDir, 'current');
const baselinesDir = path.join(screenshotsDir, 'baselines');
const docsDir = path.resolve(__dirname, '../generated-docs');
const resultsFile = path.resolve(__dirname, '../test-results.json');

interface TestResult {
  title: string;
  status: string;
  duration: number;
  attachments?: Array<{
    name: string;
    path: string;
    contentType: string;
  }>;
}

interface TestSuite {
  title: string;
  tests: TestResult[];
}

async function globalTeardown() {
  console.log('\n📸 Screenshot Test Teardown');
  console.log('===========================\n');

  // Update metadata with end time
  const metadataPath = path.join(screenshotsDir, 'test-run-metadata.json');
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    metadata.endTime = new Date().toISOString();
    metadata.duration = new Date(metadata.endTime).getTime() - new Date(metadata.startTime).getTime();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }

  // Count screenshots
  const currentScreenshots = fs.existsSync(currentDir)
    ? fs.readdirSync(currentDir).filter(f => f.endsWith('.png')).length
    : 0;

  const baselineScreenshots = fs.existsSync(baselinesDir)
    ? fs.readdirSync(baselinesDir).filter(f => f.endsWith('.png')).length
    : 0;

  console.log(`📷 Current run screenshots: ${currentScreenshots}`);
  console.log(`📷 Baseline screenshots: ${baselineScreenshots}`);

  // Copy screenshots to docs folder for HTML documentation
  if (fs.existsSync(currentDir)) {
    const docsScreenshotsDir = path.join(docsDir, 'screenshots');
    if (!fs.existsSync(docsScreenshotsDir)) {
      fs.mkdirSync(docsScreenshotsDir, { recursive: true });
    }

    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      fs.copyFileSync(
        path.join(currentDir, file),
        path.join(docsScreenshotsDir, file)
      );
    }
    console.log(`📁 Copied ${files.length} screenshots to docs folder`);
  }

  // Generate summary HTML report
  generateSummaryReport();

  console.log('\n✅ Screenshot test teardown complete\n');
}

function generateSummaryReport() {
  // Read test results if available
  let testResults: TestSuite[] = [];
  if (fs.existsSync(resultsFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      testResults = results.suites || [];
    } catch (e) {
      console.warn('Could not parse test results file');
    }
  }

  // Get screenshots
  const screenshots: string[] = [];
  const docsScreenshotsDir = path.join(docsDir, 'screenshots');
  if (fs.existsSync(docsScreenshotsDir)) {
    screenshots.push(...fs.readdirSync(docsScreenshotsDir).filter(f => f.endsWith('.png')));
  }

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Test Screenshot Report</title>
  <style>
    :root {
      --bg-dark: #1a202c;
      --bg-card: #2d3748;
      --text-primary: #e2e8f0;
      --accent: #f6ad55;
      --success: #48bb78;
      --error: #fc8181;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg-dark);
      color: var(--text-primary);
      margin: 0;
      padding: 2rem;
    }
    h1 {
      text-align: center;
      color: var(--accent);
      margin-bottom: 2rem;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: var(--bg-card);
      padding: 1.5rem;
      border-radius: 8px;
      text-align: center;
    }
    .summary-card .value {
      font-size: 2rem;
      font-weight: bold;
      color: var(--accent);
    }
    .screenshot-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1rem;
    }
    .screenshot-card {
      background: var(--bg-card);
      border-radius: 8px;
      overflow: hidden;
    }
    .screenshot-card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .screenshot-card .caption {
      padding: 0.75rem;
      font-size: 0.9rem;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .timestamp {
      text-align: center;
      opacity: 0.7;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <h1>E2E Test Screenshot Report</h1>

  <div class="summary">
    <div class="summary-card">
      <div class="value">${screenshots.length}</div>
      <div>Screenshots Captured</div>
    </div>
    <div class="summary-card">
      <div class="value">${testResults.length}</div>
      <div>Test Suites</div>
    </div>
  </div>

  <h2>Captured Screenshots</h2>
  <div class="screenshot-grid">
    ${screenshots.map(filename => `
      <div class="screenshot-card">
        <img src="screenshots/${filename}" alt="${filename}" loading="lazy">
        <div class="caption">${filename.replace(/-/g, ' ').replace('.png', '')}</div>
      </div>
    `).join('')}
  </div>

  <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
</body>
</html>
  `;

  const reportPath = path.join(docsDir, 'screenshot-report.html');
  fs.writeFileSync(reportPath, html);
  console.log(`📄 Generated screenshot report: ${reportPath}`);
}

export default globalTeardown;
