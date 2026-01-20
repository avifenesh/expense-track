import { element, by, expect, waitFor, device } from 'detox';

/**
 * Smoke Test Suite
 *
 * Basic tests to verify the app launches and critical screens render.
 * These tests should run first to ensure the app is in a testable state.
 *
 * Note: These tests validate UI rendering only and do not require a backend.
 * Full auth flow tests with backend integration will be added in a follow-up PR.
 */

/**
 * Wait for the app to finish loading.
 * Uses by.text() as primary selector since it's more reliable than testID
 * in React Native apps with native stack navigator.
 */
async function waitForAppReady(): Promise<void> {
  await device.disableSynchronization();
  try {
    // Wait for "Sign In" text to appear (login screen title)
    await waitFor(element(by.text('Sign In')))
      .toBeVisible()
      .withTimeout(30000);
  } finally {
    await device.enableSynchronization();
  }
}

describe('Smoke Tests', () => {
  // Note: beforeAll/beforeEach (launchApp) handled in init.ts

  it('should launch the app successfully', async () => {
    await waitForAppReady();
    // If we get here, app launched and login screen is visible
    await expect(element(by.text('Sign In'))).toBeVisible();
  });

  it('should show login screen elements', async () => {
    await waitForAppReady();
    // Use by.text() for more reliable matching
    await expect(element(by.text('Sign In'))).toBeVisible();
    await expect(element(by.text('Email'))).toBeVisible();
    await expect(element(by.text('Password'))).toBeVisible();
  });

  it('should navigate to registration screen', async () => {
    await waitForAppReady();
    // Tap register link using text
    await element(by.text("Don't have an account? Register")).tap();
    // Wait for register screen
    await waitFor(element(by.text('Create Account')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should navigate to reset password screen', async () => {
    await waitForAppReady();
    // Tap reset password link
    await element(by.text('Forgot password?')).tap();
    // Wait for reset password screen
    await waitFor(element(by.text('Reset Password')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should validate email format', async () => {
    await waitForAppReady();
    // Enter invalid email and submit - still need testID for input fields
    await element(by.id('login.emailInput')).typeText('invalid-email');
    await element(by.id('login.passwordInput')).typeText('password123');
    // Tap the submit button by its testID
    await element(by.id('login.submitButton')).tap();
    // Should show email validation error
    await waitFor(element(by.text('Please enter a valid email address')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
