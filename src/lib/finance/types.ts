// Finance module - shared types
import { Prisma, TransactionType, Currency, PaymentStatus, SplitType } from '@prisma/client'
import type { getTransactionRequests } from './accounts'
import type { getAccounts, getCategories } from './accounts'

export type MonetaryStat = {
  label: string
  amount: number
  variant?: 'positive' | 'negative' | 'neutral'
  helper?: string
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
  // Expense sharing data
  sharedExpenses?: SharedExpenseSummary[]
  expensesSharedWithMe?: ExpenseParticipationSummary[]
  settlementBalances?: SettlementBalance[]
}
