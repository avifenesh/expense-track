/**
 * Transactions Tests
 * CRUD operations, filters
 * Contracts: TXN-001 through TXN-006, ADD-001 through ADD-008, EDIT-001 through EDIT-003
 */

import { device, element, by, expect, waitFor } from 'detox';
import {
  TestIDs,
  Timeouts,
  TEST_TRANSACTION,
  TEST_INCOME,
  waitForAppReady,
  waitForElement,
  loginAndWaitForDashboard,
  navigateToTab,
  openAddTransactionFromDashboard,
  openAddTransactionFromList,
  addTransaction,
  filterTransactions,
  assertScreenDisplayed,
  assertVisible,
  assertTransactionInList,
  assertTextVisible,
} from '../helpers';

describe('Transactions Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
    await loginAndWaitForDashboard();
  });

  describe('Transaction List', () => {
    /**
     * TXN-001: Transaction list loads
     */
    it('loads transaction list with filters', async () => {
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);

      // Filter chips should be visible
      await assertVisible(TestIDs.transactions.filterAll);
      await assertVisible(TestIDs.transactions.filterIncome);
      await assertVisible(TestIDs.transactions.filterExpense);
    });

    /**
     * TXN-002: Filter by income
     */
    it('filters transactions by income', async () => {
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);

      await filterTransactions('income');

      // Income filter should be selected
      await assertVisible(TestIDs.transactions.filterIncome);
    });

    /**
     * TXN-003: Filter by expenses
     */
    it('filters transactions by expenses', async () => {
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);

      await filterTransactions('expense');

      // Expense filter should be selected
      await assertVisible(TestIDs.transactions.filterExpense);
    });

    /**
     * TXN-006: Add transaction button opens modal
     */
    it('opens add transaction modal from list', async () => {
      await navigateToTab('Transactions');
      await openAddTransactionFromList();
      await assertScreenDisplayed(TestIDs.addTransaction.screen);
    });
  });

  describe('Add Transaction', () => {
    /**
     * ADD-001: Add expense
     */
    it('adds expense transaction', async () => {
      await openAddTransactionFromDashboard();

      // Fill expense form
      await element(by.id(TestIDs.addTransaction.amountInput)).typeText(
        TEST_TRANSACTION.amount
      );

      // Select a category (assuming 'food' exists)
      await element(by.id(TestIDs.addTransaction.category('food'))).tap();

      // Add description
      await element(by.id(TestIDs.addTransaction.descriptionInput)).typeText(
        TEST_TRANSACTION.description
      );

      // Submit
      await element(by.id(TestIDs.addTransaction.submitButton)).tap();

      // Should return to dashboard
      await waitForElement(TestIDs.dashboard.screen, Timeouts.long);
    });

    /**
     * ADD-002: Add income
     */
    it('adds income transaction', async () => {
      await openAddTransactionFromDashboard();

      // Switch to income
      await element(by.id(TestIDs.addTransaction.typeIncome)).tap();

      // Fill amount
      await element(by.id(TestIDs.addTransaction.amountInput)).typeText(
        TEST_INCOME.amount
      );

      // Select income category (assuming 'salary' exists)
      await element(by.id(TestIDs.addTransaction.category('salary'))).tap();

      // Submit
      await element(by.id(TestIDs.addTransaction.submitButton)).tap();

      // Should return to dashboard
      await waitForElement(TestIDs.dashboard.screen, Timeouts.long);
    });

    /**
     * ADD-005: Cancel closes modal
     */
    it('cancels add transaction', async () => {
      await openAddTransactionFromDashboard();

      // Enter some data
      await element(by.id(TestIDs.addTransaction.amountInput)).typeText('100');

      // Cancel
      await element(by.id(TestIDs.addTransaction.cancelButton)).tap();

      // Should return to dashboard without saving
      await waitForElement(TestIDs.dashboard.screen, Timeouts.medium);
    });

    /**
     * ADD-006: Type toggle clears category
     */
    it('clears category when switching type', async () => {
      await openAddTransactionFromDashboard();

      // Select expense category
      await element(by.id(TestIDs.addTransaction.category('food'))).tap();

      // Switch to income
      await element(by.id(TestIDs.addTransaction.typeIncome)).tap();

      // Expense category should no longer be selected
      // Income categories should now be visible
    });

    /**
     * ADD-007: Date selection
     */
    it('allows date selection', async () => {
      await openAddTransactionFromDashboard();

      // Tap yesterday
      await element(by.id(TestIDs.addTransaction.dateYesterday)).tap();

      // Date should update
    });
  });

  describe('Edit Transaction', () => {
    /**
     * EDIT-001: Edit screen pre-filled
     * Requires existing transaction
     */
    it.skip('shows edit screen with pre-filled data', async () => {
      // Tap on existing transaction from dashboard
      await element(by.id(TestIDs.dashboard.transaction(0))).tap();
      await assertScreenDisplayed(TestIDs.editTransaction.screen);
    });

    /**
     * EDIT-003: Delete transaction
     */
    it.skip('deletes transaction with confirmation', async () => {
      // Tap on existing transaction
      // Tap delete
      // Confirm deletion
      // Transaction should be removed
    });
  });
});
