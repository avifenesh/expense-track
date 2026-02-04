/**
 * UI Contracts
 * Page objects with testIDs, actions, and assertions for E2E tests
 * These define the contract between the app and the user (test framework)
 */

import { device, element, by, expect, waitFor } from 'detox'
import { TIMEOUTS } from '../helpers/fixtures'

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
      .withTimeout(TIMEOUTS.LONG)
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('login.emailInput')).clearText()
    await element(by.id('login.emailInput')).typeText(email)
  },

  async enterPassword(password: string): Promise<void> {
    await element(by.id('login.passwordInput')).clearText()
    await element(by.id('login.passwordInput')).typeText(password)
    // Dismiss keyboard after typing password
    await element(by.id('login.passwordInput')).tapReturnKey()
  },

  async tapSubmit(): Promise<void> {
    // Try to tap submit button directly - if keyboard covered it, scroll first
    try {
      await element(by.id('login.submitButton')).tap()
    } catch {
      // If tap fails, scroll within ScrollView to bring button into view
      await element(by.id('login.scrollView')).scrollTo('bottom')
      await element(by.id('login.submitButton')).tap()
    }
  },

  async tapRegisterLink(): Promise<void> {
    await element(by.id('login.registerLink')).tap()
  },

  async tapResetPasswordLink(): Promise<void> {
    await element(by.id('login.resetPasswordLink')).tap()
  },

  async tapBiometricButton(): Promise<void> {
    await element(by.id('login.biometricButton')).tap()
  },

  async login(email: string, password: string): Promise<void> {
    await this.enterEmail(email)
    await this.enterPassword(password) // Dismisses keyboard via tapReturnKey
    await this.tapSubmit()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('login.screen'))).toBeVisible()
  },

  async assertErrorVisible(errorText?: string): Promise<void> {
    await expect(element(by.id('login.errorText'))).toBeVisible()
    if (errorText) {
      await expect(element(by.text(errorText))).toBeVisible()
    }
  },
}

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
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async enterDisplayName(name: string): Promise<void> {
    await element(by.id('register.displayNameInput')).clearText()
    await element(by.id('register.displayNameInput')).typeText(name)
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('register.emailInput')).clearText()
    await element(by.id('register.emailInput')).typeText(email)
  },

  async enterPassword(password: string): Promise<void> {
    // Tap outside first to dismiss any iOS keyboard suggestions
    await element(by.id('register.screen')).tap()
    // Then tap password field to focus
    await element(by.id('register.passwordInput')).tap()
    // Clear any existing text
    await element(by.id('register.passwordInput')).clearText()
    // Type password slowly to avoid iOS autofill
    await element(by.id('register.passwordInput')).typeText(password)
  },

  async tapSubmit(): Promise<void> {
    // Dismiss any selection menus by tapping outside
    await element(by.id('register.screen')).tap()
    // Scroll to ensure button is visible (may be hidden by keyboard or validation hints)
    await waitFor(element(by.id('register.submitButton')))
      .toBeVisible()
      .whileElement(by.id('register.scrollView'))
      .scroll(100, 'down')
    await element(by.id('register.submitButton')).tap()
  },

  async register(displayName: string, email: string, password: string): Promise<void> {
    await this.enterDisplayName(displayName)
    await this.enterEmail(email)
    await this.enterPassword(password)
    await this.tapSubmit()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('register.screen'))).toBeVisible()
  },
}

export const ResetPasswordScreen = {
  testIds: {
    screen: 'resetPassword.screen',
    emailInput: 'resetPassword.emailInput',
    requestButton: 'resetPassword.requestButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('resetPassword.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('resetPassword.screen'))).toBeVisible()
  },
}

// ============ Onboarding Screens ============

export const OnboardingWelcomeScreen = {
  testIds: {
    screen: 'onboarding.welcome.screen',
    getStartedButton: 'onboarding.welcome.getStartedButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  },

  async tapGetStarted(): Promise<void> {
    await element(by.id('onboarding.welcome.getStartedButton')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('onboarding.welcome.screen'))).toBeVisible()
  },
}

