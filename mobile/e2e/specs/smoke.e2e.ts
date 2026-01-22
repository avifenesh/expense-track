/**
 * Smoke Tests
 * Basic app launch and screen rendering
 */

import { device, element, by, expect, waitFor } from 'detox';

describe('Smoke Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('app launches and shows login screen', async () => {
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(30000);
  });

  it('login screen has email and password inputs', async () => {
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(30000);
    await expect(element(by.id('login.emailInput'))).toBeVisible();
    await expect(element(by.id('login.passwordInput'))).toBeVisible();
    await expect(element(by.id('login.submitButton'))).toBeVisible();
  });
});
