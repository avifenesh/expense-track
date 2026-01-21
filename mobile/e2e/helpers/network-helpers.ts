import { device } from 'detox';

/**
 * Network Simulation Helpers
 *
 * Provides utilities for testing offline mode and network error scenarios.
 * Uses Detox's network simulation APIs.
 */

/** API endpoints used for network simulation */
export const API_ENDPOINTS = {
  transactions: '.*api/v1/transactions.*',
  budgets: '.*api/v1/budgets.*',
};

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
 * Simulate slow network conditions by blocking specific endpoints.
 * @param endpoints - Optional array of endpoint patterns to block. Defaults to transactions and budgets.
 */
export async function simulateSlowNetwork(
  endpoints: string[] = [API_ENDPOINTS.transactions, API_ENDPOINTS.budgets]
): Promise<void> {
  await device.setURLBlacklist(endpoints);
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
  API_ENDPOINTS,
};
