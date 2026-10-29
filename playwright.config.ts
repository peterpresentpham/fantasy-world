import { defineConfig, devices } from '@playwright/test';

// Browser tests: run the real app on Chromium against a production build served on a dedicated
// port (not the dev server), so results do not depend on the developer's running `next dev`.
// Screenshots and traces are only kept for failed tests.
const PORT = 5191;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-reports/e2e/artifacts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-reports/e2e/results.json' }],
    ['html', { outputFolder: 'test-reports/e2e/html', open: 'never' }],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
