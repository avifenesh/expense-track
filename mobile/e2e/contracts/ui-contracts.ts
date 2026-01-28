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
    scrollView: 'login.scrollView',
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
    await element(by.id('login.passwordInput')).tapReturnKey();
  },

  async tapSubmit(): Promise<void> {
    try {
      await element(by.id('login.submitButton')).tap();
    } catch {
      await element(by.id('login.scrollView')).scrollTo('bottom');
      await element(by.id('login.submitButton')).tap();
    }
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
    await this.enterPassword(password);
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
    scrollView: 'register.scrollView',
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
    await element(by.id('register.screen')).tap();
    await element(by.id('register.passwordInput')).tap();
    await element(by.id('register.passwordInput')).clearText();
    await element(by.id('register.passwordInput')).typeText(password);
  },

  async tapSubmit(): Promise<void> {
    await element(by.id('register.screen')).tap();
    await waitFor(element(by.id('register.submitButton')))
      .toBeVisible()
      .whileElement(by.id('register.scrollView'))
      .scroll(100, 'down');
    await element(by.id('register.submitButton')).tap();
  },

  async register(displayName: string, email: string, password: string): Promise<void> {
    await this.enterDisplayName(displayName);
    await this.enterEmail(email);
    await this.enterPassword(password);
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
    continueButton: 'onboarding.currency.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.currency.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async selectCurrency(currencyCode: 'USD' | 'EUR' | 'ILS'): Promise<void> {
    await element(by.id(`onboarding.currency.option.${currencyCode}`)).tap();
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.currency.continueButton')).tap();
  },
};

export const OnboardingCategoriesScreen = {
  testIds: {
    screen: 'onboarding.categories.screen',
    continueButton: 'onboarding.categories.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.categories.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.categories.continueButton')).tap();
  },
};

export const OnboardingBudgetScreen = {
  testIds: {
    screen: 'onboarding.budget.screen',
    amountInput: 'onboarding.budget.amountInput',
    setBudgetButton: 'onboarding.budget.setBudgetButton',
    skipButton: 'onboarding.budget.skipButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.budget.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async setBudget(amount: string): Promise<void> {
    await element(by.id('onboarding.budget.amountInput')).clearText();
    await element(by.id('onboarding.budget.amountInput')).typeText(amount);
    await element(by.id('onboarding.budget.setBudgetButton')).tap();
  },

  async tapSkip(): Promise<void> {
    await element(by.id('onboarding.budget.skipButton')).tap();
  },
};

export const OnboardingSampleDataScreen = {
  testIds: {
    screen: 'onboarding.sampleData.screen',
    continueButton: 'onboarding.sampleData.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.sampleData.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.sampleData.continueButton')).tap();
  },
};

export const OnboardingCompleteScreen = {
  testIds: {
    screen: 'onboarding.complete.screen',
    continueButton: 'onboarding.complete.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.complete.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.complete.continueButton')).tap();
  },
};

