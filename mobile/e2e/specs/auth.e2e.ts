import { device, element, by, expect, waitFor } from 'detox';
import { TEST_USERS } from '../helpers/fixtures';

/**
 * Authentication Test Suite
 *
 * Tests for login, registration, and password reset flows.
 * Note: These tests require a running backend API with test users configured.
 */

describe('Authentication', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login Flow', () => {
    it('should display login screen with all required elements', async () => {
      await expect(element(by.id('login.screen'))).toBeVisible();
      await expect(element(by.id('login.title'))).toHaveText('Sign In');
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
      await expect(element(by.id('login.submitButton'))).toBeVisible();
      await expect(element(by.id('login.registerLink'))).toBeVisible();
      await expect(element(by.id('login.resetPasswordLink'))).toBeVisible();
    });

    it('should show email validation error for invalid email', async () => {
      await element(by.id('login.emailInput')).tap();
      await element(by.id('login.emailInput')).typeText('notanemail');
      await element(by.id('login.submitButton')).tap();

      await expect(element(by.id('login.emailInput-error'))).toBeVisible();
    });

    it('should show error for empty password', async () => {
      await element(by.id('login.emailInput')).tap();
      await element(by.id('login.emailInput')).typeText(TEST_USERS.primary.email);
      await element(by.id('login.submitButton')).tap();

      await expect(element(by.id('login.errorContainer'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('login.emailInput')).tap();
      await element(by.id('login.emailInput')).typeText(TEST_USERS.invalid.email);

      await element(by.id('login.passwordInput')).tap();
      await element(by.id('login.passwordInput')).typeText(TEST_USERS.invalid.password);

      await element(by.id('login.submitButton')).tap();

      // Wait for API response and error
      await waitFor(element(by.id('login.errorContainer')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('should show loading state during login attempt', async () => {
      await element(by.id('login.emailInput')).tap();
      await element(by.id('login.emailInput')).typeText(TEST_USERS.primary.email);

      await element(by.id('login.passwordInput')).tap();
      await element(by.id('login.passwordInput')).typeText(TEST_USERS.primary.password);

      await element(by.id('login.submitButton')).tap();

      // Loading indicator should appear briefly
      // Note: This may be too fast to catch in some cases
      await waitFor(element(by.id('login.submitButton-loading')))
        .toBeVisible()
        .withTimeout(1000);
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      // Navigate to registration screen
      await element(by.id('login.registerLink')).tap();
      await expect(element(by.id('register.screen'))).toBeVisible();
    });

    it('should display registration screen with all required elements', async () => {
      await expect(element(by.id('register.title'))).toHaveText('Create Account');
      await expect(element(by.id('register.displayNameInput'))).toBeVisible();
      await expect(element(by.id('register.emailInput'))).toBeVisible();
      await expect(element(by.id('register.passwordInput'))).toBeVisible();
      await expect(element(by.id('register.submitButton'))).toBeVisible();
      await expect(element(by.id('register.loginLink'))).toBeVisible();
    });

    it('should validate display name is required', async () => {
      await element(by.id('register.emailInput')).tap();
      await element(by.id('register.emailInput')).typeText('test@example.com');

      await element(by.id('register.passwordInput')).tap();
      await element(by.id('register.passwordInput')).typeText('TestPass123!');

      await element(by.id('register.submitButton')).tap();

      await expect(element(by.id('register.displayNameInput-error'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('register.displayNameInput')).tap();
      await element(by.id('register.displayNameInput')).typeText('Test User');

      await element(by.id('register.emailInput')).tap();
      await element(by.id('register.emailInput')).typeText('invalid-email');

      await element(by.id('register.passwordInput')).tap();
      await element(by.id('register.passwordInput')).typeText('TestPass123!');

      await element(by.id('register.submitButton')).tap();

      await expect(element(by.id('register.emailInput-error'))).toBeVisible();
    });

    it('should show password requirements when password field focused', async () => {
      await element(by.id('register.passwordInput')).tap();

      await expect(element(by.id('register.passwordRequirements'))).toBeVisible();
    });

    it('should navigate back to login', async () => {
      await element(by.id('register.loginLink')).tap();

      await expect(element(by.id('login.screen'))).toBeVisible();
    });
  });

  describe('Reset Password Flow', () => {
    beforeEach(async () => {
      // Navigate to reset password screen
      await element(by.id('login.resetPasswordLink')).tap();
      await expect(element(by.id('resetPassword.screen'))).toBeVisible();
    });

    it('should display reset password screen with all required elements', async () => {
      await expect(element(by.id('resetPassword.title'))).toHaveText('Reset Password');
      await expect(element(by.id('resetPassword.emailInput'))).toBeVisible();
      await expect(element(by.id('resetPassword.requestButton'))).toBeVisible();
      await expect(element(by.id('resetPassword.backButton'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('resetPassword.emailInput')).tap();
      await element(by.id('resetPassword.emailInput')).typeText('invalid-email');

      await element(by.id('resetPassword.requestButton')).tap();

      await expect(element(by.id('resetPassword.emailInput-error'))).toBeVisible();
    });

    it('should show success message after requesting reset', async () => {
      await element(by.id('resetPassword.emailInput')).tap();
      await element(by.id('resetPassword.emailInput')).typeText('test@example.com');

      await element(by.id('resetPassword.requestButton')).tap();

      // Should navigate to "sent" screen
      await waitFor(element(by.id('resetPassword.sentScreen')))
        .toBeVisible()
        .withTimeout(10000);

      await expect(element(by.id('resetPassword.sentTitle'))).toHaveText('Check Your Email');
    });

    it('should navigate back to login', async () => {
      await element(by.id('resetPassword.backButton')).tap();

      await expect(element(by.id('login.screen'))).toBeVisible();
    });
  });
});
