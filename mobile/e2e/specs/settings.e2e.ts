/**
 * Settings Tests
 * Biometric toggle, logout
 * Contracts: SET-001 through SET-003
 */

import { device, element, by, waitFor } from 'detox';
import {
  TestIDs,
  Timeouts,
  waitForAppReady,
  waitForElement,
  loginAndWaitForDashboard,
  navigateToTab,
  logout,
  assertScreenDisplayed,
  assertVisible,
  assertTextVisible,
} from '../helpers';

describe('Settings Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
    await loginAndWaitForDashboard();
  });

  /**
   * SET-001: Settings screen
   */
  it('loads settings screen with sections', async () => {
    await navigateToTab('Settings');
    await assertScreenDisplayed(TestIDs.settings.screen);
    await assertTextVisible('Settings');
  });

  /**
   * SET-001: Settings has logout button
   */
  it('shows logout button', async () => {
    await navigateToTab('Settings');
    await assertScreenDisplayed(TestIDs.settings.screen);
    await assertVisible(TestIDs.settings.logoutButton);
  });

  /**
   * SET-002: Toggle biometric (if available)
   */
  it.skip('toggles biometric setting', async () => {
    await navigateToTab('Settings');

    // Check if biometric switch exists (device dependent)
    await assertVisible(TestIDs.settings.biometricSwitch);

    // Toggle it
    await element(by.id(TestIDs.settings.biometricSwitch)).tap();
  });

  /**
   * SET-003: Sign out
   */
  it('signs out and returns to login', async () => {
    await logout();
    await assertScreenDisplayed(TestIDs.login.screen);
  });
});
