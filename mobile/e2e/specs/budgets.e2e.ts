import { element, by, expect, waitFor, device } from 'detox';
import { setupLoggedInUser } from '../helpers';

/**
 * Budget Test Suite (P0)
 *
 * Tests for budget viewing and management.
 * TestIDs added in PR #265.
 */

/**
 * Helper to login and navigate to budgets
 */
async function loginAndNavigateToBudgets(): Promise<void> {
  await setupLoggedInUser();

  // Navigate to budgets tab
  await element(by.id('tab.budgets')).tap();
  await waitFor(element(by.id('budgets.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Budgets', () => {
  describe('P0: Budget Views', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
      await loginAndNavigateToBudgets();
    });

    it('should view budget list', async () => {
      // Verify budget screen elements
      await expect(element(by.id('budgets.screen'))).toBeVisible();
      await expect(element(by.id('budgets.title'))).toBeVisible();
      await expect(element(by.id('budgets.subtitle'))).toBeVisible();

      // Month selector should be visible
      await expect(element(by.id('budgets.monthSelector'))).toBeVisible();

      // Progress card should be visible
      await expect(element(by.id('budgets.progressCard'))).toBeVisible();

      // Category section should be visible
      await expect(element(by.id('budgets.categorySection'))).toBeVisible();
    });

    it('should view budget details', async () => {
      // Check if budgets exist
      try {
        await waitFor(element(by.id('budgets.categoryList')))
          .toBeVisible()
          .withTimeout(5000);

        // If budgets exist, verify category cards
        await expect(element(by.id('budgets.categoryCard.0'))).toBeVisible();

        // Verify progress card shows data
        await expect(element(by.id('budgets.progressCard'))).toBeVisible();
      } catch {
        // No budgets set, verify empty state
        await expect(element(by.id('budgets.emptyState'))).toBeVisible();
      }
    });

    it('should navigate between months', async () => {
      // Verify month selector is interactive
      await expect(element(by.id('budgets.monthSelector'))).toBeVisible();
      await expect(element(by.id('budgets.monthSelector-label'))).toBeVisible();

      // Get initial month label for comparison
      // We verify navigation by checking the buttons are tappable

      // Navigate to previous month
      await element(by.id('budgets.monthSelector-prev')).tap();

      // Wait for list to refresh after month change
      await waitFor(element(by.id('budgets.monthSelector')))
        .toBeVisible()
        .withTimeout(3000);

      // Navigate to next month (back to current)
      await element(by.id('budgets.monthSelector-next')).tap();

      // Wait for list to refresh
      await waitFor(element(by.id('budgets.monthSelector')))
        .toBeVisible()
        .withTimeout(3000);

      // Navigate to next month again
      await element(by.id('budgets.monthSelector-next')).tap();

      // Verify the month selector is still functional
      await expect(element(by.id('budgets.monthSelector-label'))).toBeVisible();
    });
  });

  describe('Budget States', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('should show loading state', async () => {
      await setupLoggedInUser();

      // Navigate to budgets - might briefly show loading
      await element(by.id('tab.budgets')).tap();

      // Either loading screen or main screen should be visible
      try {
        await waitFor(element(by.id('budgets.loadingScreen')))
          .toBeVisible()
          .withTimeout(2000);
      } catch {
        // Loading was fast, main screen shown
        await expect(element(by.id('budgets.screen'))).toBeVisible();
      }
    });

    it('should handle error states gracefully', async () => {
      await setupLoggedInUser();

      await element(by.id('tab.budgets')).tap();

      // If error occurs, retry button should be visible
      try {
        await waitFor(element(by.id('budgets.errorScreen')))
          .toBeVisible()
          .withTimeout(3000);

        // Error state should have retry button
        await expect(element(by.id('budgets.retryButton'))).toBeVisible();
      } catch {
        // No error, main screen shown
        await expect(element(by.id('budgets.screen'))).toBeVisible();
      }
    });
  });
});
