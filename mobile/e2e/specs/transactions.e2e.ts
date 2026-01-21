import { element, by, expect, waitFor, device } from 'detox';
import {
  TEST_TRANSACTIONS,
  loginAsPrimaryUser,
  completeOnboarding,
  navigateToTransactions,
  createExpense,
  createIncome,
  verifyTransactionInList,
  openTransaction,
  deleteTransaction,
  filterByType,
} from '../helpers';

/**
 * Transaction Test Suite (P0)
 *
 * Tests for transaction CRUD operations.
 * TestIDs added in PR #265.
 */

/**
 * Helper to login and ensure user is on dashboard
 */
async function loginAndSetup(): Promise<void> {
  // Wait for app to load
  await device.disableSynchronization();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(30000);
  await device.enableSynchronization();

  // Login
  await loginAsPrimaryUser();

  // Handle onboarding if needed
  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(5000);
  } catch {
    // Complete onboarding
    await completeOnboarding();
  }
}

describe('Transactions', () => {
  describe('P0: Transaction CRUD', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
      await loginAndSetup();
    });

    it('should add expense transaction', async () => {
      // Navigate to transactions
      await navigateToTransactions();

      // Create expense
      const description = `E2E Expense ${Date.now()}`;
      await createExpense(
        TEST_TRANSACTIONS.expense.amount,
        TEST_TRANSACTIONS.expense.category,
        description
      );

      // Verify transaction appears in list
      await verifyTransactionInList(description);
    });

    it('should add income transaction', async () => {
      // Navigate to transactions
      await navigateToTransactions();

      // Create income
      const description = `E2E Income ${Date.now()}`;
      await createIncome(
        TEST_TRANSACTIONS.income.amount,
        TEST_TRANSACTIONS.income.category,
        description
      );

      // Verify transaction appears in list
      await verifyTransactionInList(description);
    });

    it('should edit transaction', async () => {
      // Navigate to transactions
      await navigateToTransactions();

      // Create a transaction first
      const originalDescription = `E2E Edit Test ${Date.now()}`;
      await createExpense(
        '50.00',
        TEST_TRANSACTIONS.expense.category,
        originalDescription
      );

      // Verify it's in the list
      await verifyTransactionInList(originalDescription);

      // Open the transaction for editing
      await openTransaction(originalDescription);

      // Wait for edit screen
      await waitFor(element(by.id('editTransaction.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Clear and update description
      await element(by.id('editTransaction.descriptionInput')).clearText();
      await element(by.id('editTransaction.descriptionInput')).typeText(
        'Updated Description'
      );
      await element(by.id('editTransaction.descriptionInput')).tapReturnKey();

      // Save changes
      await element(by.id('editTransaction.saveButton')).tap();

      // Wait for return to transactions
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify updated description appears
      await verifyTransactionInList('Updated Description');
    });

    it('should delete transaction', async () => {
      // Navigate to transactions
      await navigateToTransactions();

      // Create a transaction to delete
      const description = `E2E Delete Test ${Date.now()}`;
      await createExpense(
        '25.00',
        TEST_TRANSACTIONS.expense.category,
        description
      );

      // Verify it exists
      await verifyTransactionInList(description);

      // Open and delete
      await openTransaction(description);
      await deleteTransaction();

      // Verify transaction is no longer visible
      await waitFor(element(by.text(description)))
        .not.toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Transaction Filtering', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
      await loginAndSetup();
      await navigateToTransactions();
    });

    it('should filter transactions by type', async () => {
      // Create one expense and one income
      const expenseDesc = `Filter Test Expense ${Date.now()}`;
      const incomeDesc = `Filter Test Income ${Date.now()}`;

      await createExpense('30.00', TEST_TRANSACTIONS.expense.category, expenseDesc);
      await createIncome('500.00', TEST_TRANSACTIONS.income.category, incomeDesc);

      // Filter by expense
      await filterByType('expense');

      // Expense should be visible
      await expect(element(by.text(expenseDesc))).toBeVisible();

      // Filter by income
      await filterByType('income');

      // Income should be visible
      await expect(element(by.text(incomeDesc))).toBeVisible();

      // Reset to all
      await filterByType('all');

      // Both should be visible
      await expect(element(by.text(expenseDesc))).toBeVisible();
      await expect(element(by.text(incomeDesc))).toBeVisible();
    });
  });
});
