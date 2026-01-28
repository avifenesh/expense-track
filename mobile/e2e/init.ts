import { device } from 'detox';

// Note: beforeAll, beforeEach, afterAll are Jest globals, not Detox exports
// Using launchApp in beforeEach instead of reloadReactNative to avoid
// RCTRedBoxController crash when the app encounters errors during reload
beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxPrintBusyIdleResources: 'YES' },
  });
}, 300000); // 5 minute timeout for initial app launch in CI

beforeEach(async () => {
  // Use launchApp with newInstance: true to fully restart the app between tests
  // This avoids the RCTRedBoxController "already being presented" crash that
  // occurs when reloadReactNative() encounters errors
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxPrintBusyIdleResources: 'YES' },
  });
}, 240000); // 4 minute timeout for app relaunches in CI

afterAll(async () => {
  await device.terminateApp();
});
