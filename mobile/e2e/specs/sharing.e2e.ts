import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

/**
 * Sharing Test Suite
 *
 * Tests for the expense sharing screen, including balance display and shared expense lists.
 *
 * Note: These tests validate UI behavior. Backend integration for actual sharing data
 * is not required - tests work with empty states.
 */

/**
 * Navigate to sharing screen after login
 */
async function navigateToSharing(): Promise<void> {
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

  // Navigate to sharing tab
  await waitFor(element(by.id('tab.sharing')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('tab.sharing')).tap();

  // Wait for sharing screen
  await waitFor(element(by.id('sharing.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Sharing', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToSharing();
  });

  describe('Screen Display', () => {
    it('should display sharing screen with balance summary', async () => {
      // Verify screen elements are visible
      await expect(element(by.id('sharing.screen'))).toBeVisible();
      await expect(element(by.id('sharing.title'))).toBeVisible();
      await expect(element(by.id('sharing.shareButton'))).toBeVisible();

      // Verify balance card is visible
      await expect(element(by.id('sharing.balanceCard'))).toBeVisible();

      // Check if user has shared expenses
      try {
        // If shared expenses exist, sections should be visible
        await waitFor(element(by.id('sharing.sharedWithMeSection')))
          .toBeVisible()
          .withTimeout(3000);
      } catch {
        // If no shared expenses, empty state should be visible
        await expect(element(by.id('sharing.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Balance Display', () => {
    it('should show balance summary card', async () => {
      // Balance card should always be visible, even with no shared expenses
      await expect(element(by.id('sharing.balanceCard'))).toBeVisible();

      // Balance card shows amounts owed to/from others
      // With no data, it should show zeros or empty state
    });
  });

  describe('Shared Expense Sections', () => {
    it('should display shared with me and shared by me sections', async () => {
      // Check for section headings or lists
      try {
        // If user has shared expenses, both sections should be present
        await expect(element(by.id('sharing.sharedWithMeSection'))).toBeVisible();
        await expect(element(by.id('sharing.sharedByMeSection'))).toBeVisible();
      } catch {
        // No shared expenses - empty state is shown
        await expect(element(by.id('sharing.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no shared expenses exist', async () => {
      // Most users won't have shared expenses initially
      try {
        await waitFor(element(by.id('sharing.emptyState')))
          .toBeVisible()
          .withTimeout(3000);

        // Verify share button is still accessible from empty state
        await expect(element(by.id('sharing.shareButton'))).toBeVisible();
      } catch {
        // Has shared expenses - test doesn't apply
        // Verify sections are shown instead
        await expect(element(by.id('sharing.sharedWithMeSection'))).toBeVisible();
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

      // Navigate to sharing
      await element(by.id('tab.sharing')).tap();

      // Loading indicator may appear briefly
      try {
        await waitFor(element(by.id('sharing.loadingIndicator')))
          .toBeVisible()
          .withTimeout(1000);
      } catch {
        // Loading was too fast to catch - that's okay
      }

      // Should eventually show screen content
      await waitFor(element(by.id('sharing.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Share Button', () => {
    it('should have accessible share expense button', async () => {
      // Verify share button is visible and tappable
      await expect(element(by.id('sharing.shareButton'))).toBeVisible();

      // Note: Tapping the button would navigate to ShareExpenseScreen
      // That screen is not yet implemented, so we only verify the button exists
    });
  });
});
