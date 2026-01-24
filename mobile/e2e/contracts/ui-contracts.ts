/**
 * UI Contracts
 * Page objects with testIDs, actions, and assertions for E2E tests
 * These define the contract between the app and the user (test framework)
 */

import { element, by, expect, waitFor } from 'detox';
import { TIMEOUTS } from '../helpers/fixtures';

// ============ Auth Screens ============

export const LoginScreen = {
  testIds: {
    screen: 'login.screen',
    emailInput: 'login.emailInput',
    passwordInput: 'login.passwordInput',
    submitButton: 'login.submitButton',
    registerLink: 'login.registerLink',
    resetPasswordLink: 'login.resetPasswordLink',
    biometricButton: 'login.biometricButton',
    errorText: 'login.errorText',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('login.emailInput')).clearText();
    await element(by.id('login.emailInput')).typeText(email);
  },

  async enterPassword(password: string): Promise<void> {
    await element(by.id('login.passwordInput')).clearText();
    await element(by.id('login.passwordInput')).typeText(password);
    // Dismiss keyboard after typing password
    await element(by.id('login.passwordInput')).tapReturnKey();
  },

  async tapSubmit(): Promise<void> {
    // Scroll to make sure button is visible (keyboard may have pushed it off-screen)
    await waitFor(element(by.id('login.submitButton')))
      .toBeVisible()
      .whileElement(by.id('login.screen'))
      .scroll(100, 'down');
    await element(by.id('login.submitButton')).tap();
  },

  async tapRegisterLink(): Promise<void> {
    await element(by.id('login.registerLink')).tap();
  },

  async tapResetPasswordLink(): Promise<void> {
    await element(by.id('login.resetPasswordLink')).tap();
  },

  async tapBiometricButton(): Promise<void> {
    await element(by.id('login.biometricButton')).tap();
  },

  async login(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password); // Dismisses keyboard via tapReturnKey
    await this.tapSubmit();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('login.screen'))).toBeVisible();
  },

  async assertErrorVisible(errorText?: string): Promise<void> {
    await expect(element(by.id('login.errorText'))).toBeVisible();
    if (errorText) {
      await expect(element(by.text(errorText))).toBeVisible();
    }
  },
};

export const RegisterScreen = {
  testIds: {
    screen: 'register.screen',
    displayNameInput: 'register.displayNameInput',
    emailInput: 'register.emailInput',
    passwordInput: 'register.passwordInput',
    submitButton: 'register.submitButton',
    loginLink: 'register.loginLink',
    errorText: 'register.errorText',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('register.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async enterDisplayName(name: string): Promise<void> {
    await element(by.id('register.displayNameInput')).clearText();
    await element(by.id('register.displayNameInput')).typeText(name);
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('register.emailInput')).clearText();
    await element(by.id('register.emailInput')).typeText(email);
  },

  async enterPassword(password: string): Promise<void> {
    await element(by.id('register.passwordInput')).clearText();
    await element(by.id('register.passwordInput')).typeText(password);
    // Dismiss keyboard after typing password
    await element(by.id('register.passwordInput')).tapReturnKey();
  },

  async tapSubmit(): Promise<void> {
    // Scroll to make sure button is visible (keyboard may have pushed it off-screen)
    // Use larger scroll distance as register form is longer than login
    await waitFor(element(by.id('register.submitButton')))
      .toBeVisible()
      .whileElement(by.id('register.screen'))
      .scroll(300, 'down');
    await element(by.id('register.submitButton')).tap();
  },

  async register(displayName: string, email: string, password: string): Promise<void> {
    await this.enterDisplayName(displayName);
    await this.enterEmail(email);
    await this.enterPassword(password); // Dismisses keyboard via tapReturnKey
    await this.tapSubmit();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('register.screen'))).toBeVisible();
  },
};

export const ResetPasswordScreen = {
  testIds: {
    screen: 'resetPassword.screen',
    emailInput: 'resetPassword.emailInput',
    requestButton: 'resetPassword.requestButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('resetPassword.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('resetPassword.screen'))).toBeVisible();
  },
};

// ============ Onboarding Screens ============

export const OnboardingWelcomeScreen = {
  testIds: {
    screen: 'onboarding.welcome.screen',
    getStartedButton: 'onboarding.welcome.getStartedButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async tapGetStarted(): Promise<void> {
    await element(by.id('onboarding.welcome.getStartedButton')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('onboarding.welcome.screen'))).toBeVisible();
  },
};

export const OnboardingCurrencyScreen = {
  testIds: {
    screen: 'onboarding.currency.screen',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.currency.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },
};

// ============ Main Screens ============

