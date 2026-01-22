/**
 * Budgets Tests
 * View budgets screen
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

describe('Budgets Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await loginAndWaitForDashboard();
  });

  it('shows budgets screen', async () => {
    await element(by.text('Budgets')).tap();
    await waitFor(element(by.id('budgets.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows budgets title', async () => {
    await element(by.text('Budgets')).tap();
    await waitFor(element(by.id('budgets.screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.text('Budgets'))).toBeVisible();
  });
});
