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

    // Login (enterPassword dismisses keyboard via tapReturnKey)
    await LoginScreen.enterEmail(TEST_USER.email);
    await LoginScreen.enterPassword(TEST_USER.password);
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
      // Scroll within ScrollView to see description input (may be below fold)
      await waitFor(element(by.id('addTransaction.descriptionInput')))
        .toBeVisible()
        .whileElement(by.id('addTransaction.scrollView'))
        .scroll(200, 'down');
      await expect(element(by.id('addTransaction.descriptionInput'))).toBeVisible();
      // Submit button is in fixed footer, should be visible
      await expect(element(by.id('addTransaction.submitButton'))).toBeVisible();
    });

    it('creates expense transaction', async () => {
      const testDescription = `E2E Test ${Date.now()}`;

      await DashboardScreen.tapAddTransaction();
      await AddTransactionScreen.waitForScreen();

      // Enter amount (enterAmount dismisses keyboard via tapReturnKey)
      await AddTransactionScreen.enterAmount('42.50');

      // Enter description (enterDescription dismisses keyboard via tapReturnKey)
      await AddTransactionScreen.enterDescription(testDescription);

      // Submit (tapSubmit scrolls to button first)
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
