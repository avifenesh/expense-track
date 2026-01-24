/**
 * Auth E2E Tests
 * Tests login, registration, and password reset flows with real backend
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestApiClient } from '../helpers/api-client';
import { TEST_USER, INVALID_USER, TIMEOUTS } from '../helpers/fixtures';
import {
  LoginScreen,
  RegisterScreen,
  ResetPasswordScreen,
  DashboardScreen,
} from '../contracts/ui-contracts';

describe('Auth E2E Tests', () => {
  let api: TestApiClient;

  beforeAll(async () => {
    api = new TestApiClient();
    // Ensure test user exists before running tests
    await api.ensureTestUser(TEST_USER, true);
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await LoginScreen.waitForScreen();
  });

  describe('Login Screen UI', () => {
    it('displays all login form elements', async () => {
      await expect(element(by.id('login.screen'))).toBeVisible();
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
      await expect(element(by.id('login.submitButton'))).toBeVisible();
      await expect(element(by.id('login.registerLink'))).toBeVisible();
      await expect(element(by.id('login.resetPasswordLink'))).toBeVisible();
    });
  });

  describe('Login Flow', () => {
    it('logs in with valid credentials and navigates to dashboard', async () => {
      await LoginScreen.enterEmail(TEST_USER.email);
      await LoginScreen.enterPassword(TEST_USER.password); // Dismisses keyboard
      await LoginScreen.tapSubmit();

      // Should navigate to dashboard (user already completed onboarding)
      await DashboardScreen.waitForScreen();
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
    });

    it('shows error for invalid credentials', async () => {
      await LoginScreen.enterEmail(INVALID_USER.email);
      await LoginScreen.enterPassword(INVALID_USER.password); // Dismisses keyboard
      await LoginScreen.tapSubmit();

      // Should show error message
      await waitFor(element(by.id('login.errorText')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM);
    });

    it('shows validation error for empty email', async () => {
      await LoginScreen.enterPassword(TEST_USER.password); // Dismisses keyboard
      await LoginScreen.tapSubmit();

      // Should show email validation error
      await waitFor(element(by.id('login.emailInput-error')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
    });
  });

  describe('Navigation', () => {
    it('navigates to register screen', async () => {
      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();
      await expect(element(by.id('register.screen'))).toBeVisible();
    });

    it('navigates to reset password screen', async () => {
      await LoginScreen.tapResetPasswordLink();
      await ResetPasswordScreen.waitForScreen();
      await expect(element(by.id('resetPassword.screen'))).toBeVisible();
    });

    it('navigates back from register to login', async () => {
      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      // Navigate back to login
      await element(by.id('register.loginLink')).tap();
      await LoginScreen.waitForScreen();
      await expect(element(by.id('login.screen'))).toBeVisible();
    });
  });

  describe('Registration Screen UI', () => {
    it('displays all registration form elements', async () => {
      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      await expect(element(by.id('register.displayNameInput'))).toBeVisible();
      await expect(element(by.id('register.emailInput'))).toBeVisible();
      await expect(element(by.id('register.passwordInput'))).toBeVisible();

      // Submit button may be below fold - scroll to see it
      await waitFor(element(by.id('register.submitButton')))
        .toBeVisible()
        .whileElement(by.id('register.screen'))
        .scroll(300, 'down');
      await expect(element(by.id('register.submitButton'))).toBeVisible();
      await expect(element(by.id('register.loginLink'))).toBeVisible();
    });
  });

  describe('Registration Flow', () => {
    it('registers new user and navigates to login (test users auto-verified)', async () => {
      // Generate unique email for this test run
      const uniqueEmail = `e2e-new-${Date.now()}@test.local`;

      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      await RegisterScreen.enterDisplayName('New Test User');
      await RegisterScreen.enterEmail(uniqueEmail);
      await RegisterScreen.enterPassword('TestPassword123!'); // Dismisses keyboard
      await RegisterScreen.tapSubmit(); // Scrolls to button and taps

      // Test users (@test.local) are auto-verified, so they go directly to login
      await LoginScreen.waitForScreen();
      await expect(element(by.id('login.screen'))).toBeVisible();
    });

    it('shows validation error for weak password', async () => {
      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      await RegisterScreen.enterDisplayName('Test User');
      await RegisterScreen.enterEmail('test@test.local');
      await RegisterScreen.enterPassword('weak'); // Too short, missing requirements - dismisses keyboard
      await RegisterScreen.tapSubmit(); // Scrolls to button and taps

      // Should show password requirements
      await waitFor(element(by.id('register.passwordRequirements')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.SHORT);
    });
  });

  describe('Password Reset Screen UI', () => {
    it('displays password reset form elements', async () => {
      await LoginScreen.tapResetPasswordLink();
      await ResetPasswordScreen.waitForScreen();

      await expect(element(by.id('resetPassword.emailInput'))).toBeVisible();
      await expect(element(by.id('resetPassword.requestButton'))).toBeVisible();
    });
  });
});
