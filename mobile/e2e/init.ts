import { device } from 'detox';

// Note: beforeAll, beforeEach, afterAll are Jest globals, not Detox exports
beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
  });
});

beforeEach(async () => {
  await device.reloadReactNative();
});

afterAll(async () => {
  await device.terminateApp();
});
