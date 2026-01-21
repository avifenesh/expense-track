import { device } from 'detox';

/**
 * Network Simulation Helpers for E2E Tests
 *
 * Helpers for simulating various network conditions in tests.
 * Useful for testing offline behavior, error handling, and retry logic.
 */

/**
 * Simulate offline network state
 * Blocks all network requests by adding all URLs to blacklist
 */
export async function simulateOffline(): Promise<void> {
  // Block all network requests using wildcard pattern
  // Note: This affects all network calls from the app, including API requests
  await device.setURLBlacklist(['.*']);
}

/**
 * Restore online network state
 * Clears the URL blacklist to allow all network requests
 */
export async function simulateOnline(): Promise<void> {
  // Clear URL blacklist to restore network
  await device.setURLBlacklist([]);
}

/**
 * Simulate slow network with artificial latency
 * Note: Detox doesn't natively support latency simulation
 * This is a placeholder for future implementation or documentation
 *
 * @param latencyMs - Target latency in milliseconds (not implemented)
 */
export async function simulateSlowNetwork(latencyMs: number): Promise<void> {
  // Note: Detox does not natively support network latency simulation
  // For slow network testing, consider:
  // 1. Using network link conditioner on iOS (manual setup)
  // 2. Using Android emulator network throttling (manual setup)
  // 3. Mocking API responses with delays at the app level
  console.warn(
    `simulateSlowNetwork(${latencyMs}ms) is not implemented. ` +
      'Detox does not support network latency simulation. ' +
      'Consider using device-level network throttling or app-level mocks.'
  );
}

/**
 * Block specific URLs to simulate API failures
 * Useful for testing error handling for specific endpoints
 *
 * @param urlPatterns - Array of URL patterns to block (supports regex)
 */
export async function blockURLs(urlPatterns: string[]): Promise<void> {
  await device.setURLBlacklist(urlPatterns);
}

/**
 * Simulate specific HTTP error by blocking the endpoint
 * Note: This only blocks the request - it doesn't mock specific status codes
 * The app will see a network error, not an HTTP error response
 *
 * @param endpoint - URL pattern to block
 */
export async function simulateNetworkError(endpoint: string): Promise<void> {
  // Note: Detox URL blacklist causes network failure, not HTTP status codes
  // For testing specific HTTP status codes (400, 401, 500, etc.),
  // consider using MSW (Mock Service Worker) or app-level mocking
  await device.setURLBlacklist([endpoint]);
}

/**
 * Restore all network access
 * Alias for simulateOnline() for clarity in test cleanup
 */
export async function restoreNetwork(): Promise<void> {
  await simulateOnline();
}

/**
 * Higher-level network helpers for common scenarios
 */
export const NetworkHelpers = {
  /**
   * Test a flow with temporary offline state
   * Automatically restores network after the test function completes
   *
   * @param testFn - Test function to run while offline
   */
  async withOfflineMode(testFn: () => Promise<void>): Promise<void> {
    await simulateOffline();
    try {
      await testFn();
    } finally {
      await simulateOnline();
    }
  },

  /**
   * Test a flow with specific URLs blocked
   * Automatically restores network after the test function completes
   *
   * @param urlPatterns - URL patterns to block
   * @param testFn - Test function to run with blocked URLs
   */
  async withBlockedURLs(urlPatterns: string[], testFn: () => Promise<void>): Promise<void> {
    await blockURLs(urlPatterns);
    try {
      await testFn();
    } finally {
      await simulateOnline();
    }
  },

  /**
   * Block API requests to the backend
   * Useful for testing UI without backend dependency
   */
  async blockBackendAPI(): Promise<void> {
    // Block common API endpoint patterns
    // Adjust these patterns based on your API base URL
    await device.setURLBlacklist([
      '.*\\/api\\/.*', // REST API endpoints
      '.*\\/v1\\/.*', // Versioned API endpoints
    ]);
  },

  /**
   * Check if network is currently online
   * Note: This checks the blacklist state, not actual connectivity
   */
  async isOnline(): Promise<boolean> {
    // Detox doesn't provide a way to read current blacklist state
    // This is a limitation - consider tracking state in test code if needed
    console.warn(
      'NetworkHelpers.isOnline() cannot verify current network state. ' +
        'Track network state in your test code instead.'
    );
    return true; // Assume online unless explicitly set offline
  },
};
