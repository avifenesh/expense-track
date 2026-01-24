/**
 * Global Setup for E2E Tests
 * Starts backend server before Detox setup
 */
/* eslint-disable no-console */

import { getBackendManager } from './server/backend-manager'

export default async function globalSetup() {
  console.log('\n[GlobalSetup] Starting E2E test environment...\n')

  // 1. Start backend server (skip if CI already started it)
  if (process.env.E2E_API_BASE_URL) {
    console.log(`[GlobalSetup] Using pre-started backend at ${process.env.E2E_API_BASE_URL}`)
  } else {
    const backend = getBackendManager()
    await backend.start()
    // Store base URL for tests to access
    process.env.E2E_API_BASE_URL = backend.getBaseUrl()
  }

  // 2. Run Detox global setup
  const { default: detoxGlobalSetup } = await import('detox/runners/jest/globalSetup.js')
  await detoxGlobalSetup()

  console.log('\n[GlobalSetup] E2E test environment ready\n')
}