export const DashboardScreen = {
  testIds: {
    screen: 'dashboard.screen',
    loadingScreen: 'dashboard.loadingScreen',
    errorScreen: 'dashboard.errorScreen',
    emptyScreen: 'dashboard.emptyScreen',
    addTransactionFab: 'dashboard.addTransactionFab',
    incomeAmount: 'dashboard.incomeAmount',
    expenseAmount: 'dashboard.expenseAmount',
    transactionsList: 'dashboard.transactionsList',
    monthSelector: 'dashboard.monthSelector',
    retryButton: 'dashboard.retryButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async waitForLoaded(): Promise<void> {
    // Wait for either dashboard content or empty state
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async tapAddTransaction(): Promise<void> {
    await element(by.id('dashboard.addTransactionFab')).tap();
  },

  async tapRetry(): Promise<void> {
    await element(by.id('dashboard.retryButton')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('dashboard.screen'))).toBeVisible();
  },

  async assertLoadingVisible(): Promise<void> {
    await expect(element(by.id('dashboard.loadingScreen'))).toBeVisible();
  },

  async assertErrorVisible(): Promise<void> {
    await expect(element(by.id('dashboard.errorScreen'))).toBeVisible();
  },

  async assertEmptyVisible(): Promise<void> {
    await expect(element(by.id('dashboard.emptyScreen'))).toBeVisible();
  },
};

export const TransactionsScreen = {
  testIds: {
    screen: 'transactions.screen',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('transactions.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('transactions.screen'))).toBeVisible();
  },
};

export const AddTransactionScreen = {
  testIds: {
    screen: 'addTransaction.screen',
    amountInput: 'addTransaction.amountInput',
    descriptionInput: 'addTransaction.descriptionInput',
    accountPicker: 'addTransaction.accountPicker',
    categoryPicker: 'addTransaction.categoryPicker',
    submitButton: 'addTransaction.submitButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('addTransaction.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async enterAmount(amount: string): Promise<void> {
    await element(by.id('addTransaction.amountInput')).clearText();
    await element(by.id('addTransaction.amountInput')).typeText(amount);
    // Dismiss keyboard after typing to allow scrolling to next field
    await element(by.id('addTransaction.amountInput')).tapReturnKey();
  },

  async selectCategory(categoryName: string): Promise<void> {
    // Category testID is normalized: lowercased and special chars replaced with hyphens
    const normalizedName = categoryName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const testId = `addTransaction.category.${normalizedName}`;
    // Categories should be visible after amount input - scroll if needed
    await waitFor(element(by.id(testId)))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(200, 'down');
    await element(by.id(testId)).tap();
  },

  async selectFirstCategory(): Promise<void> {
    // Wait for categories to load (they should be visible after entering amount)
    await waitFor(element(by.id('addTransaction.categoryGrid')))
      .toBeVisible()
      .withTimeout(10000);
    // Select "Groceries" which is the first expense category
    // Category testID format: addTransaction.category.{name-lowercased-with-hyphens}
    await waitFor(element(by.id('addTransaction.category.groceries')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('addTransaction.category.groceries')).tap();
  },

  async enterDescription(description: string): Promise<void> {
    // Scroll within the ScrollView to make description input visible
    // The scrollable element is addTransaction.scrollView, not the screen
    await waitFor(element(by.id('addTransaction.descriptionInput')))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(300, 'down');
    await element(by.id('addTransaction.descriptionInput')).clearText();
    await element(by.id('addTransaction.descriptionInput')).typeText(description);
    // Dismiss keyboard after typing description
    await element(by.id('addTransaction.descriptionInput')).tapReturnKey();
  },

  async tapSubmit(): Promise<void> {
    // Submit button is in a fixed footer - should be visible without scrolling
    // Just wait for it to be visible and tap
    await waitFor(element(by.id('addTransaction.submitButton')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('addTransaction.submitButton')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('addTransaction.screen'))).toBeVisible();
  },
};

export const BudgetsScreen = {
  testIds: {
    screen: 'budgets.screen',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('budgets.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('budgets.screen'))).toBeVisible();
  },
};

export const SettingsScreen = {
  testIds: {
    screen: 'settings.screen',
    logoutButton: 'settings.logoutButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapLogout(): Promise<void> {
    await element(by.id('settings.logoutButton')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('settings.screen'))).toBeVisible();
  },
};

// ============ Helper Functions ============

/**
 * Complete the login flow from LoginScreen to Dashboard
 */
export async function performLogin(
  email: string,
  password: string
): Promise<void> {
  await LoginScreen.waitForScreen();
  await LoginScreen.login(email, password);
  // Either goes to onboarding or dashboard
  // Wait for either screen to appear
  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.LONG);
}

/**
 * Complete onboarding flow for a new user
 * This should be called after login if the user hasn't completed onboarding
 */
export async function completeOnboarding(): Promise<void> {
  // Wait for welcome screen
  await OnboardingWelcomeScreen.waitForScreen();
  await OnboardingWelcomeScreen.tapGetStarted();

  // Continue through onboarding steps
  // The exact steps depend on the onboarding flow
  // This is a placeholder - implement based on actual flow
}

/**
 * Navigate to a tab in the main tab navigator
 */
export async function navigateToTab(
  tabName: 'Dashboard' | 'Transactions' | 'Budgets' | 'Sharing' | 'Settings'
): Promise<void> {
  await element(by.id(`tab.${tabName.toLowerCase()}`)).tap();
}
