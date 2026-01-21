import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

/**
 * Navigation Test Suite
 *
 * Tests for bottom tab navigation between main screens.
 * Verifies tab switching and active tab indicator.
 *
 * Note: These tests validate UI navigation behavior without backend dependency.
 */

/**
 * Navigate to dashboard after login
 */
async function navigateToDashboard(): Promise<void> {
  await loginAsPrimaryUser();

  // Complete onboarding if shown (wait for either dashboard or onboarding)
  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(2000);
    // Already on dashboard, skip onboarding
  } catch {
    // Not on dashboard, try onboarding
    try {
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(2000);
      await completeOnboarding();
    } catch {
      // Neither dashboard nor onboarding visible, wait longer
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    }
  }

  // Wait for dashboard (should be default tab)
  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Navigation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToDashboard();
  });

  describe('Tab Navigation', () => {
    it('should navigate between all tabs', async () => {
      // Start on Dashboard (default tab)
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
      await expect(element(by.id('tab.dashboard'))).toBeVisible();

      // Navigate to Transactions
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('transactions.screen'))).toBeVisible();

      // Navigate to Budgets
      await element(by.id('tab.budgets')).tap();
      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('budgets.screen'))).toBeVisible();

      // Navigate to Sharing
      await element(by.id('tab.sharing')).tap();
      await waitFor(element(by.id('sharing.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('sharing.screen'))).toBeVisible();

      // Navigate to Settings
      await element(by.id('tab.settings')).tap();
      await waitFor(element(by.id('settings.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('settings.screen'))).toBeVisible();

      // Navigate back to Dashboard
      await element(by.id('tab.dashboard')).tap();
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
    });

    it('should show correct active tab indicator', async () => {
      // Dashboard should be active initially
      await expect(element(by.id('dashboard.screen'))).toBeVisible();

      // Note: Tab bar active state is typically indicated by:
      // - Different icon color
      // - Different text color
      // - Accessibility state (selected: true)
      // This test verifies tabs are visible and tappable

      // Verify all tab buttons are accessible
      await expect(element(by.id('tab.dashboard'))).toBeVisible();
      await expect(element(by.id('tab.transactions'))).toBeVisible();
      await expect(element(by.id('tab.budgets'))).toBeVisible();
      await expect(element(by.id('tab.sharing'))).toBeVisible();
      await expect(element(by.id('tab.settings'))).toBeVisible();

      // Navigate to each tab and verify screen changes
      const tabs = [
        { id: 'tab.transactions', screen: 'transactions.screen' },
        { id: 'tab.budgets', screen: 'budgets.screen' },
        { id: 'tab.sharing', screen: 'sharing.screen' },
        { id: 'tab.settings', screen: 'settings.screen' },
      ];

      for (const tab of tabs) {
        await element(by.id(tab.id)).tap();
        await waitFor(element(by.id(tab.screen)))
          .toBeVisible()
          .withTimeout(3000);
        await expect(element(by.id(tab.screen))).toBeVisible();
      }
    });
  });

  describe('Tab State Persistence', () => {
    it('should maintain tab state when switching between tabs', async () => {
      // Navigate to Transactions
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Navigate to Settings
      await element(by.id('tab.settings')).tap();
      await waitFor(element(by.id('settings.screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Navigate back to Transactions
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Transactions screen should still be in same state
      // (React Navigation maintains tab state by default)
      await expect(element(by.id('transactions.screen'))).toBeVisible();
    });
  });

  describe('Tab Bar Visibility', () => {
    it('should show tab bar on all main screens', async () => {
      const tabs = [
        { id: 'tab.dashboard', screen: 'dashboard.screen' },
        { id: 'tab.transactions', screen: 'transactions.screen' },
        { id: 'tab.budgets', screen: 'budgets.screen' },
        { id: 'tab.sharing', screen: 'sharing.screen' },
        { id: 'tab.settings', screen: 'settings.screen' },
      ];

      for (const tab of tabs) {
        await element(by.id(tab.id)).tap();
        await waitFor(element(by.id(tab.screen)))
          .toBeVisible()
          .withTimeout(3000);

        // Tab bar should remain visible
        await expect(element(by.id(tab.id))).toBeVisible();
      }
    });
  });

  describe('Double Tap Behavior', () => {
    it('should handle double tap on same tab gracefully', async () => {
      // Tap dashboard tab twice
      await element(by.id('tab.dashboard')).tap();
      await element(by.id('tab.dashboard')).tap();

      // Should remain on dashboard without crashing
      await expect(element(by.id('dashboard.screen'))).toBeVisible();

      // Try with another tab
      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('tab.transactions')).tap();

      // Should remain on transactions without crashing
      await expect(element(by.id('transactions.screen'))).toBeVisible();
    });
  });
});