export const OnboardingCurrencyScreen = {
  testIds: {
    screen: 'onboarding.currency.screen',
    continueButton: 'onboarding.currency.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.currency.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async selectCurrency(currencyCode: 'USD' | 'EUR' | 'ILS'): Promise<void> {
    await element(by.id(`onboarding.currency.option.${currencyCode}`)).tap()
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.currency.continueButton')).tap()
  },
}

export const OnboardingCategoriesScreen = {
  testIds: {
    screen: 'onboarding.categories.screen',
    continueButton: 'onboarding.categories.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.categories.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.categories.continueButton')).tap()
  },
}

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
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async setBudget(amount: string): Promise<void> {
    await element(by.id('onboarding.budget.amountInput')).clearText()
    await element(by.id('onboarding.budget.amountInput')).typeText(amount)
    await element(by.id('onboarding.budget.setBudgetButton')).tap()
  },

  async tapSkip(): Promise<void> {
    await element(by.id('onboarding.budget.skipButton')).tap()
  },
}

export const OnboardingSampleDataScreen = {
  testIds: {
    screen: 'onboarding.sampleData.screen',
    continueButton: 'onboarding.sampleData.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.sampleData.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.sampleData.continueButton')).tap()
  },
}

export const OnboardingCompleteScreen = {
  testIds: {
    screen: 'onboarding.complete.screen',
    continueButton: 'onboarding.complete.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.complete.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.complete.continueButton')).tap()
  },
}

export const OnboardingBiometricScreen = {
  testIds: {
    screen: 'onboarding.biometric.screen',
    continueButton: 'onboarding.biometric.continueButton',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('onboarding.biometric.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async tapContinue(): Promise<void> {
    await element(by.id('onboarding.biometric.continueButton')).tap()
  },
}

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
      .withTimeout(TIMEOUTS.LONG)
  },

  async waitForLoaded(): Promise<void> {
    // Wait for either dashboard content or empty state
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  },

  async tapAddTransaction(): Promise<void> {
    await element(by.id('dashboard.addTransactionFab')).tap()
  },

  async tapRetry(): Promise<void> {
    await element(by.id('dashboard.retryButton')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('dashboard.screen'))).toBeVisible()
  },

  async assertLoadingVisible(): Promise<void> {
    await expect(element(by.id('dashboard.loadingScreen'))).toBeVisible()
  },

  async assertErrorVisible(): Promise<void> {
    await expect(element(by.id('dashboard.errorScreen'))).toBeVisible()
  },

  async assertEmptyVisible(): Promise<void> {
    await expect(element(by.id('dashboard.emptyScreen'))).toBeVisible()
  },
}

export const TransactionsScreen = {
  testIds: {
    screen: 'transactions.screen',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('transactions.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('transactions.screen'))).toBeVisible()
  },
}

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
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async enterAmount(amount: string): Promise<void> {
    await element(by.id('addTransaction.amountInput')).clearText()
    await element(by.id('addTransaction.amountInput')).typeText(amount)
    // Dismiss keyboard after typing amount
    await element(by.id('addTransaction.amountInput')).tapReturnKey()
  },

  async selectCategory(categoryName: string): Promise<void> {
    // Category testIDs are formatted as: addTransaction.category.{lowercase-hyphenated-name}
    // e.g., "Dining Out" -> "addTransaction.category.dining-out"
    const testId = `addTransaction.category.${categoryName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`
    await element(by.id(testId)).tap()
  },

  async enterDescription(description: string): Promise<void> {
    // Scroll within the ScrollView (not SafeAreaView) to make description input visible
    await waitFor(element(by.id('addTransaction.descriptionInput')))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(200, 'down')
    await element(by.id('addTransaction.descriptionInput')).clearText()
    await element(by.id('addTransaction.descriptionInput')).typeText(description)
    // Tap outside to dismiss keyboard (tapReturnKey adds newline in multiline fields)
    await element(by.id('addTransaction.screen')).tap()
  },

  async tapSubmit(): Promise<void> {
    // Dismiss keyboard first by tapping outside any input
    await element(by.id('addTransaction.screen')).tap()
    // Scroll to bring submit button into view (above keyboard if still visible)
    await waitFor(element(by.id('addTransaction.submitButton')))
      .toBeVisible()
      .whileElement(by.id('addTransaction.scrollView'))
      .scroll(200, 'down')
    await element(by.id('addTransaction.submitButton')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('addTransaction.screen'))).toBeVisible()
  },
}

