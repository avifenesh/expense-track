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
  RootLoadingScreen,
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
      await LoginScreen.enterPassword(TEST_USER.password);
      await LoginScreen.tapSubmit();

      await waitFor(element(by.id('login.screen')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.LONG);

      try {
        await waitFor(element(by.id('root.loadingScreen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.SHORT);
        await RootLoadingScreen.waitForDisappear();
      } catch {
        // Loading screen may not appear on fast connections or cached subscription
      }

      await DashboardScreen.waitForScreen();
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
    });

    it('shows error for invalid credentials', async () => {
      await LoginScreen.enterEmail(INVALID_USER.email);
      await LoginScreen.enterPassword(INVALID_USER.password);
      await element(by.id('login.screen')).tap();
      await LoginScreen.tapSubmit();

      await waitFor(element(by.id('login.errorText')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM);
    });

    it('shows validation error for empty email', async () => {
      await LoginScreen.enterPassword(TEST_USER.password);
      await element(by.id('login.screen')).tap();
      await LoginScreen.tapSubmit();

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
      await expect(element(by.id('register.submitButton'))).toBeVisible();
      await expect(element(by.id('register.loginLink'))).toBeVisible();
    });
  });

  describe('Registration Flow', () => {
    it('registers new user and navigates to login (test users auto-verified)', async () => {
      const uniqueEmail = `e2e-new-${Date.now()}@test.local`;

      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      await RegisterScreen.enterDisplayName('New Test User');
      await RegisterScreen.enterEmail(uniqueEmail);
      await RegisterScreen.enterPassword('TestPassword123!');
      await element(by.id('register.screen')).tap();
      await RegisterScreen.tapSubmit();

      await LoginScreen.waitForScreen();
      await expect(element(by.id('login.screen'))).toBeVisible();
    });

    it('shows validation error for weak password', async () => {
      await LoginScreen.tapRegisterLink();
      await RegisterScreen.waitForScreen();

      await RegisterScreen.enterDisplayName('Test User');
      await RegisterScreen.enterEmail('test@test.local');
      await RegisterScreen.enterPassword('weak');
      await element(by.id('register.screen')).tap();
      await RegisterScreen.tapSubmit();

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
