import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results/e2e',
  timeout: 60_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4300',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'HOSTNAME=127.0.0.1 PORT=4300 npm run dev',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
