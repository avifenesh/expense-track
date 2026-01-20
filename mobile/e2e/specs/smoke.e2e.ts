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

describe('Smoke Tests', () => {
  // Note: beforeAll/beforeEach (launchApp) handled in init.ts

  it('should launch the app successfully', async () => {
    await waitForAppReady();
    // If we get here, app launched and login screen is visible
    await expect(element(by.id('login.screen'))).toBeVisible();
  });

  it('should show login screen elements', async () => {
    await waitForAppReady();
    // Use testIDs for reliable element matching
    await expect(element(by.id('login.title'))).toBeVisible();
    await expect(element(by.id('login.emailInput'))).toBeVisible();
    await expect(element(by.id('login.passwordInput'))).toBeVisible();
  });

  it('should navigate to registration screen', async () => {
    await waitForAppReady();
    // Tap register link using testID
    await element(by.id('login.registerLink')).tap();
    // Wait for register screen
    await waitFor(element(by.id('register.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should navigate to reset password screen', async () => {
    await waitForAppReady();
    // Tap reset password link using testID
    await element(by.id('login.resetPasswordLink')).tap();
    // Wait for reset password screen
    await waitFor(element(by.id('resetPassword.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should validate email format', async () => {
    await waitForAppReady();
    // Enter invalid email and submit
    await element(by.id('login.emailInput')).typeText('invalid-email');
    await element(by.id('login.passwordInput')).typeText('password123');
    // Tap the submit button
    await element(by.id('login.submitButton')).tap();
    // Should show email validation error
    await waitFor(element(by.id('login.emailInput-error')))
      .toExist()
      .withTimeout(5000);
  });
});
