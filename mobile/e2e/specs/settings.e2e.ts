/**
 * Settings Tests
 * Settings screen and logout
 */

import { device, element, by, expect, waitFor } from 'detox';

const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
};

async function loginAndWaitForDashboard(): Promise<void> {
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(30000);

  await element(by.id('login.emailInput')).typeText(TEST_USER.email);
  await element(by.id('login.passwordInput')).typeText(TEST_USER.password);
  await element(by.id('login.passwordInput')).tapReturnKey();
  await element(by.id('login.submitButton')).tap();

  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(15000);
}

describe('Settings Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await loginAndWaitForDashboard();
  });

  it('shows settings screen', async () => {
    await element(by.text('Settings')).tap();
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows logout button', async () => {
    await element(by.text('Settings')).tap();
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('settings.logoutButton'))).toBeVisible();
  });

  it('logs out and returns to login screen', async () => {
    await element(by.text('Settings')).tap();
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('settings.logoutButton')).tap();

    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
