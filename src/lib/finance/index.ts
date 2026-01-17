/**
 * Finance module - Public API
 *
 * This is the only entry point for the finance module.
 * All public types and functions are exported here.
 *
 * @example
 * import { getDashboardData, type DashboardData } from '@/lib/finance'
 */

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
  PaginationOptions,
  PaginatedResult,
} from './types'

export { DEFAULT_PAGINATION_LIMIT } from './types'

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
