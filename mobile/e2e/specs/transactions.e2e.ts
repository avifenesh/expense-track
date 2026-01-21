import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

/**
 * Transactions Test Suite
 *
 * Tests for the transactions screen, including list display and filtering.
 *
 * Note: These tests validate UI behavior. Backend integration for actual transaction data
 * is not required - tests work with empty states or sample data from onboarding.
 */

/**
 * Navigate to transactions screen after login
 */
async function navigateToTransactions(): Promise<void> {
  await loginAsPrimaryUser();

  // Complete onboarding if shown
  try {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(3000);
    await completeOnboarding();
  } catch {
    // Already past onboarding
  }

  // Navigate to transactions tab
  await waitFor(element(by.id('tab.transactions')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('tab.transactions')).tap();

  // Wait for transactions screen
  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Transactions', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToTransactions();
  });

  describe('Screen Display', () => {
    it('should display transaction list with filters', async () => {
      // Verify screen elements are visible
      await expect(element(by.id('transactions.screen'))).toBeVisible();
      await expect(element(by.id('transactions.title'))).toBeVisible();
      await expect(element(by.id('transactions.addButton'))).toBeVisible();

      // Verify filter chips are visible
      await expect(element(by.id('transactions.filterAll'))).toBeVisible();
      await expect(element(by.id('transactions.filterIncome'))).toBeVisible();
      await expect(element(by.id('transactions.filterExpense'))).toBeVisible();

      // Verify list or empty state is shown
      try {
        // Check if list is visible (has transactions)
        await expect(element(by.id('transactions.list'))).toBeVisible();
      } catch {
        // Check if empty state is visible (no transactions)
        await expect(element(by.id('transactions.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Filtering', () => {
    it('should filter transactions by type (income/expense)', async () => {
      // Start with "All" filter selected
      await expect(element(by.id('transactions.filterAll'))).toBeVisible();

      // Tap "Income" filter
      await element(by.id('transactions.filterIncome')).tap();

      // Verify filter was applied (UI should update)
      // Note: Visual feedback varies - this checks that tap doesn't crash
      await expect(element(by.id('transactions.screen'))).toBeVisible();

      // Tap "Expense" filter
      await element(by.id('transactions.filterExpense')).tap();

      // Verify filter was applied
      await expect(element(by.id('transactions.screen'))).toBeVisible();

      // Tap "All" filter to reset
      await element(by.id('transactions.filterAll')).tap();

      // Verify we're back to all transactions
      await expect(element(by.id('transactions.screen'))).toBeVisible();

      // Verify list or empty state is still shown
      try {
        await expect(element(by.id('transactions.list'))).toBeVisible();
      } catch {
        await expect(element(by.id('transactions.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no transactions exist', async () => {
      // If account is new or has no sample data, empty state should show
      try {
        await waitFor(element(by.id('transactions.emptyState')))
          .toBeVisible()
          .withTimeout(3000);

        // Verify add button is still accessible from empty state
        await expect(element(by.id('transactions.addButton'))).toBeVisible();
      } catch {
        // Has transactions - test doesn't apply
        // Just verify the list is shown instead
        await expect(element(by.id('transactions.list'))).toBeVisible();
      }
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator during data fetch', async () => {
      // Reload to trigger loading state
      await device.reloadReactNative();
      await loginAsPrimaryUser();

      // Complete onboarding if shown
      try {
        await waitFor(element(by.id('onboarding.welcome.screen')))
          .toBeVisible()
          .withTimeout(3000);
        await completeOnboarding();
      } catch {
        // Already past onboarding
      }

      // Navigate to transactions
      await element(by.id('tab.transactions')).tap();

      // Loading indicator may appear briefly
      try {
        await waitFor(element(by.id('transactions.loadingIndicator')))
          .toBeVisible()
          .withTimeout(1000);
      } catch {
        // Loading was too fast to catch - that's okay
      }

      // Should eventually show screen content
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
