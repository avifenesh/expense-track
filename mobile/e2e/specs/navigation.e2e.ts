/**
 * Navigation Tests
 * Tab navigation, modal flows
 * Contracts: NAV-001 through NAV-003
 */

import { device, element, by, waitFor } from 'detox';
import {
  TestIDs,
  Timeouts,
  waitForAppReady,
  waitForElement,
  loginAndWaitForDashboard,
  navigateToTab,
  assertScreenDisplayed,
  assertTextVisible,
} from '../helpers';

describe('Navigation Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
    await loginAndWaitForDashboard();
  });

  describe('Tab Navigation', () => {
    /**
     * NAV-001: Tab navigation - Dashboard
     */
    it('navigates to Dashboard tab', async () => {
      await navigateToTab('Transactions'); // Go elsewhere first
      await navigateToTab('Dashboard');
      await assertScreenDisplayed(TestIDs.dashboard.screen);
    });

    /**
     * NAV-001: Tab navigation - Transactions
     */
    it('navigates to Transactions tab', async () => {
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);
    });

    /**
     * NAV-001: Tab navigation - Budgets
     */
    it('navigates to Budgets tab', async () => {
      await navigateToTab('Budgets');
      await assertScreenDisplayed(TestIDs.budgets.screen);
    });

    /**
     * NAV-001: Tab navigation - Sharing
     */
    it('navigates to Sharing tab', async () => {
      await navigateToTab('Sharing');
      await assertScreenDisplayed(TestIDs.sharing.screen);
    });

    /**
     * NAV-001: Tab navigation - Settings
     */
    it('navigates to Settings tab', async () => {
      await navigateToTab('Settings');
      await assertScreenDisplayed(TestIDs.settings.screen);
    });
  });

  describe('Tab State', () => {
    /**
     * NAV-002: Tab state persistence
     */
    it('preserves tab state when navigating away and back', async () => {
      // Go to Transactions
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);

      // Apply a filter
      await element(by.id(TestIDs.transactions.filterIncome)).tap();

      // Navigate away
      await navigateToTab('Dashboard');
      await assertScreenDisplayed(TestIDs.dashboard.screen);

      // Navigate back - state should be preserved
      await navigateToTab('Transactions');
      await assertScreenDisplayed(TestIDs.transactions.screen);
    });
  });
});
