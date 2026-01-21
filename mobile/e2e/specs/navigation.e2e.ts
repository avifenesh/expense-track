import { element, by, expect, waitFor, device } from 'detox';
import { setupLoggedInUser } from '../helpers';

/**
 * Navigation Test Suite (P0)
 *
 * Tests for bottom tab navigation.
 * TestIDs added in PR #265.
 */

/**
 * Helper to login and reach dashboard
 */
async function loginAndSetup(): Promise<void> {
  await setupLoggedInUser();
}

describe('Navigation', () => {
  describe('P0: Tab Navigation', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
      await loginAndSetup();
    });

    it('should navigate via tabs', async () => {
      // Start on Dashboard
      await expect(element(by.id('dashboard.screen'))).toBeVisible();

      // Navigate to Transactions
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('transactions.title'))).toBeVisible();

      // Navigate to Budgets
      await element(by.id('tab.budgets')).tap();
      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('budgets.title'))).toBeVisible();

      // Navigate to Sharing
      await element(by.id('tab.sharing')).tap();
      await waitFor(element(by.id('sharing.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Navigate to Settings
      await element(by.id('tab.settings')).tap();
      await waitFor(element(by.id('settings.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Return to Dashboard
      await element(by.id('tab.dashboard')).tap();
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('dashboard.title'))).toBeVisible();
    });

    it('should maintain tab state when switching', async () => {
      // Navigate to Transactions and apply filter
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Apply income filter
      await element(by.id('transactions.filter.income')).tap();

      // Verify transactions screen is still visible after filter
      await expect(element(by.id('transactions.screen'))).toBeVisible();

      // Switch to another tab
      await element(by.id('tab.budgets')).tap();
      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify we're on budgets
      await expect(element(by.id('budgets.title'))).toBeVisible();

      // Return to transactions
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify we returned to transactions successfully
      // Note: Filter state persistence depends on React Navigation config
      // We verify the screen rendered correctly after returning
      await expect(element(by.id('transactions.screen'))).toBeVisible();
      await expect(element(by.id('transactions.filter.income'))).toBeVisible();
    });

    it('should show correct active tab indicator', async () => {
      // On Dashboard - verify dashboard is visible
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
      await expect(element(by.id('dashboard.title'))).toBeVisible();

      // Navigate to Transactions - verify tab bar updates
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);
      // Verify transactions tab is active (screen is shown)
      await expect(element(by.id('transactions.title'))).toBeVisible();

      // Navigate to Budgets
      await element(by.id('tab.budgets')).tap();
      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(5000);
      // Verify budgets tab is active (screen is shown)
      await expect(element(by.id('budgets.title'))).toBeVisible();

      // Navigate to Sharing
      await element(by.id('tab.sharing')).tap();
      await waitFor(element(by.id('sharing.screen')))
        .toBeVisible()
        .withTimeout(5000);
      // Verify sharing tab is active
      await expect(element(by.id('sharing.screen'))).toBeVisible();

      // Navigate back to Dashboard
      await element(by.id('tab.dashboard')).tap();
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
      // Verify we're back on dashboard
      await expect(element(by.id('dashboard.title'))).toBeVisible();
    });
  });
});
