/**
 * Navigation Tests
 * Tab navigation after login
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

describe('Navigation Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await loginAndWaitForDashboard();
  });

  it('navigates to Transactions tab', async () => {
    await element(by.text('Transactions')).tap();
    await waitFor(element(by.id('transactions.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('navigates to Budgets tab', async () => {
    await element(by.text('Budgets')).tap();
    await waitFor(element(by.id('budgets.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('navigates to Sharing tab', async () => {
    await element(by.text('Sharing')).tap();
    await waitFor(element(by.id('sharing.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('navigates to Settings tab', async () => {
    await element(by.text('Settings')).tap();
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('navigates back to Dashboard tab', async () => {
    await element(by.text('Settings')).tap();
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.text('Dashboard')).tap();
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
