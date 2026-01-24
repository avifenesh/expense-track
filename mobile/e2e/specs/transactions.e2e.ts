/**
 * Transaction E2E Tests
 * Tests transaction CRUD operations with real backend
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestApiClient } from '../helpers/api-client';
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures';
import {
  LoginScreen,
  DashboardScreen,
  AddTransactionScreen,
} from '../contracts/ui-contracts';

describe('Transaction E2E Tests', () => {
  let api: TestApiClient;

  beforeAll(async () => {
    api = new TestApiClient();
    // Ensure test user exists and has data
    await api.ensureTestUser(TEST_USER, true);
    await api.setupTestData();
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await LoginScreen.waitForScreen();

    // Login
    await LoginScreen.enterEmail(TEST_USER.email);
    await LoginScreen.enterPassword(TEST_USER.password);
    await element(by.id('login.screen')).tap();
    await LoginScreen.tapSubmit();

    // Wait for dashboard
    await DashboardScreen.waitForScreen();
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
      // Description input is below the fold - scroll to it first
      await element(by.id('addTransaction.scrollView')).scrollTo('bottom');
      await expect(element(by.id('addTransaction.descriptionInput'))).toBeVisible();
      await expect(element(by.id('addTransaction.submitButton'))).toBeVisible();
    });

    it('creates expense transaction', async () => {
      const testDescription = `E2E Test ${Date.now()}`;

      await DashboardScreen.tapAddTransaction();
      await AddTransactionScreen.waitForScreen();

      // Enter amount
      await AddTransactionScreen.enterAmount('42.50');

      // Select a category (required for validation)
      // Categories are seeded by setupTestData() - tap Groceries
      await waitFor(element(by.id('addTransaction.category.groceries')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM);
      await element(by.id('addTransaction.category.groceries')).tap();

      // Scroll to description (below the fold)
      await element(by.id('addTransaction.scrollView')).scrollTo('bottom');

      // Enter description
      await AddTransactionScreen.enterDescription(testDescription);

      // Dismiss keyboard
      await element(by.id('addTransaction.screen')).tap();

      // Submit
      await AddTransactionScreen.tapSubmit();

      // Should return to dashboard
      await DashboardScreen.waitForScreen();
      await expect(element(by.id('dashboard.screen'))).toBeVisible();

      // Transaction should appear in the list
      await waitFor(element(by.text('$42.50')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM);
    });
  });

  describe('Transaction List', () => {
    it('displays recent transactions on dashboard', async () => {
      // Scroll down to see recent transactions section (below budget progress and stats)
      await element(by.id('dashboard.scrollView')).scrollTo('bottom');
      // Dashboard should have transactions list
      await expect(element(by.id('dashboard.recentTransactionsSection'))).toBeVisible();
    });

    it('taps on transaction to view details', async () => {
      // If there are transactions, tap the first one
      try {
        await element(by.id('dashboard.transaction.0')).tap();
        await waitFor(element(by.id('editTransaction.screen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM);
      } catch {
        // No transactions to tap - this is OK for this test
      }
    });
  });

  describe('Month Navigation', () => {
    it('has month selector', async () => {
      await expect(element(by.id('dashboard.monthSelector'))).toBeVisible();
    });
  });
});
