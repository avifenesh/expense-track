/**
 * Auth Tests
 * Login, registration, password reset flows
 */

import { device, element, by, expect, waitFor } from 'detox';

const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
};

async function waitForLoginScreen(): Promise<void> {
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(30000);
}

describe('Auth Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await waitForLoginScreen();
  });

  describe('Login Screen', () => {
    it('shows login form elements', async () => {
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
      await expect(element(by.id('login.submitButton'))).toBeVisible();
    });

    it('shows error for invalid credentials', async () => {
      await element(by.id('login.emailInput')).typeText('wrong@example.com');
      await element(by.id('login.passwordInput')).typeText('WrongPassword123!');
      await element(by.id('login.passwordInput')).tapReturnKey();
      await element(by.id('login.submitButton')).tap();

      // Should show error and stay on login screen
      await waitFor(element(by.text('Invalid email or password')))
        .toBeVisible()
        .withTimeout(10000);
    });

    it('logs in with valid credentials', async () => {
      await element(by.id('login.emailInput')).typeText(TEST_USER.email);
      await element(by.id('login.passwordInput')).typeText(TEST_USER.password);
      await element(by.id('login.passwordInput')).tapReturnKey();
      await element(by.id('login.submitButton')).tap();

      // Should navigate to dashboard or onboarding
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(15000);
    });
  });

  describe('Navigation', () => {
    it('navigates to register screen', async () => {
      await element(by.id('login.registerLink')).tap();
      await waitFor(element(by.id('register.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('navigates to reset password screen', async () => {
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Registration', () => {
    it('shows registration form', async () => {
      await element(by.id('login.registerLink')).tap();
      await waitFor(element(by.id('register.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('register.displayNameInput'))).toBeVisible();
      await expect(element(by.id('register.emailInput'))).toBeVisible();
      await expect(element(by.id('register.passwordInput'))).toBeVisible();
      await expect(element(by.id('register.submitButton'))).toBeVisible();
    });

    it('registers new account', async () => {
      await element(by.id('login.registerLink')).tap();
      await waitFor(element(by.id('register.screen')))
        .toBeVisible()
        .withTimeout(5000);

      const uniqueEmail = `e2e-${Date.now()}@test.local`;
      await element(by.id('register.displayNameInput')).typeText('Test User');
      await element(by.id('register.emailInput')).typeText(uniqueEmail);
      await element(by.id('register.passwordInput')).typeText(
        'TestPassword123!'
      );
      await element(by.id('register.passwordInput')).tapReturnKey();
      await element(by.id('register.submitButton')).tap();

      // Should navigate to verify email screen
      await waitFor(element(by.id('verifyEmail.screen')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Password Reset', () => {
    it('shows password reset form', async () => {
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('resetPassword.emailInput'))).toBeVisible();
      await expect(element(by.id('resetPassword.requestButton'))).toBeVisible();
    });

    it('requests password reset', async () => {
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('resetPassword.emailInput')).typeText(TEST_USER.email);
      await element(by.id('resetPassword.emailInput')).tapReturnKey();
      await element(by.id('resetPassword.requestButton')).tap();

      // Should show confirmation
      await waitFor(element(by.id('resetPassword.sentScreen')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
