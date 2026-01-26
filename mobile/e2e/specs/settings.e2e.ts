/**
 * Settings E2E Tests
 * Tests Export Data and Delete Account flows with real backend
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestApiClient } from '../helpers/api-client';
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures';
import {
  LoginScreen,
  DashboardScreen,
  SettingsScreen,
  ExportFormatModal,
  DeleteAccountModal,
  navigateToTab,
} from '../contracts/ui-contracts';

describe('Settings E2E Tests', () => {
  let api: TestApiClient;

  beforeAll(async () => {
    api = new TestApiClient();
    // Ensure test user exists before running tests
    await api.ensureTestUser(TEST_USER, true);
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await LoginScreen.waitForScreen();

    // Login and navigate to settings
    await LoginScreen.login(TEST_USER.email, TEST_USER.password);

    // Disable sync for dashboard (continuous data fetching)
    await device.disableSynchronization();
    try {
      await DashboardScreen.waitForScreen();
    } finally {
      await device.enableSynchronization();
    }

    // Navigate to Settings tab
    await navigateToTab('Settings');
    await SettingsScreen.waitForScreen();
  });

  describe('Settings Screen UI', () => {
    it('displays Export Data and Delete Account buttons', async () => {
      await expect(element(by.id('settings.exportDataButton'))).toBeVisible();
      await expect(element(by.id('settings.deleteAccountButton'))).toBeVisible();
    });

    it('displays logout button', async () => {
      await expect(element(by.id('logout-button'))).toBeVisible();
    });
  });

  describe('Export Data Flow', () => {
    it('opens export format modal when Export Data is tapped', async () => {
      await SettingsScreen.tapExportData();
      await ExportFormatModal.waitForModal();
      await ExportFormatModal.assertVisible();
    });

    it('shows JSON and CSV format options', async () => {
      await SettingsScreen.tapExportData();
      await ExportFormatModal.waitForModal();

      await expect(element(by.id('export-format-modal.json'))).toBeVisible();
      await expect(element(by.id('export-format-modal.csv'))).toBeVisible();
    });

    it('closes export modal when cancel is tapped', async () => {
      await SettingsScreen.tapExportData();
      await ExportFormatModal.waitForModal();

      await ExportFormatModal.tapCancel();

      await waitFor(element(by.id('export-format-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
    });

    it('exports data in JSON format', async () => {
      await SettingsScreen.tapExportData();
      await ExportFormatModal.waitForModal();

      // Select JSON format
      await ExportFormatModal.selectJson();

      // Wait for export to complete (Share dialog will appear)
      // Note: We can't fully test the Share sheet in Detox, but we verify no errors
      await waitFor(element(by.id('export-format-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.LONG);

      // Modal should close on success
      await ExportFormatModal.assertNotVisible();
    });

    it('exports data in CSV format', async () => {
      await SettingsScreen.tapExportData();
      await ExportFormatModal.waitForModal();

      // Select CSV format
      await ExportFormatModal.selectCsv();

      // Wait for export to complete
      await waitFor(element(by.id('export-format-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.LONG);

      // Modal should close on success
      await ExportFormatModal.assertNotVisible();
    });
  });

  describe('Delete Account Flow', () => {
    it('opens delete account modal when Delete Account is tapped', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();
      await DeleteAccountModal.assertVisible();
    });

    it('shows warning text in delete modal', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();

      await expect(element(by.text('This action cannot be undone'))).toBeVisible();
    });

    it('shows email confirmation input', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();

      await expect(element(by.id('delete-account-modal.email-input'))).toBeVisible();
    });

    it('closes delete modal when cancel is tapped', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();

      await DeleteAccountModal.tapCancel();

      await waitFor(element(by.id('delete-account-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
    });

    it('disables confirm button when email does not match', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();

      // Confirm button should be disabled initially
      await DeleteAccountModal.assertConfirmDisabled();

      // Enter wrong email
      await DeleteAccountModal.enterEmail('wrong@email.com');

      // Confirm button should still be disabled
      await DeleteAccountModal.assertConfirmDisabled();
    });

    it('enables confirm button when email matches', async () => {
      await SettingsScreen.tapDeleteAccount();
      await DeleteAccountModal.waitForModal();

      // Confirm button should be disabled initially
      await DeleteAccountModal.assertConfirmDisabled();

      // Enter correct email (matching TEST_USER)
      await DeleteAccountModal.enterEmail(TEST_USER.email);

      // Confirm button should now be enabled
      await DeleteAccountModal.assertConfirmEnabled();
    });

    // Note: We intentionally do NOT test the actual account deletion
    // as this would delete the test user and break subsequent tests.
    // The actual delete flow is covered by unit tests and API tests.
  });

  describe('Logout Flow', () => {
    it('logs out and navigates to login screen', async () => {
      await SettingsScreen.tapLogout();

      // Should navigate back to login screen
      await LoginScreen.waitForScreen();
      await LoginScreen.assertVisible();
    });
  });
});
