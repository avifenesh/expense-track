/**
 * Auth Tests
 * Login, registration, password reset flows
 */

import { device, element, by, expect, waitFor } from 'detox';

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
  });
});
