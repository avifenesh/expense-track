import { TransactionType, Currency } from '@prisma/client'
import { DashboardData, MonthlyHistoryPoint } from '@/lib/finance'

// Re-export for convenience
export type { MonthlyHistoryPoint as HistoryPoint }

// Shared feedback type for form submissions
export type Feedback = { type: 'success' | 'error'; message: string }

// Tab navigation
export type TabValue = 'overview' | 'budgets' | 'transactions' | 'recurring' | 'categories' | 'holdings'

// Filter type used across tabs
export type TypeFilterValue = 'all' | TransactionType

// Select option type
export type SelectOption = { label: string; value: string }

// Data type aliases for convenience
export type DashboardTransaction = DashboardData['transactions'][number]
export type DashboardBudget = DashboardData['budgets'][number]
export type DashboardCategory = DashboardData['categories'][number]
export type DashboardAccount = DashboardData['accounts'][number]
export type DashboardRecurringTemplate = DashboardData['recurringTemplates'][number]
export type DashboardTransactionRequest = DashboardData['transactionRequests'][number]

// Shared select options
export const transactionTypeOptions = [
  { label: 'Expense', value: TransactionType.EXPENSE },
  { label: 'Income', value: TransactionType.INCOME },
]

export const typeFilterOptions = [
  { label: 'All types', value: 'all' as const },
  { label: 'Expense', value: TransactionType.EXPENSE },
  { label: 'Income', value: TransactionType.INCOME },
]

export const currencyOptions = [
  { label: '$ USD', value: Currency.USD },
  { label: '€ EUR', value: Currency.EUR },
  { label: '₪ ILS', value: Currency.ILS },
]
