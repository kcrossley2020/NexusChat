/**
 * Screenshot Configuration for E2E Tests
 *
 * This configuration enables:
 * 1. Baseline screenshots for visual regression testing
 * 2. Step-by-step screenshots during test execution
 * 3. Automatic HTML documentation generation
 */

import path from 'path';

export const screenshotConfig = {
  // Base directories
  baseDir: path.resolve(__dirname, '..'),
  screenshotsDir: path.resolve(__dirname, '../screenshots'),
  baselinesDir: path.resolve(__dirname, '../screenshots/baselines'),
  currentDir: path.resolve(__dirname, '../screenshots/current'),
  diffDir: path.resolve(__dirname, '../screenshots/diff'),
  docsDir: path.resolve(__dirname, '../generated-docs'),

  // Screenshot settings
  settings: {
    fullPage: false,
    animations: 'disabled' as const,
    mask: [], // CSS selectors to mask (e.g., timestamps)
    threshold: 0.2, // 20% pixel difference allowed for visual comparison
  },

  // Test step naming convention
  stepPrefix: 'step',

  // Documentation generation
  docs: {
    title: 'Videxa E2E Test Documentation',
    outputFile: 'test-documentation.html',
    includeTimestamps: true,
    includeMetadata: true,
  }
};

export interface TestStep {
  stepNumber: number;
  name: string;
  description: string;
  screenshotPath?: string;
  status: 'pending' | 'passed' | 'failed';
  timestamp: Date;
  duration?: number;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  useCase: string;
  steps: TestStep[];
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'passed' | 'failed';
}

export interface TestSuite {
  name: string;
  description: string;
  testCases: TestCase[];
  generatedAt: Date;
}
