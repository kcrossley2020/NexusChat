/**
 * Global Setup for Screenshot-Based Testing
 *
 * Runs before all tests to:
 * 1. Clean up previous test artifacts
 * 2. Ensure screenshot directories exist
 * 3. Initialize documentation generator
 */

import * as fs from 'fs';
import * as path from 'path';

const screenshotsDir = path.resolve(__dirname, '../screenshots');
const currentDir = path.join(screenshotsDir, 'current');
const diffDir = path.join(screenshotsDir, 'diff');
const docsDir = path.resolve(__dirname, '../generated-docs');

async function globalSetup() {
  console.log('\n📸 Screenshot Test Setup');
  console.log('========================\n');

  // Ensure directories exist
  const directories = [screenshotsDir, currentDir, diffDir, docsDir];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  }

  // Clean up current run screenshots (keep baselines)
  if (fs.existsSync(currentDir)) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      fs.unlinkSync(path.join(currentDir, file));
    }
    console.log(`🧹 Cleaned ${files.length} screenshots from previous run`);
  }

  // Clean up diff directory
  if (fs.existsSync(diffDir)) {
    const files = fs.readdirSync(diffDir);
    for (const file of files) {
      fs.unlinkSync(path.join(diffDir, file));
    }
    console.log(`🧹 Cleaned ${files.length} diff images from previous run`);
  }

  // Create metadata file for this test run
  const metadata = {
    startTime: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3050',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3080'
    }
  };

  fs.writeFileSync(
    path.join(screenshotsDir, 'test-run-metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`📝 Test run metadata saved`);
  console.log('\n');
}

export default globalSetup;
