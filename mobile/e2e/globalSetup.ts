/**
 * Global Setup for E2E Tests
 * Starts backend server before Detox setup
 */

import { getBackendManager } from './server/backend-manager'

export default async function globalSetup() {
  // 1. Start backend server (skip if CI already started it)
  if (!process.env.E2E_API_BASE_URL) {
    const backend = getBackendManager()
    await backend.start()
    // Store base URL for tests to access
    process.env.E2E_API_BASE_URL = backend.getBaseUrl()
  }

  // 2. Run Detox global setup
  const { default: detoxGlobalSetup } = await import('detox/runners/jest/globalSetup')
  await detoxGlobalSetup()
}
