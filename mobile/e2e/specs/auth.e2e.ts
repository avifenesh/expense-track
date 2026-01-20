import { element, by, expect, waitFor, device } from 'detox';

/**
 * Authentication Test Suite
 *
 * Tests for UI rendering and validation on auth screens.
 *
 * Note: These tests validate UI behavior only and do not require a backend.
 * Full auth flow tests with backend integration will be added in a follow-up PR.
 */

/**
 * Wait for the app to finish loading.
 */
async function waitForAppReady(): Promise<void> {
  await device.disableSynchronization();
  try {
    // Wait for loading to finish
    try {
      await waitFor(element(by.id('root.loadingScreen')))
        .not.toBeVisible()
        .withTimeout(20000);
    } catch {
      // Loading screen may not exist or already gone
    }

    // Wait for login title to appear
    await waitFor(element(by.id('login.title')))
      .toExist()
      .withTimeout(15000);
  } finally {
    await device.enableSynchronization();
  }
}

describe('Authentication', () => {
  describe('Login Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
    });

    it('should display login screen with all elements', async () => {
      await expect(element(by.id('login.title'))).toExist();
      await expect(element(by.id('login.emailInput'))).toExist();
      await expect(element(by.id('login.passwordInput'))).toExist();
      await expect(element(by.id('login.submitButton'))).toExist();
      await expect(element(by.id('login.registerLink'))).toExist();
      await expect(element(by.id('login.resetPasswordLink'))).toExist();
    });

    it('should validate email format', async () => {
      await element(by.id('login.emailInput')).typeText('notanemail');
      await element(by.id('login.passwordInput')).typeText('password123');
      await element(by.id('login.submitButton')).tap();

      await waitFor(element(by.id('login.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should require password', async () => {
      await element(by.id('login.emailInput')).typeText('test@example.com');
      await element(by.id('login.submitButton')).tap();

      await waitFor(element(by.id('login.errorContainer')))
        .toExist()
        .withTimeout(5000);
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.id('login.registerLink')).tap();
      await waitFor(element(by.id('register.screen')))
        .toExist()
        .withTimeout(5000);
    });

    it('should display registration screen elements', async () => {
      await expect(element(by.id('register.title'))).toExist();
      await expect(element(by.id('register.displayNameInput'))).toExist();
      await expect(element(by.id('register.emailInput'))).toExist();
      await expect(element(by.id('register.passwordInput'))).toExist();
      await expect(element(by.id('register.submitButton'))).toExist();
      await expect(element(by.id('register.loginLink'))).toExist();
    });

    it('should validate email format', async () => {
      await element(by.id('register.displayNameInput')).typeText('Test User');
      await element(by.id('register.emailInput')).typeText('invalid-email');
      await element(by.id('register.passwordInput')).typeText('TestPass123!');
      await element(by.id('register.submitButton')).tap();

      await waitFor(element(by.id('register.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should navigate back to login', async () => {
      await element(by.id('register.loginLink')).tap();
      await waitFor(element(by.id('login.screen')))
        .toExist()
        .withTimeout(5000);
    });
  });

  describe('Reset Password Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toExist()
        .withTimeout(5000);
    });

    it('should display reset password screen elements', async () => {
      await expect(element(by.id('resetPassword.title'))).toExist();
      await expect(element(by.id('resetPassword.emailInput'))).toExist();
      await expect(element(by.id('resetPassword.requestButton'))).toExist();
      await expect(element(by.id('resetPassword.backButton'))).toExist();
    });

    it('should validate email format', async () => {
      await element(by.id('resetPassword.emailInput')).typeText('invalid-email');
      await element(by.id('resetPassword.requestButton')).tap();

      await waitFor(element(by.id('resetPassword.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should navigate back to login', async () => {
      await element(by.id('resetPassword.backButton')).tap();
      await waitFor(element(by.id('login.screen')))
        .toExist()
        .withTimeout(5000);
    });
  });
});
