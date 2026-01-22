/**
 * E2E Test Actions
 * Reusable user actions - each action waits for completion
 */

import { by, element, expect, waitFor } from 'detox';
import { TestIDs, Timeouts, TEST_USER } from './fixtures';

/**
 * Wait for app to be ready (login screen visible)
 */
export async function waitForAppReady(): Promise<void> {
  await waitFor(element(by.id(TestIDs.login.screen)))
    .toBeVisible()
    .withTimeout(Timeouts.veryLong);
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  testId: string,
  timeout = Timeouts.medium
): Promise<void> {
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Login with credentials
 */
export async function login(
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await waitForElement(TestIDs.login.screen);

  await element(by.id(TestIDs.login.emailInput)).clearText();
  await element(by.id(TestIDs.login.emailInput)).typeText(email);

  await element(by.id(TestIDs.login.passwordInput)).clearText();
  await element(by.id(TestIDs.login.passwordInput)).typeText(password);

  // Dismiss keyboard before tapping button
  await element(by.id(TestIDs.login.passwordInput)).tapReturnKey();

  await element(by.id(TestIDs.login.submitButton)).tap();
}

/**
 * Login and wait for dashboard
 */
export async function loginAndWaitForDashboard(
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await login(email, password);
  await waitForElement(TestIDs.dashboard.screen, Timeouts.long);
}

/**
 * Navigate to register screen from login
 */
export async function navigateToRegister(): Promise<void> {
  await waitForElement(TestIDs.login.screen);
  await element(by.id(TestIDs.login.registerLink)).tap();
  await waitForElement(TestIDs.register.screen);
}

/**
 * Navigate to reset password screen from login
 */
export async function navigateToResetPassword(): Promise<void> {
  await waitForElement(TestIDs.login.screen);
  await element(by.id(TestIDs.login.resetPasswordLink)).tap();
  await waitForElement(TestIDs.resetPassword.screen);
}

/**
 * Register a new account
 */
export async function register(
  displayName: string,
  email: string,
  password: string
): Promise<void> {
  await waitForElement(TestIDs.register.screen);

  await element(by.id(TestIDs.register.displayNameInput)).clearText();
  await element(by.id(TestIDs.register.displayNameInput)).typeText(displayName);

  await element(by.id(TestIDs.register.emailInput)).clearText();
  await element(by.id(TestIDs.register.emailInput)).typeText(email);

  await element(by.id(TestIDs.register.passwordInput)).clearText();
  await element(by.id(TestIDs.register.passwordInput)).typeText(password);

  await element(by.id(TestIDs.register.passwordInput)).tapReturnKey();

  await element(by.id(TestIDs.register.submitButton)).tap();
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await waitForElement(TestIDs.resetPassword.screen);

  await element(by.id(TestIDs.resetPassword.emailInput)).clearText();
  await element(by.id(TestIDs.resetPassword.emailInput)).typeText(email);

  await element(by.id(TestIDs.resetPassword.emailInput)).tapReturnKey();

  await element(by.id(TestIDs.resetPassword.requestButton)).tap();
}

/**
 * Tap resend verification email button
 */
export async function resendVerificationEmail(): Promise<void> {
  await waitForElement(TestIDs.verifyEmail.screen);
  await element(by.id(TestIDs.verifyEmail.resendButton)).tap();
}

/**
 * Complete onboarding by skipping through screens
 */
export async function completeOnboarding(): Promise<void> {
  // Welcome screen
  await waitForElement(TestIDs.onboarding.welcome.screen);
  await element(by.id(TestIDs.onboarding.welcome.getStartedButton)).tap();

  // Currency screen - tap Next (default selection is fine)
  await waitForElement('next-button', Timeouts.medium);
  await element(by.id('next-button')).tap();

  // Categories screen - tap Next
  await waitForElement('next-button', Timeouts.medium);
  await element(by.id('next-button')).tap();

  // Budget screen - tap Next (skip budgets)
  await waitForElement('next-button', Timeouts.medium);
  await element(by.id('next-button')).tap();

  // Sample data screen - tap No
  await waitFor(element(by.text('No')))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
  await element(by.text('No')).tap();

  // Complete screen - tap Continue
  await waitFor(element(by.text('Continue')))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
  await element(by.text('Continue')).tap();

  // Biometric screen - tap Skip
  await waitForElement(TestIDs.onboarding.biometric.screen);
  await element(by.id(TestIDs.onboarding.biometric.skipButton)).tap();

  // Wait for dashboard
  await waitForElement(TestIDs.dashboard.screen, Timeouts.long);
}

/**
 * Logout from settings
 */
export async function logout(): Promise<void> {
  // Navigate to settings tab
  await element(by.text('Settings')).tap();
  await waitForElement(TestIDs.settings.screen);

  // Tap logout
  await element(by.id(TestIDs.settings.logoutButton)).tap();

  // Wait for login screen
  await waitForElement(TestIDs.login.screen, Timeouts.long);
}

/**
 * Navigate to tab
 */
export async function navigateToTab(
  tabName: 'Dashboard' | 'Transactions' | 'Budgets' | 'Sharing' | 'Settings'
): Promise<void> {
  await element(by.text(tabName)).tap();
}

/**
 * Open add transaction modal from dashboard
 */
export async function openAddTransactionFromDashboard(): Promise<void> {
  await waitForElement(TestIDs.dashboard.screen);
  await element(by.id(TestIDs.dashboard.addTransactionFab)).tap();
  await waitForElement(TestIDs.addTransaction.screen);
}

/**
 * Open add transaction modal from transactions screen
 */
export async function openAddTransactionFromList(): Promise<void> {
  await waitForElement(TestIDs.transactions.screen);
  await element(by.id(TestIDs.transactions.addButton)).tap();
  await waitForElement(TestIDs.addTransaction.screen);
}

/**
 * Add a transaction
 */
export async function addTransaction(
  type: 'EXPENSE' | 'INCOME',
  amount: string,
  categoryName: string,
  description?: string
): Promise<void> {
  await waitForElement(TestIDs.addTransaction.screen);

  // Select type
  if (type === 'INCOME') {
    await element(by.id(TestIDs.addTransaction.typeIncome)).tap();
  }
  // EXPENSE is default

  // Enter amount
  await element(by.id(TestIDs.addTransaction.amountInput)).clearText();
  await element(by.id(TestIDs.addTransaction.amountInput)).typeText(amount);

  // Select category
  const categoryTestId = TestIDs.addTransaction.category(
    categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  );
  await element(by.id(categoryTestId)).tap();

  // Enter description if provided
  if (description) {
    await element(by.id(TestIDs.addTransaction.descriptionInput)).typeText(
      description
    );
  }

  // Submit
  await element(by.id(TestIDs.addTransaction.submitButton)).tap();
}

/**
 * Filter transactions by type
 */
export async function filterTransactions(
  filter: 'all' | 'income' | 'expense'
): Promise<void> {
  await waitForElement(TestIDs.transactions.screen);

  const filterTestIds = {
    all: TestIDs.transactions.filterAll,
    income: TestIDs.transactions.filterIncome,
    expense: TestIDs.transactions.filterExpense,
  };

  await element(by.id(filterTestIds[filter])).tap();
}

/**
 * Pull to refresh on current screen
 */
export async function pullToRefresh(testId: string): Promise<void> {
  await element(by.id(testId)).scroll(200, 'down', NaN, 0.5);
}
