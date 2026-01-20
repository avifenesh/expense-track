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
 * Wait for the app to finish loading and show the login screen.
 * Uses testID for reliable element selection.
 */
async function waitForAppReady(): Promise<void> {
  // Disable Detox synchronization to avoid timeout on animations/timers
  await device.disableSynchronization();

  try {
    // First, wait a moment for the app to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for login screen container to be visible
    // Using testID is more reliable than by.text() when there are multiple elements with same text
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(30000);
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
      // Use testIDs for reliable element matching
      await expect(element(by.id('login.title'))).toBeVisible();
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
      await expect(element(by.id('login.registerLink'))).toBeVisible();
      await expect(element(by.id('login.resetPasswordLink'))).toBeVisible();
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
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display registration screen elements', async () => {
      await expect(element(by.id('register.title'))).toBeVisible();
      await expect(element(by.id('register.displayNameInput'))).toBeVisible();
      await expect(element(by.id('register.emailInput'))).toBeVisible();
      await expect(element(by.id('register.passwordInput'))).toBeVisible();
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
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Reset Password Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display reset password screen elements', async () => {
      await expect(element(by.id('resetPassword.title'))).toBeVisible();
      await expect(element(by.id('resetPassword.emailInput'))).toBeVisible();
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
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
