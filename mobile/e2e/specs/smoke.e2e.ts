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
 * Wait for the app to finish loading by looking for any content that appears
 * after the initial loading screen. Uses multiple fallback strategies.
 */
async function waitForAppReady(): Promise<void> {
  // Disable synchronization - React Native apps have background tasks
  await device.disableSynchronization();

  try {
    // Strategy 1: Wait for loading screen to disappear (if it exists)
    try {
      await waitFor(element(by.id('root.loadingScreen')))
        .not.toBeVisible()
        .withTimeout(20000);
    } catch {
      // Loading screen may not exist or already gone
    }

    // Strategy 2: Wait for any visible content
    // Try multiple elements that should appear after loading
    const elementsToCheck = [
      'login.screen',
      'login.title',
      'login.content',
      'dashboard.screen',
    ];

    let found = false;
    for (const testId of elementsToCheck) {
      if (found) break;
      try {
        await waitFor(element(by.id(testId)))
          .toBeVisible()
          .withTimeout(5000);
        found = true;
      } catch {
        // Try next element
      }
    }

    // If still not found, give it one more chance with a longer timeout
    if (!found) {
      try {
        await waitFor(element(by.id('login.title')))
          .toExist()
          .withTimeout(10000);
      } catch {
        // App may be in an unexpected state
      }
    }
  } finally {
    await device.enableSynchronization();
  }
}

describe('Smoke Tests', () => {
  // Note: beforeAll/beforeEach (launchApp) handled in init.ts

  it('should launch the app successfully', async () => {
    await waitForAppReady();

    // App should show some content - try login first, then dashboard
    try {
      await expect(element(by.id('login.title'))).toExist();
    } catch {
      await expect(element(by.id('dashboard.screen'))).toExist();
    }
  });

  it('should show login screen elements', async () => {
    await waitForAppReady();

    // Check for login screen elements using toExist for reliability
    await expect(element(by.id('login.title'))).toExist();
    await expect(element(by.id('login.emailInput'))).toExist();
    await expect(element(by.id('login.passwordInput'))).toExist();
    await expect(element(by.id('login.submitButton'))).toExist();
  });

  it('should navigate to registration screen', async () => {
    await waitForAppReady();

    // Tap register link
    await element(by.id('login.registerLink')).tap();

    // Wait for register screen
    await waitFor(element(by.id('register.screen')))
      .toExist()
      .withTimeout(5000);
  });

  it('should navigate to reset password screen', async () => {
    await waitForAppReady();

    // Tap reset password link
    await element(by.id('login.resetPasswordLink')).tap();

    // Wait for reset password screen
    await waitFor(element(by.id('resetPassword.screen')))
      .toExist()
      .withTimeout(5000);
  });

  it('should validate email format', async () => {
    await waitForAppReady();

    // Enter invalid email and submit
    await element(by.id('login.emailInput')).typeText('invalid-email');
    await element(by.id('login.passwordInput')).typeText('password123');
    await element(by.id('login.submitButton')).tap();

    // Should show email validation error
    await waitFor(element(by.id('login.emailInput-error')))
      .toExist()
      .withTimeout(5000);
  });
});
