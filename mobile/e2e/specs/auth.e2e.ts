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
 * Uses by.text() as primary selector since it's more reliable than testID
 * in React Native apps with native stack navigator.
 */
async function waitForAppReady(): Promise<void> {
  // Disable Detox synchronization to avoid timeout on animations/timers
  await device.disableSynchronization();

  try {
    // First, wait a moment for the app to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Wait for login screen to appear
    await waitFor(element(by.text('Sign In')))
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
      // Use by.text() for more reliable element matching
      await expect(element(by.text('Sign In'))).toBeVisible();
      await expect(element(by.text('Email'))).toBeVisible();
      await expect(element(by.text('Password'))).toBeVisible();
      await expect(element(by.text("Don't have an account? Register"))).toBeVisible();
      await expect(element(by.text('Forgot password?'))).toBeVisible();
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
      await element(by.text("Don't have an account? Register")).tap();
      await waitFor(element(by.text('Create Account')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display registration screen elements', async () => {
      await expect(element(by.text('Create Account'))).toBeVisible();
      await expect(element(by.text('Display Name'))).toBeVisible();
      await expect(element(by.text('Email'))).toBeVisible();
      await expect(element(by.text('Password'))).toBeVisible();
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
      await element(by.text('Already have an account? Sign in')).tap();
      await waitFor(element(by.text('Sign In')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Reset Password Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.text('Forgot password?')).tap();
      await waitFor(element(by.text('Reset Password')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display reset password screen elements', async () => {
      await expect(element(by.text('Reset Password'))).toBeVisible();
      await expect(element(by.text('Email'))).toBeVisible();
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
      await waitFor(element(by.text('Sign In')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
