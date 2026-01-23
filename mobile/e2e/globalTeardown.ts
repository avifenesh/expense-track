/**
 * Global Teardown for E2E Tests
 * Stops backend server after Detox teardown
 */

import { getBackendManager, resetBackendManager } from './server/backend-manager';

// Import Detox's global teardown
const detoxGlobalTeardown = require('detox/runners/jest/globalTeardown');

export default async function globalTeardown() {
  console.log('\n[GlobalTeardown] Cleaning up E2E test environment...\n');

  // 1. Run Detox global teardown first
  await detoxGlobalTeardown();

  // 2. Stop backend server
  const backend = getBackendManager();
  await backend.stop();
  resetBackendManager();

  console.log('\n[GlobalTeardown] E2E test environment cleaned up\n');
}
