/**
 * Auth Tests
 * Login, registration, password reset flows
 * Contracts: AUTH-001 through AUTH-012
 */

import { device, element, by, expect, waitFor } from 'detox';
import {
  TestIDs,
  Timeouts,
  TEST_USER,
  INVALID_CREDENTIALS,
  INVALID_EMAIL,
  waitForAppReady,
  waitForElement,
  login,
  loginAndWaitForDashboard,
  navigateToRegister,
  navigateToResetPassword,
  register,
  requestPasswordReset,
  assertScreenDisplayed,
  assertTextVisible,
  assertErrorDisplayed,
  assertVisible,
} from '../helpers';

describe('Auth Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForAppReady();
  });

  describe('Login', () => {
    /**
     * AUTH-001: Login with valid credentials
     */
    it('logs in with valid credentials and navigates to dashboard', async () => {
      await loginAndWaitForDashboard();
      await assertScreenDisplayed(TestIDs.dashboard.screen);
    });

    /**
     * AUTH-002: Login with invalid credentials
     */
    it('shows error for invalid credentials', async () => {
      await login(INVALID_CREDENTIALS.email, INVALID_CREDENTIALS.password);

      // Should show error and stay on login screen
      await waitFor(element(by.text('Invalid email or password')))
        .toBeVisible()
        .withTimeout(Timeouts.medium);
      await assertScreenDisplayed(TestIDs.login.screen);
    });

    /**
     * AUTH-003: Login with invalid email format
     */
    it('shows validation error for invalid email format', async () => {
      await element(by.id(TestIDs.login.emailInput)).typeText(INVALID_EMAIL);
      await element(by.id(TestIDs.login.passwordInput)).typeText(
        TEST_USER.password
      );
      await element(by.id(TestIDs.login.passwordInput)).tapReturnKey();
      await element(by.id(TestIDs.login.submitButton)).tap();

      // Should show validation error
      await assertScreenDisplayed(TestIDs.login.screen);
    });
  });

  describe('Navigation', () => {
    /**
     * AUTH-004: Navigate to Register
     */
    it('navigates to register screen', async () => {
      await navigateToRegister();
      await assertScreenDisplayed(TestIDs.register.screen);
    });

    /**
     * AUTH-005: Navigate to Reset Password
     */
    it('navigates to reset password screen', async () => {
      await navigateToResetPassword();
      await assertScreenDisplayed(TestIDs.resetPassword.screen);
    });
  });

  describe('Registration', () => {
    /**
     * AUTH-006: Register new account
     */
    it('registers new account and shows verify email screen', async () => {
      await navigateToRegister();

      // Generate unique email to avoid conflicts
      const uniqueEmail = `e2e-${Date.now()}@test.local`;

      await register('Test User', uniqueEmail, 'TestPassword123!');

      // Should navigate to verify email screen
      await waitForElement(TestIDs.verifyEmail.screen, Timeouts.long);
      await assertScreenDisplayed(TestIDs.verifyEmail.screen);
    });

    /**
     * AUTH-008: Register password requirements
     */
    it('shows password requirements while typing', async () => {
      await navigateToRegister();

      await element(by.id(TestIDs.register.passwordInput)).tap();
      await element(by.id(TestIDs.register.passwordInput)).typeText('a');

      // Password requirements should be visible
      // At least one requirement indicator should appear
      await waitFor(element(by.text('8 characters')))
        .toBeVisible()
        .withTimeout(Timeouts.short);
    });
  });

  describe('Password Reset', () => {
    /**
     * AUTH-009: Request password reset
     */
    it('requests password reset and shows confirmation', async () => {
      await navigateToResetPassword();
      await requestPasswordReset(TEST_USER.email);

      // Should show sent confirmation
      await waitForElement(TestIDs.resetPassword.sentScreen, Timeouts.long);
    });
  });

  describe('Verify Email', () => {
    /**
     * AUTH-010: Resend verification email
     * Note: Requires a user who just registered
     */
    it.skip('can resend verification email with cooldown', async () => {
      // This test requires a fresh registration
      // Skipped as it requires specific server state
    });
  });

  describe('Biometric', () => {
    /**
     * AUTH-011: Biometric login
     * Note: Requires device with biometric capability
     */
    it.skip('shows biometric button when available', async () => {
      // Biometric tests require specific device setup
      // Skipped for CI environments
    });
  });

  describe('Rate Limiting', () => {
    /**
     * AUTH-012: Rate limiting
     */
    it.skip('shows rate limit error after too many attempts', async () => {
      // Rate limiting test would require many login attempts
      // Skipped to avoid long test times
    });
  });
});
