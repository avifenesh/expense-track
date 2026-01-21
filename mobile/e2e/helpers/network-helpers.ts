import { device } from 'detox';

/**
 * Network Simulation Helpers
 *
 * Provides utilities for testing offline mode and network error scenarios.
 * Uses Detox's network simulation APIs.
 */

/**
 * Simulate device going offline (airplane mode).
 */
export async function simulateOffline(): Promise<void> {
  await device.setURLBlacklist(['.*']);
}

/**
 * Restore network connectivity.
 */
export async function simulateOnline(): Promise<void> {
  await device.setURLBlacklist([]);
}

/**
 * Simulate slow network conditions.
 * Note: This blocks specific API endpoints to simulate partial connectivity.
 */
export async function simulateSlowNetwork(): Promise<void> {
  // Block specific endpoints to simulate partial network issues
  await device.setURLBlacklist(['.*api/v1/transactions.*', '.*api/v1/budgets.*']);
}

/**
 * Execute a function while offline, then restore connectivity.
 */
export async function withOfflineMode<T>(fn: () => Promise<T>): Promise<T> {
  await simulateOffline();
  try {
    return await fn();
  } finally {
    await simulateOnline();
  }
}

/**
 * NetworkHelpers namespace for convenient importing.
 */
export const NetworkHelpers = {
  goOffline: simulateOffline,
  goOnline: simulateOnline,
  slowNetwork: simulateSlowNetwork,
  withOfflineMode,
};
