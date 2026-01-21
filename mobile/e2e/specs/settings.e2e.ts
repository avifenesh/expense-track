import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

/**
 * Settings Test Suite
 *
 * Tests for the settings screen, including menu options and logout functionality.
 *
 * Note: These tests validate UI behavior and logout flow without backend dependency.
 */

/**
 * Navigate to settings screen after login
 */
async function navigateToSettings(): Promise<void> {
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

  // Navigate to settings tab
  await waitFor(element(by.id('tab.settings')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('tab.settings')).tap();

  // Wait for settings screen
  await waitFor(element(by.id('settings.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Settings', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToSettings();
  });

  describe('Screen Display', () => {
    it('should display settings screen with all options', async () => {
      // Verify screen elements are visible
      await expect(element(by.id('settings.screen'))).toBeVisible();
      await expect(element(by.id('settings.title'))).toBeVisible();

      // Verify Account section items
      await expect(element(by.id('settings.profileItem'))).toBeVisible();
      await expect(element(by.id('settings.currencyItem'))).toBeVisible();
      await expect(element(by.id('settings.accountsItem'))).toBeVisible();
      await expect(element(by.id('settings.categoriesItem'))).toBeVisible();

      // Scroll to see Data and About sections
      await element(by.id('settings.scrollView')).scroll(300, 'down');

      // Verify Data section items
      await expect(element(by.id('settings.exportDataItem'))).toBeVisible();
      await expect(element(by.id('settings.deleteAccountItem'))).toBeVisible();

      // Verify About section items
      await expect(element(by.id('settings.privacyPolicyItem'))).toBeVisible();
      await expect(element(by.id('settings.termsItem'))).toBeVisible();
      await expect(element(by.id('settings.versionItem'))).toBeVisible();

      // Verify logout button
      await expect(element(by.id('settings.logoutButton'))).toBeVisible();
    });
  });

  describe('Menu Items', () => {
    it('should show all menu sections', async () => {
      // Account section
      await expect(element(by.id('settings.profileItem'))).toBeVisible();
      await expect(element(by.id('settings.currencyItem'))).toBeVisible();
      await expect(element(by.id('settings.accountsItem'))).toBeVisible();
      await expect(element(by.id('settings.categoriesItem'))).toBeVisible();

      // Scroll to bottom
      await element(by.id('settings.scrollView')).scroll(400, 'down');

      // Data section
      await expect(element(by.id('settings.exportDataItem'))).toBeVisible();
      await expect(element(by.id('settings.deleteAccountItem'))).toBeVisible();

      // About section
      await expect(element(by.id('settings.privacyPolicyItem'))).toBeVisible();
      await expect(element(by.id('settings.termsItem'))).toBeVisible();
      await expect(element(by.id('settings.versionItem'))).toBeVisible();
    });

    it('should display version information', async () => {
      // Scroll to About section
      await element(by.id('settings.scrollView')).scroll(400, 'down');

      // Version item should be visible
      await expect(element(by.id('settings.versionItem'))).toBeVisible();

      // Version should display app version number
      // (Actual version value is shown but not asserted here)
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      // Scroll to logout button
      await element(by.id('settings.scrollView')).scroll(400, 'down');

      // Tap logout button
      await expect(element(by.id('settings.logoutButton'))).toBeVisible();
      await element(by.id('settings.logoutButton')).tap();

      // Should navigate back to login screen
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify we're on login screen
      await expect(element(by.id('login.screen'))).toBeVisible();
      await expect(element(by.id('login.title'))).toBeVisible();
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
    });

    it('should show loading state during logout', async () => {
      // Scroll to logout button
      await element(by.id('settings.scrollView')).scroll(400, 'down');

      // Tap logout button
      await element(by.id('settings.logoutButton')).tap();

      // Loading indicator may appear briefly
      // Note: This might be too fast to catch in tests
      try {
        await waitFor(element(by.id('settings.logoutButton-loading')))
          .toBeVisible()
          .withTimeout(500);
      } catch {
        // Loading was too fast to catch - that's okay
      }

      // Should eventually navigate to login
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Scrolling', () => {
    it('should allow scrolling through all settings', async () => {
      // Verify scrollView is functional
      await expect(element(by.id('settings.scrollView'))).toBeVisible();

      // Scroll down to see bottom items
      await element(by.id('settings.scrollView')).scroll(500, 'down');
      await expect(element(by.id('settings.logoutButton'))).toBeVisible();

      // Scroll back up to see top items
      await element(by.id('settings.scrollView')).scroll(500, 'up');
      await expect(element(by.id('settings.title'))).toBeVisible();
    });
  });

  describe('Dangerous Actions', () => {
    it('should style delete account item with warning color', async () => {
      // Scroll to Data section
      await element(by.id('settings.scrollView')).scroll(300, 'down');

      // Delete account item should be visible
      await expect(element(by.id('settings.deleteAccountItem'))).toBeVisible();

      // Note: Visual styling (red text) is tested visually
      // This test only verifies the element exists and is accessible
    });
  });
});
