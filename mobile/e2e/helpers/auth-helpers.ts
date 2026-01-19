import { by, element, expect, waitFor } from 'detox';
import { TEST_USERS } from './fixtures';

/**
 * Authentication Helpers for E2E Tests
 *
 * Common authentication flows used across multiple test suites.
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
  await waitFor(element(by.id('dashboard.screen')).or(element(by.id('onboarding.welcome.screen'))))
    .toBeVisible()
    .withTimeout(15000);
}

/**
 * Logout from the app
 */
export async function logout(): Promise<void> {
  // Navigate to settings
  await element(by.id('tab.settings')).tap();

  // Wait for settings screen
  await waitFor(element(by.id('settings.screen')))
    .toBeVisible()
    .withTimeout(5000);

  // Scroll to logout button if needed
  await element(by.id('settings.scrollView')).scrollTo('bottom');

  // Tap logout
  await element(by.id('settings.logoutButton')).tap();

  // Confirm logout if dialog appears
  try {
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
 */
export async function registerUser(
  email: string,
  password: string,
  confirmPassword?: string
): Promise<void> {
  // Navigate to register screen from login
  await element(by.id('login.registerLink')).tap();

  // Wait for register screen
  await waitFor(element(by.id('register.screen')))
    .toBeVisible()
    .withTimeout(5000);

  // Fill registration form
  await element(by.id('register.emailInput')).tap();
  await element(by.id('register.emailInput')).typeText(email);

  await element(by.id('register.passwordInput')).tap();
  await element(by.id('register.passwordInput')).typeText(password);

  await element(by.id('register.confirmPasswordInput')).tap();
  await element(by.id('register.confirmPasswordInput')).typeText(confirmPassword || password);
  await element(by.id('register.confirmPasswordInput')).tapReturnKey();

  // Submit registration
  await element(by.id('register.submitButton')).tap();

  // Wait for verification screen or onboarding
  await waitFor(
    element(by.id('verifyEmail.screen')).or(element(by.id('onboarding.welcome.screen')))
  )
    .toBeVisible()
    .withTimeout(15000);
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
 * Complete onboarding wizard with default selections
 */
export async function completeOnboarding(): Promise<void> {
  // Welcome screen
  await waitFor(element(by.id('onboarding.welcome.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.welcome.getStartedButton')).tap();

  // Currency selection
  await waitFor(element(by.id('onboarding.currency.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.currency.USD')).tap();
  await element(by.id('onboarding.currency.continueButton')).tap();

  // Categories selection
  await waitFor(element(by.id('onboarding.categories.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.categories.continueButton')).tap();

  // Budget setup
  await waitFor(element(by.id('onboarding.budget.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.budget.skipButton')).tap();

  // Sample data
  await waitFor(element(by.id('onboarding.sampleData.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.sampleData.skipButton')).tap();

  // Biometric setup (if shown)
  try {
    await waitFor(element(by.id('onboarding.biometric.screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('onboarding.biometric.skipButton')).tap();
  } catch {
    // Biometric screen not shown, continue
  }

  // Complete
  await waitFor(element(by.id('onboarding.complete.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.complete.startButton')).tap();

  // Wait for dashboard
  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(5000);
}
