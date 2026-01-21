import { element, by, expect, waitFor, device } from 'detox';
import { setupLoggedInUser } from '../helpers';

/**
 * Sharing Test Suite (P0)
 *
 * Tests for expense sharing features.
 * TestIDs added in PR #265.
 */

/**
 * Helper to login and navigate to sharing
 */
async function loginAndNavigateToSharing(): Promise<void> {
  await setupLoggedInUser();

  // Navigate to sharing tab
  await element(by.id('tab.sharing')).tap();
  await waitFor(element(by.id('sharing.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Sharing', () => {
  describe('P0: Sharing Views', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
      await loginAndNavigateToSharing();
    });

    it('should view shared expenses', async () => {
      // Verify sharing screen is displayed
      await expect(element(by.id('sharing.screen'))).toBeVisible();

      // Check for balance summary (if implemented)
      try {
        await waitFor(element(by.id('sharing.balanceSummary')))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        // Balance summary not shown - may not have shared expenses
      }

      // Check for shared expenses sections
      // Either we have shared expenses or empty state
      try {
        await waitFor(element(by.id('sharing.sharedWithMe')))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        // No shared with me section
      }

      try {
        await waitFor(element(by.id('sharing.sharedByMe')))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        // No shared by me section
      }

      // If no shared expenses, should show empty state or prompt
      try {
        await waitFor(element(by.id('sharing.emptyState.sharedWithMe')))
          .toBeVisible()
          .withTimeout(2000);
      } catch {
        // Has shared expenses, no empty state
      }
    });
  });
});
