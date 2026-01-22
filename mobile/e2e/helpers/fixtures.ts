/**
 * E2E Test Fixtures
 * Test data only - no logic, no side effects
 */

export const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
  displayName: 'E2E Test User',
};

export const TEST_USER_2 = {
  email: 'e2e-test-2@example.com',
  password: 'TestPassword123!',
  displayName: 'E2E Test User 2',
};

export const INVALID_CREDENTIALS = {
  email: 'wrong@example.com',
  password: 'WrongPassword123!',
};

export const INVALID_EMAIL = 'not-an-email';

export const WEAK_PASSWORD = '123'; // Too short, no uppercase, no special char

export const TEST_TRANSACTION = {
  amount: '25.50',
  description: 'E2E Test Transaction',
};

export const TEST_INCOME = {
  amount: '1000.00',
  description: 'E2E Test Income',
};

export const CURRENCIES = ['USD', 'EUR', 'ILS'] as const;

export const SPLIT_TYPES = ['EQUAL', 'PERCENTAGE', 'FIXED'] as const;

/**
 * TestID constants matching E2E_CONTRACT.md
 */
export const TestIDs = {
  // Auth screens
  login: {
    screen: 'login.screen',
    emailInput: 'login.emailInput',
    passwordInput: 'login.passwordInput',
    submitButton: 'login.submitButton',
    biometricButton: 'login.biometricButton',
    registerLink: 'login.registerLink',
    resetPasswordLink: 'login.resetPasswordLink',
  },
  register: {
    screen: 'register.screen',
    displayNameInput: 'register.displayNameInput',
    emailInput: 'register.emailInput',
    passwordInput: 'register.passwordInput',
    submitButton: 'register.submitButton',
    loginLink: 'register.loginLink',
  },
  resetPassword: {
    screen: 'resetPassword.screen',
    emailInput: 'resetPassword.emailInput',
    requestButton: 'resetPassword.requestButton',
    backButton: 'resetPassword.backButton',
    sentScreen: 'resetPassword.sentScreen',
    sentBackButton: 'resetPassword.sentBackButton',
    newPasswordScreen: 'resetPassword.newPasswordScreen',
    newPasswordInput: 'resetPassword.newPasswordInput',
    confirmPasswordInput: 'resetPassword.confirmPasswordInput',
    submitButton: 'resetPassword.submitButton',
    completeScreen: 'resetPassword.completeScreen',
  },
  verifyEmail: {
    screen: 'verifyEmail.screen',
    resendButton: 'verifyEmail.resendButton',
    backButton: 'verifyEmail.backButton',
  },
  // Onboarding screens
  onboarding: {
    welcome: {
      screen: 'onboarding.welcome.screen',
      getStartedButton: 'onboarding.welcome.getStartedButton',
    },
    biometric: {
      screen: 'onboarding.biometric.screen',
      enableButton: 'onboarding.biometric.enableButton',
      skipButton: 'onboarding.biometric.skipButton',
    },
  },
  // Main screens
  dashboard: {
    screen: 'dashboard.screen',
    monthSelector: 'dashboard.monthSelector',
    addTransactionFab: 'dashboard.addTransactionFab',
    refreshControl: 'dashboard.refreshControl',
    transaction: (index: number) => `dashboard.transaction.${index}`,
  },
  transactions: {
    screen: 'transactions.screen',
    filterAll: 'transactions.filter.all',
    filterIncome: 'transactions.filter.income',
    filterExpense: 'transactions.filter.expense',
    addButton: 'transactions.addButton',
  },
  budgets: {
    screen: 'budgets.screen',
  },
  sharing: {
    screen: 'sharing.screen',
    shareButton: 'share-expense-button',
  },
  settings: {
    screen: 'settings.screen',
    biometricSwitch: 'biometric-switch',
    logoutButton: 'settings.logoutButton',
  },
  // Modal screens
  addTransaction: {
    screen: 'addTransaction.screen',
    cancelButton: 'addTransaction.cancelButton',
    typeExpense: 'addTransaction.type.expense',
    typeIncome: 'addTransaction.type.income',
    amountInput: 'addTransaction.amountInput',
    category: (name: string) => `addTransaction.category.${name}`,
    dateToday: 'addTransaction.date.today',
    dateYesterday: 'addTransaction.date.yesterday',
    dateOther: 'addTransaction.date.other',
    descriptionInput: 'addTransaction.descriptionInput',
    submitButton: 'addTransaction.submitButton',
  },
  editTransaction: {
    screen: 'editTransaction.screen',
  },
  shareExpense: {
    screen: 'shareExpense.screen',
    splitType: (type: string) => `split-type-${type}`,
    participantEmailInput: 'participant-email-input',
    addParticipantButton: 'add-participant-button',
    submitButton: 'submit-share-button',
  },
} as const;

/**
 * Timeouts for different operations
 */
export const Timeouts = {
  short: 2000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
} as const;
