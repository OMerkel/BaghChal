// Playwright configuration for E2E browser tests.
// Uses a tiny built-in static-file server (tests/server.js) so that the
// Web Worker in controller.js can be loaded (file:// blocks workers).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],

  webServer: {
    command: 'node tests/server.js',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