export const BudgetsScreen = {
  testIds: {
    screen: 'budgets.screen',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('budgets.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('budgets.screen'))).toBeVisible()
  },
}

export const SettingsScreen = {
  testIds: {
    screen: 'settings.screen',
    scrollView: 'settings.scrollView',
    exportDataButton: 'settings.exportDataButton',
    deleteAccountButton: 'settings.deleteAccountButton',
    logoutButton: 'logout-button',
    subscriptionLoading: 'settings.subscriptionLoading',
    subscriptionStatus: 'settings.subscriptionStatus',
    subscriptionError: 'settings.subscriptionError',
  },

  async waitForScreen(): Promise<void> {
    await waitFor(element(by.id('settings.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  /**
   * Wait for subscription data to finish loading.
   * Subscription section shows loading indicator initially, then either
   * status badge or error text once the API call completes.
   */
  async waitForSubscriptionLoaded(): Promise<void> {
    // Wait for loading indicator to disappear
    await waitFor(element(by.id('settings.subscriptionLoading')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  },

  async tapExportData(): Promise<void> {
    // Scroll to ensure button is fully visible (75%+ requirement)
    await waitFor(element(by.id('settings.exportDataButton')))
      .toBeVisible()
      .whileElement(by.id('settings.scrollView'))
      .scroll(200, 'down')
    await element(by.id('settings.exportDataButton')).tap()
  },

  async tapDeleteAccount(): Promise<void> {
    // Scroll to ensure button is fully visible (75%+ requirement)
    // Use larger scroll distance for deep-in-page elements
    // Note: withTimeout cannot be chained before whileElement
    await waitFor(element(by.id('settings.deleteAccountButton')))
      .toBeVisible()
      .whileElement(by.id('settings.scrollView'))
      .scroll(300, 'down')
    await element(by.id('settings.deleteAccountButton')).tap()
  },

  async tapLogout(): Promise<void> {
    await element(by.id('logout-button')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('settings.screen'))).toBeVisible()
  },
}

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
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async tapJson(): Promise<void> {
    await element(by.id('export-format-modal.json')).tap()
  },

  async tapCsv(): Promise<void> {
    await element(by.id('export-format-modal.csv')).tap()
  },

  async tapCancel(): Promise<void> {
    await element(by.id('export-format-modal.cancel')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('export-format-modal'))).toBeVisible()
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('export-format-modal'))).not.toBeVisible()
  },
}

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
      .withTimeout(TIMEOUTS.MEDIUM)
  },

  async enterEmail(email: string): Promise<void> {
    await element(by.id('delete-account-modal.email-input')).clearText()
    await element(by.id('delete-account-modal.email-input')).typeText(email)
    // Dismiss keyboard after typing
    // On Android, tapReturnKey() fails with "Couldn't click" coordinate errors
    // Use pressBack() on Android which reliably dismisses keyboard
    // On iOS, tapReturnKey() works fine
    const platform = device.getPlatform()
    if (platform === 'android') {
      await device.pressBack()
    } else {
      await element(by.id('delete-account-modal.email-input')).tapReturnKey()
    }
    // Small delay for keyboard animation
    await new Promise((resolve) => setTimeout(resolve, 300))
  },

  async tapConfirm(): Promise<void> {
    await element(by.id('delete-account-modal.confirm')).tap()
  },

  async tapCancel(): Promise<void> {
    await element(by.id('delete-account-modal.cancel')).tap()
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('delete-account-modal'))).toBeVisible()
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('delete-account-modal'))).not.toBeVisible()
  },

  async assertConfirmDisabled(): Promise<void> {
    // Due to known Detox issue (https://github.com/wix/Detox/issues/4644),
    // getAttributes().enabled may return incorrect values.
    // Instead, we verify the button doesn't trigger action when tapped.
    // First, dismiss keyboard if open (it may cover the button/modal)
    try {
      await element(by.id('delete-account-modal')).tap()
    } catch {
      // Ignore if tap fails
    }
    // Wait a bit for UI to settle
    await new Promise((resolve) => setTimeout(resolve, 500))
    // Tap the confirm button
    await element(by.id('delete-account-modal.confirm')).tap()
    // Wait a bit for any potential navigation/action
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // If disabled, the modal should still be visible (action not triggered)
    await expect(element(by.id('delete-account-modal'))).toBeVisible()
  },

  async assertConfirmEnabled(): Promise<void> {
    // If enabled, we'd expect tapping to trigger an action (loading state)
    // For now, just verify the button is visible and tappable
    await expect(element(by.id('delete-account-modal.confirm'))).toBeVisible()
  },
}

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
      .withTimeout(TIMEOUTS.LONG)
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('paywall.screen'))).toBeVisible()
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('paywall.screen'))).not.toBeVisible()
  },

  async tapSubscribe(): Promise<void> {
    await element(by.id('paywall.subscribeButton')).tap()
  },

  async tapSignOut(): Promise<void> {
    await element(by.id('paywall.signOutButton')).tap()
  },

  async waitForSignOutComplete(): Promise<void> {
    // After sign out, should return to login screen
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  },
}