export const OnboardingBiometricScreen = {
  testIds: {
    screen: 'onboarding.biometric.screen',
    continueButton: 'onboarding.biometric.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.biometric.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.biometric.continueButton')).tap();
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
    scrollView: 'addTransaction.scrollView',
    amountInput: 'addTransaction.amountInput',
    descriptionInput: 'addTransaction.descriptionInput',
    accountPicker: 'addTransaction.accountPicker',
    categoryPicker: 'addTransaction.categoryPicker',
    submitButton: 'addTransaction.submitButton',
    categoryPrefix: 'addTransaction.category.',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('addTransaction.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async enterAmount(amount: string): Promise<void> {
    await element(by.id('addTransaction.amountInput')).clearText();
    await element(by.id('addTransaction.amountInput')).typeText(amount);
    await element(by.id('addTransaction.amountInput')).tapReturnKey();
  },

  async selectCategory(categoryName: string): Promise<void> {
    const testId = `addTransaction.category.${categoryName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
    await element(by.id(testId)).tap();
  },

  async enterDescription(description: string): Promise<void> {
    await waitFor(element(by.id('addTransaction.descriptionInput')))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(200, 'down');
    await element(by.id('addTransaction.descriptionInput')).clearText();
    await element(by.id('addTransaction.descriptionInput')).typeText(description);
    await element(by.id('addTransaction.screen')).tap();
  },

  async tapSubmit(): Promise<void> {
    await element(by.id('addTransaction.screen')).tap();
    await waitFor(element(by.id('addTransaction.submitButton')))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(200, 'down');
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
    scrollView: 'settings.scrollView',
    exportDataButton: 'settings.exportDataButton',
    deleteAccountButton: 'settings.deleteAccountButton',
    logoutButton: 'logout-button',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapExportData(): Promise<void> {
    await element(by.id('settings.exportDataButton')).tap();
  },

  async tapDeleteAccount(): Promise<void> {
    await element(by.id('settings.deleteAccountButton')).tap();
  },

  async tapLogout(): Promise<void> {
    await element(by.id('logout-button')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('settings.screen'))).toBeVisible();
  },
};

export const ExportFormatModal = {
  testIds: {
    modal: 'export-format-modal',
    cancelButton: 'export-format-modal.cancel',
    jsonButton: 'export-format-modal.json',
    csvButton: 'export-format-modal.csv',
    loading: 'export-format-modal.loading',
  },

  async waitForModal(): Promise<void> {
    await waitFor(element(by.id('export-format-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async tapJson(): Promise<void> {
    await element(by.id('export-format-modal.json')).tap();
  },

  async tapCsv(): Promise<void> {
    await element(by.id('export-format-modal.csv')).tap();
  },

  async tapCancel(): Promise<void> {
    await element(by.id('export-format-modal.cancel')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('export-format-modal'))).toBeVisible();
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('export-format-modal'))).not.toBeVisible();
  },
};

export const DeleteAccountModal = {
  testIds: {
    modal: 'delete-account-modal',
    cancelButton: 'delete-account-modal.cancel',
    emailInput: 'delete-account-modal.email-input',
    confirmButton: 'delete-account-modal.confirm',
    loading: 'delete-account-modal.loading',
  },

  async waitForModal(): Promise<void> {
    await waitFor(element(by.id('delete-account-modal')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM);
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('delete-account-modal.email-input')).clearText();
    await element(by.id('delete-account-modal.email-input')).typeText(email);
    const platform = device.getPlatform();
    if (platform === 'android') {
      await device.pressBack();
    } else {
      await element(by.id('delete-account-modal.email-input')).tapReturnKey();
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  async tapConfirm(): Promise<void> {
    await element(by.id('delete-account-modal.confirm')).tap();
  },

  async tapCancel(): Promise<void> {
    await element(by.id('delete-account-modal.cancel')).tap();
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('delete-account-modal'))).toBeVisible();
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('delete-account-modal'))).not.toBeVisible();
  },

  async assertConfirmDisabled(): Promise<void> {
    try {
      await element(by.id('delete-account-modal')).tap();
    } catch {
      // Ignore tap failures
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    await element(by.id('delete-account-modal.confirm')).tap();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(element(by.id('delete-account-modal'))).toBeVisible();
  },

  async assertConfirmEnabled(): Promise<void> {
    await expect(element(by.id('delete-account-modal.confirm'))).toBeVisible();
  },
};

// ============ Paywall Screen ============

export const PaywallScreen = {
  testIds: {
    screen: 'paywall.screen',
    content: 'paywall.content',
    title: 'paywall.title',
    subtitle: 'paywall.subtitle',
    subscribeButton: 'paywall.subscribeButton',
    signOutButton: 'paywall.signOutButton',
    signOutLoading: 'paywall.signOutLoading',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('paywall.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('paywall.screen'))).toBeVisible();
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('paywall.screen'))).not.toBeVisible();
  },

  async tapSubscribe(): Promise<void> {
    await element(by.id('paywall.subscribeButton')).tap();
  },

  async tapSignOut(): Promise<void> {
    await element(by.id('paywall.signOutButton')).tap();
  },

  async waitForSignOutComplete(): Promise<void> {
    // After sign out, should return to login screen
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },
};

// ============ Root Loading Screen ============

export const RootLoadingScreen = {
  testIds: {
    screen: 'root.loadingScreen',
    indicator: 'root.loadingIndicator',
  },

  async waitForDisappear(): Promise<void> {
    await waitFor(element(by.id('root.loadingScreen')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.LONG);
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('root.loadingScreen'))).toBeVisible();
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('root.loadingScreen'))).not.toBeVisible();
  },
};

// ============ Helper Functions ============

export async function performLogin(
  email: string,
  password: string
): Promise<void> {
  await LoginScreen.waitForScreen();
  await LoginScreen.login(email, password);

  await waitFor(element(by.id('login.screen')))
    .not.toBeVisible()
    .withTimeout(TIMEOUTS.LONG);

  try {
    await waitFor(element(by.id('root.loadingScreen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.SHORT);
    await RootLoadingScreen.waitForDisappear();
  } catch {
    // Loading screen not visible
  }

  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.LONG);
}

export async function completeOnboarding(options?: {
  currency?: 'USD' | 'EUR' | 'ILS';
  skipBudget?: boolean;
  budget?: string;
}): Promise<void> {
  const { currency = 'USD', skipBudget = true, budget } = options || {};

  await OnboardingWelcomeScreen.waitForScreen();
  await OnboardingWelcomeScreen.tapGetStarted();

  await OnboardingCurrencyScreen.waitForScreen();
  await OnboardingCurrencyScreen.selectCurrency(currency);
  await OnboardingCurrencyScreen.tapContinue();

  await OnboardingCategoriesScreen.waitForScreen();
  await OnboardingCategoriesScreen.tapContinue();

  await OnboardingBudgetScreen.waitForScreen();
  if (skipBudget) {
    await OnboardingBudgetScreen.tapSkip();
  } else if (budget) {
    await OnboardingBudgetScreen.setBudget(budget);
  } else {
    await OnboardingBudgetScreen.tapSkip();
  }

  await OnboardingSampleDataScreen.waitForScreen();
  await OnboardingSampleDataScreen.tapContinue();

  await OnboardingCompleteScreen.waitForScreen();
  await OnboardingCompleteScreen.tapContinue();

  await OnboardingBiometricScreen.waitForScreen();
  await OnboardingBiometricScreen.tapContinue();

  await DashboardScreen.waitForScreen();
}

export async function navigateToTab(
  tabName: 'Dashboard' | 'Transactions' | 'Budgets' | 'Sharing' | 'Settings'
): Promise<void> {
  await element(by.id(`tab.${tabName.toLowerCase()}`)).tap();
}
