import { by, element, expect, waitFor } from 'detox';

/**
 * Transaction Helpers for E2E Tests
 *
 * Common transaction operations used across test suites.
 */

/**
 * Navigate to the Transactions tab
 */
export async function navigateToTransactions(): Promise<void> {
  await element(by.id('tab.transactions')).tap();
  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Open the Add Transaction screen
 */
export async function openAddTransaction(): Promise<void> {
  await element(by.id('transactions.addButton')).tap();
  await waitFor(element(by.id('addTransaction.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Create an expense transaction
 */
export async function createExpense(
  amount: string,
  category: string,
  description?: string
): Promise<void> {
  await openAddTransaction();

  // Select expense type (default, but be explicit)
  await element(by.id('addTransaction.type.expense')).tap();

  // Enter amount
  await element(by.id('addTransaction.amountInput')).tap();
  await element(by.id('addTransaction.amountInput')).typeText(amount);

  // Select category - use lowercase, dash-separated format
  const categoryTestId = `addTransaction.category.${category.replace(/\s+/g, '-').toLowerCase()}`;
  await element(by.id(categoryTestId)).tap();

  // Enter description if provided
  if (description) {
    await element(by.id('addTransaction.descriptionInput')).tap();
    await element(by.id('addTransaction.descriptionInput')).typeText(description);
    await element(by.id('addTransaction.descriptionInput')).tapReturnKey();
  }

  // Submit
  await element(by.id('addTransaction.submitButton')).tap();

  // Wait for return to transactions screen
  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Create an income transaction
 */
export async function createIncome(
  amount: string,
  category: string,
  description?: string
): Promise<void> {
  await openAddTransaction();

  // Select income type
  await element(by.id('addTransaction.type.income')).tap();

  // Wait for categories to reload for income type
  await waitFor(element(by.id('addTransaction.categoryGrid')))
    .toBeVisible()
    .withTimeout(5000);

  // Enter amount
  await element(by.id('addTransaction.amountInput')).tap();
  await element(by.id('addTransaction.amountInput')).typeText(amount);

  // Select category
  const categoryTestId = `addTransaction.category.${category.replace(/\s+/g, '-').toLowerCase()}`;
  await element(by.id(categoryTestId)).tap();

  // Enter description if provided
  if (description) {
    await element(by.id('addTransaction.descriptionInput')).tap();
    await element(by.id('addTransaction.descriptionInput')).typeText(description);
    await element(by.id('addTransaction.descriptionInput')).tapReturnKey();
  }

  // Submit
  await element(by.id('addTransaction.submitButton')).tap();

  // Wait for return to transactions screen
  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Verify a transaction exists in the list by checking for its description text
 */
export async function verifyTransactionInList(description: string): Promise<void> {
  await waitFor(element(by.text(description)))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Tap on a transaction to open detail/edit view
 */
export async function openTransaction(description: string): Promise<void> {
  await element(by.text(description)).tap();
  await waitFor(element(by.id('editTransaction.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Delete a transaction from the edit screen
 */
export async function deleteTransaction(): Promise<void> {
  await element(by.id('editTransaction.deleteButton')).tap();

  // Confirm deletion if dialog appears
  try {
    await waitFor(element(by.id('dialog.confirmButton')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id('dialog.confirmButton')).tap();
  } catch {
    // No confirmation dialog, continue
  }

  // Wait for return to transactions screen
  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Check if transaction list is empty
 */
export async function isTransactionListEmpty(): Promise<boolean> {
  try {
    await expect(element(by.id('transactions.emptyState'))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

/**
 * Filter transactions by type
 */
export async function filterByType(type: 'all' | 'income' | 'expense'): Promise<void> {
  await element(by.id(`transactions.filter.${type}`)).tap();
  // Wait for list to be visible after filter change
  // This is deterministic - we wait for the list to be visible again
  await waitFor(element(by.id('transactions.list')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Pull to refresh the transactions list
 */
export async function refreshTransactions(): Promise<void> {
  // Scroll down to trigger pull-to-refresh
  await element(by.id('transactions.list')).scroll(200, 'down');
  // Wait for loading state to appear and then for list to be visible again
  await waitFor(element(by.id('transactions.list')))
    .toBeVisible()
    .withTimeout(10000);
}
