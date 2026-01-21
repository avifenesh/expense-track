import { by, element, expect, waitFor } from 'detox';
import { TEST_USERS } from './fixtures';

/**
 * Authentication Helpers for E2E Tests
 *
 * Common authentication flows used across multiple test suites.
 * Note: These helpers reference testIDs that may not yet exist in the codebase.
 * As more screens are updated with testIDs (e.g., onboarding, settings),
 * these helpers will become functional.
 */

/**
 * Login with the primary test user
 */
export async function loginAsPrimaryUser(): Promise<void> {
  await login(TEST_USERS.primary.email, TEST_USERS.primary.password);
}

/**
 * Login with the secondary test user
 */
export async function loginAsSecondaryUser(): Promise<void> {
  await login(TEST_USERS.secondary.email, TEST_USERS.secondary.password);
}

/**
 * Login with custom credentials
 */
export async function login(email: string, password: string): Promise<void> {
  // Wait for login screen to be visible
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(10000);

  // Enter email
  await element(by.id('login.emailInput')).tap();
  await element(by.id('login.emailInput')).typeText(email);

  // Enter password
  await element(by.id('login.passwordInput')).tap();
  await element(by.id('login.passwordInput')).typeText(password);

  // Dismiss keyboard before tapping submit
  await element(by.id('login.passwordInput')).tapReturnKey();

  // Submit login form
  await element(by.id('login.submitButton')).tap();

  // Wait for navigation to dashboard or onboarding
  // Note: Detox doesn't have .or() method - use try-catch pattern
  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(15000);
  } catch {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(5000);
  }
}

/**
 * Logout from the app
 * Note: Requires settings screen to have testIDs (to be added in future PR)
 */
export async function logout(): Promise<void> {
  // Navigate to settings
  await element(by.id('tab.settings')).tap();

  // Wait for settings screen
  await waitFor(element(by.id('settings.screen')))
    .toBeVisible()
    .withTimeout(5000);

  // Scroll to logout button if needed
  // Use scroll(pixels, direction) instead of scrollTo
  await element(by.id('settings.scrollView')).scroll(300, 'down');

  // Tap logout
  await element(by.id('settings.logoutButton')).tap();

  // Confirm logout if dialog appears
  // Use explicit visibility check instead of try-catch on tap
  try {
    await waitFor(element(by.id('dialog.confirmButton')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id('dialog.confirmButton')).tap();
  } catch {
    // No confirmation dialog, continue
  }

  // Wait for login screen
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Register a new user account
 * Note: RegisterScreen only has displayName, email, password - no confirm password field
 */
export async function registerUser(
  displayName: string,
  email: string,
  password: string
): Promise<void> {
  // Navigate to register screen from login
  await element(by.id('login.registerLink')).tap();

  // Wait for register screen
  await waitFor(element(by.id('register.screen')))
    .toBeVisible()
    .withTimeout(5000);

  // Fill registration form
  await element(by.id('register.displayNameInput')).tap();
  await element(by.id('register.displayNameInput')).typeText(displayName);

  await element(by.id('register.emailInput')).tap();
  await element(by.id('register.emailInput')).typeText(email);

  await element(by.id('register.passwordInput')).tap();
  await element(by.id('register.passwordInput')).typeText(password);
  await element(by.id('register.passwordInput')).tapReturnKey();

  // Submit registration
  await element(by.id('register.submitButton')).tap();

  // Wait for verification screen or onboarding
  // Note: Detox doesn't have .or() method - use try-catch pattern
  try {
    await waitFor(element(by.id('verifyEmail.screen')))
      .toBeVisible()
      .withTimeout(15000);
  } catch {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(5000);
  }
}

/**
 * Check if user is currently logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  try {
    await expect(element(by.id('dashboard.screen'))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure user is logged out before test
 */
export async function ensureLoggedOut(): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await logout();
  }
}

/**
 * Wait for app to load and be ready for interaction
 * Handles app startup synchronization issues
 */
export async function waitForAppReady(): Promise<void> {
  const { device, waitFor, element, by } = await import('detox');
  await device.disableSynchronization();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(30000);
  await device.enableSynchronization();
}

/**
 * Standard test setup: wait for app, login, handle onboarding
 * Use this at the start of tests that need a logged-in user
 */
export async function setupLoggedInUser(): Promise<void> {
  const { waitFor, element, by } = await import('detox');

  await waitForAppReady();
  await loginAsPrimaryUser();

  // Handle onboarding if needed
  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(5000);
  } catch {
    await completeOnboarding();
  }
}

/**
 * Complete onboarding wizard with default selections
 * TestIDs added in PR #265
 */
export async function completeOnboarding(): Promise<void> {
  // Welcome screen
  await waitFor(element(by.id('onboarding.welcome.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.welcome.getStartedButton')).tap();

  // Currency selection - select USD
  await waitFor(element(by.id('onboarding.currency.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.currency.option.USD')).tap();
  await element(by.id('onboarding.currency.continueButton')).tap();

  // Categories selection - keep defaults
  await waitFor(element(by.id('onboarding.categories.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.categories.continueButton')).tap();

  // Budget setup - skip
  await waitFor(element(by.id('onboarding.budget.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.budget.skipButton')).tap();

  // Sample data - select "no" (start fresh)
  await waitFor(element(by.id('onboarding.sampleData.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.sampleData.option.no')).tap();
  await element(by.id('onboarding.sampleData.continueButton')).tap();

  // Complete screen - tap continue to proceed to biometric
  await waitFor(element(by.id('onboarding.complete.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.complete.continueButton')).tap();

  // Biometric screen - skip or continue based on device capability
  await waitFor(element(by.id('onboarding.biometric.screen')))
    .toBeVisible()
    .withTimeout(5000);

  // Try skip button (shown when biometric is available)
  try {
    await waitFor(element(by.id('onboarding.biometric.skipButton')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id('onboarding.biometric.skipButton')).tap();
  } catch {
    // Biometric not available - continue button is shown instead
    await element(by.id('onboarding.biometric.continueButton')).tap();
  }

  // Wait for dashboard
  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(5000);
}
