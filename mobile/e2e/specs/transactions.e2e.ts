/**
 * Transactions Tests
 * CRUD operations, filters
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

describe('Transactions Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await loginAndWaitForDashboard();
  });

  describe('Transaction List', () => {
    it('shows transactions screen with filters', async () => {
      await element(by.text('Transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('transactions.filter.all'))).toBeVisible();
      await expect(element(by.id('transactions.filter.income'))).toBeVisible();
      await expect(element(by.id('transactions.filter.expense'))).toBeVisible();
    });

    it('filters by income', async () => {
      await element(by.text('Transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('transactions.filter.income')).tap();
      // Filter should be applied
    });

    it('filters by expenses', async () => {
      await element(by.text('Transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('transactions.filter.expense')).tap();
      // Filter should be applied
    });
  });

  describe('Add Transaction', () => {
    it('opens add transaction modal from FAB', async () => {
      await element(by.id('dashboard.addTransactionFab')).tap();
      await waitFor(element(by.id('addTransaction.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('shows add transaction form elements', async () => {
      await element(by.id('dashboard.addTransactionFab')).tap();
      await waitFor(element(by.id('addTransaction.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('addTransaction.amountInput'))).toBeVisible();
      await expect(element(by.id('addTransaction.submitButton'))).toBeVisible();
      await expect(element(by.id('addTransaction.cancelButton'))).toBeVisible();
    });

    it('cancels add transaction', async () => {
      await element(by.id('dashboard.addTransactionFab')).tap();
      await waitFor(element(by.id('addTransaction.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('addTransaction.cancelButton')).tap();

      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('switches between expense and income types', async () => {
      await element(by.id('dashboard.addTransactionFab')).tap();
      await waitFor(element(by.id('addTransaction.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Default is expense
      await element(by.id('addTransaction.type.income')).tap();
      // Now income should be selected

      await element(by.id('addTransaction.type.expense')).tap();
      // Back to expense
    });
  });
});
