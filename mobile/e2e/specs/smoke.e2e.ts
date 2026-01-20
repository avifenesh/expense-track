import { element, by, expect, waitFor } from 'detox';

/**
 * Smoke Test Suite
 *
 * Basic tests to verify the app launches and critical screens render.
 * These tests should run first to ensure the app is in a testable state.
 */

describe('Smoke Tests', () => {
  // Note: beforeAll (launchApp) and beforeEach (reloadReactNative) are handled globally in init.ts

  it('should launch the app successfully', async () => {
    // App should launch and show either login screen or dashboard
    // depending on auth state
    // Note: Detox doesn't have .or() method - use try-catch pattern
    try {
      await expect(element(by.id('login.screen'))).toBeVisible();
    } catch {
      await expect(element(by.id('dashboard.screen'))).toBeVisible();
    }
  });

  it('should show login screen for unauthenticated users', async () => {
    // Verify login screen elements are present
    await expect(element(by.id('login.screen'))).toBeVisible();
    await expect(element(by.id('login.title'))).toBeVisible();
    await expect(element(by.id('login.emailInput'))).toBeVisible();
    await expect(element(by.id('login.passwordInput'))).toBeVisible();
    await expect(element(by.id('login.submitButton'))).toBeVisible();
  });

  it('should have working registration link', async () => {
    // Verify register link exists and is tappable
    await expect(element(by.id('login.registerLink'))).toBeVisible();
    await element(by.id('login.registerLink')).tap();

    // Should navigate to register screen
    await expect(element(by.id('register.screen'))).toBeVisible();
    await expect(element(by.id('register.title'))).toBeVisible();
  });

  it('should have working reset password link', async () => {
    // beforeEach already reloads, no need for redundant reload

    // Verify reset password link exists and is tappable
    await expect(element(by.id('login.resetPasswordLink'))).toBeVisible();
    await element(by.id('login.resetPasswordLink')).tap();

    // Should navigate to reset password screen
    await expect(element(by.id('resetPassword.screen'))).toBeVisible();
    await expect(element(by.id('resetPassword.title'))).toBeVisible();
  });

  it('should validate email format on login', async () => {
    // beforeEach already reloads, no need for redundant reload

    // Enter invalid email
    await element(by.id('login.emailInput')).tap();
    await element(by.id('login.emailInput')).typeText('invalid-email');
    await element(by.id('login.passwordInput')).tap();
    await element(by.id('login.passwordInput')).typeText('somepassword');
    await element(by.id('login.submitButton')).tap();

    // Should show email error
    await waitFor(element(by.id('login.emailInput-error')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should require password on login', async () => {
    // beforeEach already reloads, no need for redundant reload

    // Enter valid email but no password
    await element(by.id('login.emailInput')).tap();
    await element(by.id('login.emailInput')).typeText('test@example.com');
    await element(by.id('login.submitButton')).tap();

    // Should show error (password required)
    await waitFor(element(by.id('login.errorContainer')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