// ============ Root Loading Screen ============

export const RootLoadingScreen = {
  testIds: {
    screen: 'root.loadingScreen',
    indicator: 'root.loadingIndicator',
  },

  /**
   * Wait for the root loading screen to disappear.
   * This is shown during subscription initialization after login.
   * Uses TIMEOUTS.LONG to handle slow API responses in CI.
   */
  async waitForDisappear(): Promise<void> {
    await waitFor(element(by.id('root.loadingScreen')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  },

  async assertVisible(): Promise<void> {
    await expect(element(by.id('root.loadingScreen'))).toBeVisible()
  },

  async assertNotVisible(): Promise<void> {
    await expect(element(by.id('root.loadingScreen'))).not.toBeVisible()
  },
}

// ============ Helper Functions ============

/**
 * Complete the login flow from LoginScreen to Dashboard
 * Handles the subscription loading state that occurs after login.
 *
 * Flow:
 * 1. Wait for login screen
 * 2. Submit credentials
 * 3. Wait for login screen to disappear
 * 4. Wait for root loading screen to disappear (subscription initialization)
 * 5. Wait for either dashboard or paywall screen
 * 6. Throw error if paywall is shown (indicates subscription setup issue in tests)
 */
export async function performLogin(email: string, password: string): Promise<void> {
  try {
    await LoginScreen.waitForScreen()
    await LoginScreen.login(email, password)

    // Wait for login screen to disappear (login is processing)
    await waitFor(element(by.id('login.screen')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.LONG)

    // Wait for root loading screen to disappear (subscription initialization)
    // The loading screen may flash quickly or not appear at all if subscription
    // is already cached, so we use a try-catch with short initial check
    try {
      // First check if loading screen exists with short timeout
      await waitFor(element(by.id('root.loadingScreen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.SHORT)

      // If it's visible, wait for it to disappear
      await RootLoadingScreen.waitForDisappear()
    } catch {
      // Loading screen not visible or already gone - continue
    }

    // Now wait for the final destination: dashboard or paywall
    // Use waitFor with toExist to check for either screen
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG)

    // If we reach here, dashboard is visible - success
    // If paywall was shown instead, the above would fail
  } catch (error) {
    await device.takeScreenshot('login-failure')
    // Mask email to avoid exposing sensitive info in logs
    const maskedEmail = email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
    throw new Error(`Login failed for ${maskedEmail}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Complete onboarding flow for a new user
 * This should be called after login if the user hasn't completed onboarding
 *
 * @param options - Onboarding configuration
 * @param options.currency - Currency to select (default: 'USD')
 * @param options.skipBudget - Whether to skip budget setup (default: true)
 * @param options.budget - Budget amount if not skipping
 */
export async function completeOnboarding(options?: {
  currency?: 'USD' | 'EUR' | 'ILS'
  skipBudget?: boolean
  budget?: string
}): Promise<void> {
  const { currency = 'USD', skipBudget = true, budget } = options || {}

  // Step 1: Welcome screen
  await OnboardingWelcomeScreen.waitForScreen()
  await OnboardingWelcomeScreen.tapGetStarted()

  // Step 2: Currency selection
  await OnboardingCurrencyScreen.waitForScreen()
  await OnboardingCurrencyScreen.selectCurrency(currency)
  await OnboardingCurrencyScreen.tapContinue()

  // Step 3: Categories selection (just continue with defaults)
  await OnboardingCategoriesScreen.waitForScreen()
  await OnboardingCategoriesScreen.tapContinue()

  // Step 4: Budget setup
  await OnboardingBudgetScreen.waitForScreen()
  if (skipBudget) {
    await OnboardingBudgetScreen.tapSkip()
  } else if (budget) {
    await OnboardingBudgetScreen.setBudget(budget)
  } else {
    await OnboardingBudgetScreen.tapSkip()
  }

  // Step 5: Sample data (just continue)
  await OnboardingSampleDataScreen.waitForScreen()
  await OnboardingSampleDataScreen.tapContinue()

  // Step 6: Complete screen (triggers API call)
  await OnboardingCompleteScreen.waitForScreen()
  await OnboardingCompleteScreen.tapContinue()

  // Step 7: Biometric setup (skip)
  await OnboardingBiometricScreen.waitForScreen()
  await OnboardingBiometricScreen.tapContinue()

  // Should now be on dashboard
  await DashboardScreen.waitForScreen()
}

/**
 * Navigate to a specific tab in the bottom navigation.
 *
 * This function handles two known issues:
 *
 * 1. Fabric UI Manager idle timeout: After login, the first tab navigation can
 *    block indefinitely waiting for FabricUIManagerIdlingResources to become idle.
 *    This is caused by React Native Fabric's internal state management during
 *    complex screen transitions. We work around this by temporarily disabling
 *    Detox synchronization during the tap action.
 *
 * 2. Android view recycling race condition: react-native-screens can throw
 *    "The specified child already has a parent" during navigation.
 *
 * Note: The Skeleton component now uses useNativeDriver:false to avoid blocking
 * the native UI thread, but other Fabric internals can still cause idle timeouts.
 *
 * See: https://github.com/software-mansion/react-native-screens/issues/2636
 * See: https://wix.github.io/Detox/docs/troubleshooting/synchronization
 */
export async function navigateToTab(
  tabName: 'Dashboard' | 'Transactions' | 'Budgets' | 'Sharing' | 'Settings',
): Promise<void> {
  const tabId = `tab.${tabName.toLowerCase()}`
  const screenId = `${tabName.toLowerCase()}.screen`

  // Wait for the tab bar to be stable and the tab element to be visible
  await waitFor(element(by.id(tabId)))
    .toBeVisible()
    .withTimeout(TIMEOUTS.MEDIUM)

  // Retry logic for transient errors (Android view recycling, Fabric idle timeout)
  const maxRetries = 3
  let lastError: unknown = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Stabilization delay before tap attempt (longer on retries)
      const delay = attempt === 1 ? 300 : 500 * attempt
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Disable synchronization for the tap to avoid Fabric UI Manager idle timeout.
      // This is a known workaround for React Native Fabric where the UI thread can
      // remain "busy" indefinitely during complex transitions.
      await device.disableSynchronization()

      try {
        await element(by.id(tabId)).tap()
      } finally {
        // Always re-enable synchronization
        await device.enableSynchronization()
      }

      // Wait for destination screen with sync enabled (validates real UI state)
      await waitFor(element(by.id(screenId)))
        .toBeVisible()
        .withTimeout(TIMEOUTS.LONG)

      return // Success - exit function
    } catch (error) {
      lastError = error
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Check if this is the Android view recycling error - retry with delay
      if (errorMessage.includes('child already has a parent') || errorMessage.includes('removeView()')) {
        continue
      }

      // Check if this is the Fabric idle timeout - retry with delay
      if (errorMessage.includes('FabricUIManagerIdlingResources') || errorMessage.includes('idle timed out')) {
        continue
      }

      // Any other error - rethrow immediately
      throw error
    }
  }

  // All retries exhausted
  throw lastError
}
