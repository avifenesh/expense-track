// Finance module - barrel export for backward compatibility
// This file re-exports all public functions and types from the finance module

// Types
export type {
  MonetaryStat,
  CategoryBudgetSummary,
  MonthlyHistoryPoint,
  RecurringTemplateSummary,
  HoldingWithPrice,
  SharedExpenseParticipant,
  SharedExpenseSummary,
  ExpenseParticipationSummary,
  SettlementBalance,
  TransactionWithDisplay,
  DashboardData,
} from './types'

// Account operations
export { getAccounts, getCategories, getTransactionRequests } from './accounts'

// Transaction operations
export { getTransactionsForMonth } from './transactions'

// Budget operations
export { getBudgetsForMonth } from './budgets'

// Recurring template operations
export { getRecurringTemplates } from './recurring'

// Holdings operations
export { getHoldingsWithPrices } from './holdings'

// Dashboard aggregation
export { getDashboardData } from './dashboard'

// Expense sharing operations
export {
  getSharedExpenses,
  getExpensesSharedWithMe,
  calculateShares,
  getSettlementBalance,
} from './expense-sharing'
