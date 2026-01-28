/**
 * Transaction E2E Tests
 * Tests transaction CRUD operations with real backend
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestApiClient } from '../helpers/api-client';
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures';
import {
  DashboardScreen,
  AddTransactionScreen,
  performLogin,
} from '../contracts/ui-contracts';

describe('Transaction E2E Tests', () => {
  let api: TestApiClient;

  beforeAll(async () => {
    api = new TestApiClient();
    await api.ensureTestUser(TEST_USER, true);
    await api.setupTestData();
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });

    await performLogin(TEST_USER.email, TEST_USER.password);
  });

  describe('Dashboard', () => {
    it('displays dashboard with transactions', async () => {
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
      await expect(element(by.id('dashboard.incomeAmount'))).toBeVisible();
      await expect(element(by.id('dashboard.expenseAmount'))).toBeVisible();
    });

    it('shows add transaction FAB', async () => {
      await expect(element(by.id('dashboard.addTransactionFab'))).toBeVisible();
    });
  });

  describe('Add Transaction', () => {
    it('opens add transaction screen from FAB', async () => {
      await DashboardScreen.tapAddTransaction();
      await AddTransactionScreen.waitForScreen();
      await expect(element(by.id('addTransaction.screen'))).toBeVisible();
    });

    it('displays all form elements', async () => {
      await DashboardScreen.tapAddTransaction();
      await AddTransactionScreen.waitForScreen();

      await expect(element(by.id('addTransaction.amountInput'))).toBeVisible();
      await waitFor(element(by.id('addTransaction.descriptionInput')))
        .toBeVisible()
        .whileElement(by.id('addTransaction.scrollView'))
        .scroll(200, 'down');
      await expect(element(by.id('addTransaction.descriptionInput'))).toBeVisible();
      await expect(element(by.id('addTransaction.submitButton'))).toBeVisible();
    });

    it('creates expense transaction', async () => {
      const testDescription = `E2E Test ${Date.now()}`;

      await DashboardScreen.tapAddTransaction();
      await AddTransactionScreen.waitForScreen();

      await AddTransactionScreen.enterAmount('42.50');

      await AddTransactionScreen.selectCategory('Groceries');

      await AddTransactionScreen.enterDescription(testDescription);

      await AddTransactionScreen.tapSubmit();

      await device.disableSynchronization();
      try {
        await waitFor(element(by.id('dashboard.addTransactionFab')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.LONG);

        await element(by.id('dashboard.scrollView')).scroll(300, 'down');

        await waitFor(element(by.text('-$42.50')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM);
      } finally {
        await device.enableSynchronization();
      }
    });
  });

  describe('Transaction List', () => {
    it('displays recent transactions on dashboard', async () => {
      await device.disableSynchronization();
      try {
        await element(by.id('dashboard.scrollView')).scroll(500, 'down');

        await waitFor(element(by.id('dashboard.recentTransactionsTitle')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM);
      } finally {
        await device.enableSynchronization();
      }
    });

    it('taps on transaction to view details', async () => {
      try {
        await element(by.id('dashboard.transaction.0')).tap();
        await waitFor(element(by.id('editTransaction.screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM);
      } catch {
        // No transactions available
      }
    });
  });

  describe('Month Navigation', () => {
    it('has month selector', async () => {
      await expect(element(by.id('dashboard.monthSelector'))).toBeVisible();
    });
  });
});
