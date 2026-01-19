/**
 * Finance module - Public types
 *
 * All types in this file are part of the public API and exported via index.ts.
 * Import from '@/lib/finance' (not directly from this file).
 */
import { Prisma, TransactionType, Currency, PaymentStatus, SplitType } from '@prisma/client'
import type { getTransactionRequests } from './accounts'
import type { getAccounts, getCategories } from './accounts'

// Status filter for shared expenses
export type SharedExpenseStatusFilter = 'pending' | 'settled' | 'all'

// Status filter for expense participations
export type ParticipantStatusFilter = 'pending' | 'paid' | 'declined' | 'all'

// Pagination options for cursor-based pagination
export type PaginationOptions = {
  cursor?: string
  limit?: number
}

// Pagination options for offset-based pagination (no cursor)
export type OffsetPaginationOptions = {
  offset?: number
  limit?: number
}

// Extended pagination options for shared expenses with status filtering (offset-based)
export type SharedExpensePaginationOptions = OffsetPaginationOptions & {
  status?: SharedExpenseStatusFilter
}

// Pagination options for expense participations with status filtering
export type ParticipantPaginationOptions = OffsetPaginationOptions & {
  status?: ParticipantStatusFilter
}

// Generic paginated result type
export type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

// Default pagination limit
export const DEFAULT_PAGINATION_LIMIT = 50

// Stat breakdown types - show users how each stat is calculated
export type IncomeSource = 'goal' | 'recurring' | 'budget' | 'none'

export type NetThisMonthBreakdown = {
  type: 'net-this-month'
  income: number
  expense: number
  net: number
}

export type OnTrackForBreakdown = {
  type: 'on-track-for'
  actualIncome: number
  actualExpense: number
  expectedRemainingIncome: number
  remainingBudgetedExpense: number
  incomeSource: IncomeSource
  projected: number
}

export type LeftToSpendBreakdown = {
  type: 'left-to-spend'
  totalPlanned: number
  totalActual: number
  totalRemaining: number
  categories: Array<{
    id: string
    name: string
    planned: number
    actual: number
    remaining: number
  }>
}

export type MonthlyTargetBreakdown = {
  type: 'monthly-target'
  plannedIncome: number
  incomeSource: IncomeSource
  plannedExpense: number
  target: number
}

export type StatBreakdown =
  | NetThisMonthBreakdown
  | OnTrackForBreakdown
  | LeftToSpendBreakdown
  | MonthlyTargetBreakdown

export type MonetaryStat = {
  label: string
  amount: number
  variant?: 'positive' | 'negative' | 'neutral'
  helper?: string
  breakdown?: StatBreakdown
}

export type CategoryBudgetSummary = {
  budgetId: string
  accountId: string
  accountName: string
  categoryId: string
  categoryName: string
  categoryType: TransactionType
  planned: number
  actual: number
  remaining: number
  month: string
}

export type MonthlyHistoryPoint = {
  month: string
  income: number
  expense: number
  net: number
}

export type RecurringTemplateSummary = {
  id: string
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency: Currency
  description: string | null
  dayOfMonth: number
  isActive: boolean
  accountName: string
  categoryName: string
  startMonthKey: string | null
  endMonthKey: string | null
}

export type HoldingWithPrice = {
  id: string
  accountId: string
  accountName: string
  categoryId: string
  categoryName: string
  symbol: string
  quantity: number
  averageCost: number
  currency: Currency
  notes: string | null
  currentPrice: number | null
  changePercent: number | null
  marketValue: number
  costBasis: number
  gainLoss: number
  gainLossPercent: number
  priceAge: Date | null
  isStale: boolean
  // Converted values in preferred currency
  currentPriceConverted?: number | null
  marketValueConverted?: number
  costBasisConverted?: number
  gainLossConverted?: number
}

// Expense sharing types
export type SharedExpenseParticipant = {
  id: string
  shareAmount: number
  sharePercentage: number | null
  status: PaymentStatus
  paidAt: Date | null
  reminderSentAt: Date | null
  participant: {
    id: string
    email: string
    displayName: string
  }
}

export type SharedExpenseSummary = {
  id: string
  transactionId: string
  splitType: SplitType
  totalAmount: number
  currency: Currency
  description: string | null
  createdAt: Date
  transaction: {
    id: string
    date: Date
    description: string | null
    category: {
      id: string
      name: string
    }
  }
  participants: SharedExpenseParticipant[]
  totalOwed: number
  totalPaid: number
  allSettled: boolean
}

export type ExpenseParticipationSummary = {
  id: string
  shareAmount: number
  sharePercentage: number | null
  status: PaymentStatus
  paidAt: Date | null
  sharedExpense: {
    id: string
    splitType: SplitType
    totalAmount: number
    currency: Currency
    description: string | null
    createdAt: Date
    transaction: {
      id: string
      date: Date
      description: string | null
      category: {
        id: string
        name: string
      }
    }
    owner: {
      id: string
      email: string
      displayName: string
    }
  }
}

export type SettlementBalance = {
  userId: string
  userEmail: string
  userDisplayName: string
  currency: Currency
  youOwe: number
  theyOwe: number
  netBalance: number
}

// Base transaction type with relations
export type TransactionWithDisplay = Omit<
  Prisma.TransactionGetPayload<{
    include: {
      account: true
      category: true
    }
  }>,
  'amount' | 'month'
> & {
  amount: number
  convertedAmount: number
  displayCurrency: Currency
  month: string
}

export type MonthlyIncomeGoalSummary = {
  amount: number
  currency: string
  isDefault: boolean
} | null

export type DashboardData = {
  month: string
  stats: MonetaryStat[]
  budgets: CategoryBudgetSummary[]
  transactions: TransactionWithDisplay[]
  recurringTemplates: RecurringTemplateSummary[]
  transactionRequests: Awaited<ReturnType<typeof getTransactionRequests>>
  accounts: Awaited<ReturnType<typeof getAccounts>>
  categories: Awaited<ReturnType<typeof getCategories>>
  holdings: HoldingWithPrice[]
  comparison: {
    previousMonth: string
    previousNet: number
    change: number
  }
  history: MonthlyHistoryPoint[]
  exchangeRateLastUpdate: Date | null
  preferredCurrency?: Currency
  // Income goal for freelancers/variable income
  monthlyIncomeGoal?: MonthlyIncomeGoalSummary
  // Actual income for this month (for income goal progress)
  actualIncome?: number
  // Expense sharing data
  sharedExpenses?: SharedExpenseSummary[]
  expensesSharedWithMe?: ExpenseParticipationSummary[]
  settlementBalances?: SettlementBalance[]
}
