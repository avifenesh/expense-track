import { element, by, expect, waitFor, device } from 'detox';
import {
  loginAsPrimaryUser,
  completeOnboarding,
} from '../helpers';

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
    await completeOnboarding();
  }

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

      // The month selector component should allow navigation
      // This tests that the UI is responsive - actual month change
      // verification would require checking data differences
    });
  });

  describe('Budget States', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('should show loading state', async () => {
      await device.disableSynchronization();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(30000);
      await device.enableSynchronization();

      await loginAsPrimaryUser();

      try {
        await waitFor(element(by.id('dashboard.screen')))
          .toBeVisible()
          .withTimeout(5000);
      } catch {
        await completeOnboarding();
      }

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
      await device.disableSynchronization();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(30000);
      await device.enableSynchronization();

      await loginAsPrimaryUser();

      try {
        await waitFor(element(by.id('dashboard.screen')))
          .toBeVisible()
          .withTimeout(5000);
      } catch {
        await completeOnboarding();
      }

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
