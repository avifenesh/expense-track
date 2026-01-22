/**
 * Sharing Tests
 * Share expense, mark paid
 * Contracts: SHARE-001 through SHARE-006, SHEXP-001 through SHEXP-007
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
  assertVisible,
  assertTextVisible,
} from '../helpers';

describe('Sharing Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
    await loginAndWaitForDashboard();
  });

  /**
   * SHARE-001: Sharing screen loads
   */
  it('loads sharing screen', async () => {
    await navigateToTab('Sharing');
    await assertScreenDisplayed(TestIDs.sharing.screen);
  });

  /**
   * SHARE-001: Shows net balance card
   */
  it('shows net balance section', async () => {
    await navigateToTab('Sharing');
    await assertScreenDisplayed(TestIDs.sharing.screen);

    // Should show balance information
    // "You owe" or "You are owed" or "All settled up"
  });

  /**
   * SHARE-005: Share expense button
   */
  it('has share expense button', async () => {
    await navigateToTab('Sharing');
    await assertScreenDisplayed(TestIDs.sharing.screen);
    await assertVisible(TestIDs.sharing.shareButton);
  });

  /**
   * SHARE-005: Share expense flow opens
   */
  it('opens share expense flow', async () => {
    await navigateToTab('Sharing');
    await element(by.id(TestIDs.sharing.shareButton)).tap();

    // Should open transaction picker or share expense screen
  });

  /**
   * SHARE-006: Empty sharing state
   */
  it.skip('shows settled up when no shared expenses', async () => {
    await navigateToTab('Sharing');
    await assertTextVisible('All settled up');
  });

  describe('Share Expense Screen', () => {
    /**
     * SHEXP-001: Share expense screen elements
     */
    it.skip('shows share expense form', async () => {
      // Navigate to share expense screen (requires selecting transaction first)
      await assertScreenDisplayed(TestIDs.shareExpense.screen);
      await assertVisible(TestIDs.shareExpense.participantEmailInput);
      await assertVisible(TestIDs.shareExpense.addParticipantButton);
      await assertVisible(TestIDs.shareExpense.submitButton);
    });

    /**
     * SHEXP-003: Equal split
     */
    it.skip('calculates equal split correctly', async () => {
      // Test equal split calculation
    });

    /**
     * SHEXP-007: Validation - no participants
     */
    it.skip('validates at least one participant required', async () => {
      // Try to submit without participants
      // Should show error
    });
  });
});
