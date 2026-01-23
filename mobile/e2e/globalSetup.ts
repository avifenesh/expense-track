/**
 * Global Setup for E2E Tests
 * Starts backend server before Detox setup
 */

import { getBackendManager } from './server/backend-manager';

// Import Detox's global setup
const detoxGlobalSetup = require('detox/runners/jest/globalSetup');

export default async function globalSetup() {
  console.log('\n[GlobalSetup] Starting E2E test environment...\n');

  // 1. Start backend server
  const backend = getBackendManager();
  await backend.start();

  // Store base URL for tests to access
  process.env.E2E_API_BASE_URL = backend.getBaseUrl();

  // 2. Run Detox global setup
  await detoxGlobalSetup();

  console.log('\n[GlobalSetup] E2E test environment ready\n');
}
