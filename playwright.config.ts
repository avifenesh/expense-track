import fs from 'node:fs'
import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const loadEnvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce(
      (acc, line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          return acc
        }

        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (!match) {
          return acc
        }

        const key = match[1].trim()
        let value = match[2].trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }

        acc[key] = value
        return acc
      },
      {} as Record<string, string>,
    )
}

const mergeEnv = (...sources: Array<Record<string, string | undefined>>): Record<string, string> => {
  const merged: Record<string, string> = {}
  sources.forEach((source) => {
    Object.entries(source).forEach(([key, value]) => {
      if (typeof value === 'string') {
        merged[key] = value
      }
    })
  })
  return merged
}

const env = mergeEnv(
  process.env,
  loadEnvFile(path.join(process.cwd(), '.env')),
  loadEnvFile(path.join(process.cwd(), '.env.e2e')),
)

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
    command: 'node scripts/playwright-dev-server.js',
    url: 'http://127.0.0.1:4300',
    env,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
