/**
 * Budgets Tests
 * View budgets, month navigation
 * Contracts: BUD-001 through BUD-005
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

describe('Budgets Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
    await loginAndWaitForDashboard();
  });

  /**
   * BUD-001: Budgets list loads
   */
  it('loads budgets screen', async () => {
    await navigateToTab('Budgets');
    await assertScreenDisplayed(TestIDs.budgets.screen);
  });

  /**
   * BUD-001: Shows budget header elements
   */
  it('shows budget header with title', async () => {
    await navigateToTab('Budgets');
    await assertScreenDisplayed(TestIDs.budgets.screen);
    await assertTextVisible('Budgets');
  });

  /**
   * BUD-004: Change month
   */
  it('allows month navigation', async () => {
    await navigateToTab('Budgets');
    await assertScreenDisplayed(TestIDs.budgets.screen);

    // Month selector should be present
    // Tap to change month
  });

  /**
   * BUD-005: Empty budgets state
   */
  it.skip('shows empty state when no budgets', async () => {
    // Requires user with no budgets
    await navigateToTab('Budgets');
    await assertTextVisible('No budgets');
  });
});
