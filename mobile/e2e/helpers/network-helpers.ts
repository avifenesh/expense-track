import { device } from 'detox';


// Track network state for isOnline() queries
let networkState: 'online' | 'offline' = 'online';

export async function simulateOffline(): Promise<void> {
  await device.setURLBlacklist(['.*']);
  networkState = 'offline';
}

export async function simulateOnline(): Promise<void> {
  await device.setURLBlacklist([]);
  networkState = 'online';
}

export async function simulateSlowNetwork(_latencyMs: number): Promise<void> {
  throw new Error(
    'simulateSlowNetwork() is not implemented. ' +
      'Detox does not support network latency simulation. ' +
      'Consider using device-level network throttling or app-level mocks.'
  );
}

export async function blockURLs(urlPatterns: string[]): Promise<void> {
  await device.setURLBlacklist(urlPatterns);
}

export async function simulateNetworkError(endpoint: string): Promise<void> {
  // consider using MSW (Mock Service Worker) or app-level mocking
  await device.setURLBlacklist([endpoint]);
}

export async function restoreNetwork(): Promise<void> {
  await simulateOnline();
}

export const NetworkHelpers = {
  async withOfflineMode(testFn: () => Promise<void>): Promise<void> {
    await simulateOffline();
    try {
      await testFn();
    } finally {
      await simulateOnline();
    }
  },

  async withBlockedURLs(urlPatterns: string[], testFn: () => Promise<void>): Promise<void> {
    await blockURLs(urlPatterns);
    try {
      await testFn();
    } finally {
      await simulateOnline();
    }
  },

  async blockBackendAPI(): Promise<void> {
        await device.setURLBlacklist([
      '.*\\/api\\/.*', // REST API endpoints
      '.*\\/v1\\/.*', // Versioned API endpoints
    ]);
  },

  isOnline(): boolean {
    return networkState === 'online';
  },
};
