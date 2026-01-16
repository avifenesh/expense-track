// This file maintains backward compatibility by re-exporting all actions from domain-specific modules
// All action implementations have been moved to modular files in src/app/actions/
// Note: Individual action files have 'use server' directive - no need to duplicate it here

// Transaction actions
export {
  createTransactionRequestAction,
  approveTransactionRequestAction,
  rejectTransactionRequestAction,
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
} from './actions/transactions'

// Budget actions
export { upsertBudgetAction, deleteBudgetAction } from './actions/budgets'

// Recurring template actions
export {
  upsertRecurringTemplateAction,
  toggleRecurringTemplateAction,
  applyRecurringTemplatesAction,
} from './actions/recurring'

// Category actions
export { createCategoryAction, archiveCategoryAction } from './actions/categories'

// Auth actions
export {
  loginAction,
  logoutAction,
  requestPasswordResetAction,
  resetPasswordAction,
  persistActiveAccountAction,
  registerAction,
  verifyEmailAction,
  resendVerificationEmailAction,
  deleteAccountAction,
  exportUserDataAction,
} from './actions/auth'

// Holdings actions
export {
  createHoldingAction,
  updateHoldingAction,
  deleteHoldingAction,
  refreshHoldingPricesAction,
} from './actions/holdings'

// Miscellaneous actions
export { refreshExchangeRatesAction, setBalanceAction } from './actions/misc'

// Onboarding actions
export {
  completeOnboardingAction,
  skipOnboardingAction,
  updatePreferredCurrencyAction,
  createInitialCategoriesAction,
  createQuickBudgetAction,
  seedSampleDataAction,
} from './actions/onboarding'

// Expense sharing actions
export {
  shareExpenseAction,
  markSharePaidAction,
  cancelSharedExpenseAction,
  declineShareAction,
  getMySharedExpensesAction,
  getExpensesSharedWithMeAction,
  lookupUserForSharingAction,
  sendPaymentReminderAction,
} from './actions/expense-sharing'
