// Finance module - handles transactions, budgets, holdings, and dashboard data
import { Prisma, TransactionType, Currency, PaymentStatus, SplitType } from '@prisma/client'
import { addMonths, subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getMonthKey, getMonthStartFromKey } from '@/utils/date'
import {
  convertAmount,
  getLastUpdateTime,
  batchLoadExchangeRates,
  convertAmountWithCache,
  type RateCache,
} from '@/lib/currency'

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

const TWO_DECIMAL = 100

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (!value) return 0
  const parsed = typeof value === 'number' ? value : value.toNumber()
  return Math.round(parsed * TWO_DECIMAL) / TWO_DECIMAL
}

function sumByType(tx: Array<{ type: TransactionType; amount: number }>, type: TransactionType) {
  return tx.filter((t) => t.type === type).reduce((acc, curr) => acc + curr.amount, 0)
}

/**
 * Convert transaction amount using batch-loaded rate cache (sync) or individual lookup (async)
 */
function convertTransactionAmountSync(
  amount: Prisma.Decimal | number,
  fromCurrency: Currency,
  toCurrency: Currency | undefined,
  rateCache: RateCache,
): number {
  const originalAmount = decimalToNumber(amount)
  if (!toCurrency || fromCurrency === toCurrency) {
    return originalAmount
  }
  return convertAmountWithCache(originalAmount, fromCurrency, toCurrency, rateCache)
}

async function convertTransactionAmount(
  amount: Prisma.Decimal | number,
  fromCurrency: Currency,
  toCurrency: Currency | undefined,
  date: Date,
  _context: string,
): Promise<number> {
  const originalAmount = decimalToNumber(amount)
  if (!toCurrency || fromCurrency === toCurrency) {
    return originalAmount
  }
  try {
    return await convertAmount(originalAmount, fromCurrency, toCurrency, date)
  } catch {
    return originalAmount
  }
}

function buildAccountScopedWhere(base: Prisma.TransactionWhereInput, accountId?: string): Prisma.TransactionWhereInput {
  if (!accountId) {
    return base
  }

  return {
    ...base,
    accountId,
  }
}

export async function getAccounts(userId?: string) {
  const where = userId ? { userId } : {}
  return prisma.account.findMany({
    where,
    orderBy: { name: 'asc' },
  })
}

export async function getCategories(userId?: string) {
  const where = userId ? { userId } : {}
  return prisma.category.findMany({
    where,
    orderBy: { name: 'asc' },
  })
}

export async function getTransactionRequests({
  accountId,
  status,
}: {
  accountId?: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED'
} = {}) {
  const where: Prisma.TransactionRequestWhereInput = {}
  if (accountId) {
    where.toId = accountId
  }
  if (status) {
    where.status = status
  }

  return prisma.transactionRequest.findMany({
    where,
    include: {
      from: true,
      category: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getTransactionsForMonth({
  monthKey,
  accountId,
  preferredCurrency,
}: {
  monthKey: string
  accountId?: string
  preferredCurrency?: Currency
}): Promise<TransactionWithDisplay[]> {
  const monthStart = getMonthStartFromKey(monthKey)
  const nextMonthStart = addMonths(monthStart, 1)
  const where = buildAccountScopedWhere(
    {
      date: {
        gte: monthStart,
        lt: nextMonthStart,
      },
    },
    accountId,
  )

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: {
      date: 'desc',
    },
    include: {
      category: true,
      account: true,
    },
  })

  // Batch load exchange rates in one query (fixes N+1)
  const rateCache = await batchLoadExchangeRates()

  const converted = transactions.map((transaction) => {
    const originalAmount = decimalToNumber(transaction.amount)
    const convertedAmount = convertTransactionAmountSync(
      transaction.amount,
      transaction.currency,
      preferredCurrency,
      rateCache,
    )

    return {
      ...transaction,
      amount: originalAmount,
      convertedAmount,
      displayCurrency: preferredCurrency || transaction.currency,
      month: getMonthKey(transaction.month),
    } satisfies TransactionWithDisplay
  })

  return converted
}

export async function getBudgetsForMonth({ monthKey, accountId }: { monthKey: string; accountId: string }) {
  const monthStart = getMonthStartFromKey(monthKey)

  const budgets = await prisma.budget.findMany({
    where: {
      month: monthStart,
      accountId,
    },
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      category: {
        name: 'asc',
      },
    },
  })

  return budgets
}

export async function getRecurringTemplates({ accountId }: { accountId: string }) {
  const templates = await prisma.recurringTemplate.findMany({
    where: { accountId },
    include: {
      category: true,
      account: true,
    },
    orderBy: {
      dayOfMonth: 'asc',
    },
  })

  return templates.map<RecurringTemplateSummary>((template) => ({
    id: template.id,
    accountId: template.accountId,
    categoryId: template.categoryId,
    type: template.type,
    amount: decimalToNumber(template.amount),
    description: template.description,
    dayOfMonth: template.dayOfMonth,
    isActive: template.isActive,
    accountName: template.account.name,
    categoryName: template.category.name,
    startMonthKey: template.startMonth ? getMonthKey(template.startMonth) : null,
    endMonthKey: template.endMonth ? getMonthKey(template.endMonth) : null,
  }))
}

export async function getDashboardData({
  monthKey,
  accountId,
  preferredCurrency,
  accounts: providedAccounts,
  userId,
}: {
  monthKey: string
  accountId: string
  preferredCurrency?: Currency
  accounts?: Awaited<ReturnType<typeof getAccounts>>
  userId?: string
}): Promise<DashboardData> {
  const monthStart = getMonthStartFromKey(monthKey)
  const previousMonthStart = subMonths(monthStart, 1)
  const accounts = providedAccounts ?? (await getAccounts(userId))

  const [
    categories,
    budgets,
    transactions,
    transactionRequests,
    recurringTemplates,
    previousTransactionsRaw,
    historyTransactionsRaw,
    exchangeRateLastUpdate,
    sharedExpenses,
    expensesSharedWithMe,
    settlementBalances,
  ] = await Promise.all([
    getCategories(userId),
    getBudgetsForMonth({ monthKey, accountId }),
    getTransactionsForMonth({
      monthKey,
      accountId,
      preferredCurrency,
    }),
    getTransactionRequests({ accountId, status: 'PENDING' }),
    getRecurringTemplates({ accountId }),
    prisma.transaction.findMany({
      where: buildAccountScopedWhere(
        {
          date: {
            gte: previousMonthStart,
            lt: monthStart,
          },
        },
        accountId,
      ),
      select: {
        type: true,
        amount: true,
        currency: true,
        date: true,
      },
    }),
    prisma.transaction.findMany({
      where: buildAccountScopedWhere(
        {
          month: {
            gte: subMonths(monthStart, 5),
            lte: monthStart,
          },
        },
        accountId,
      ),
      select: {
        type: true,
        amount: true,
        currency: true,
        date: true,
        month: true,
      },
      orderBy: {
        month: 'asc',
      },
    }),
    getLastUpdateTime(),
    userId ? getSharedExpenses(userId) : Promise.resolve([]),
    userId ? getExpensesSharedWithMe(userId) : Promise.resolve([]),
    userId ? getSettlementBalance(userId) : Promise.resolve([]),
  ])

  const transactionsWithNumbers = transactions

  // Use converted amounts for calculations when preferred currency is set
  const totals = transactionsWithNumbers.map((t) => ({
    type: t.type,
    amount: t.convertedAmount,
  }))

  const actualIncome = sumByType(totals, TransactionType.INCOME)
  const actualExpense = sumByType(totals, TransactionType.EXPENSE)

  // Group transactions by category for per-budget calculations
  const expensesByCategory = new Map<string, number>()
  const incomeByCategory = new Map<string, number>()

  transactionsWithNumbers.forEach((transaction) => {
    const map = transaction.type === TransactionType.EXPENSE ? expensesByCategory : incomeByCategory
    const current = map.get(transaction.categoryId) ?? 0
    map.set(transaction.categoryId, current + transaction.convertedAmount)
  })

  // Calculate planned and remaining amounts per-budget (only counting transactions in budgeted categories)
  const { plannedIncome, remainingIncome } = budgets
    .filter((budget) => budget.category.type === TransactionType.INCOME)
    .reduce(
      (acc, budget) => {
        const planned = decimalToNumber(budget.planned)
        const actual = incomeByCategory.get(budget.categoryId) ?? 0
        return {
          plannedIncome: acc.plannedIncome + planned,
          remainingIncome: acc.remainingIncome + (planned - actual),
        }
      },
      { plannedIncome: 0, remainingIncome: 0 },
    )

  const { plannedExpense, remainingExpense } = budgets
    .filter((budget) => budget.category.type === TransactionType.EXPENSE)
    .reduce(
      (acc, budget) => {
        const planned = decimalToNumber(budget.planned)
        const actual = expensesByCategory.get(budget.categoryId) ?? 0
        return {
          plannedExpense: acc.plannedExpense + planned,
          remainingExpense: acc.remainingExpense + (planned - actual),
        }
      },
      { plannedExpense: 0, remainingExpense: 0 },
    )

  const projectedNet = actualIncome + Math.max(remainingIncome, 0) - (actualExpense + Math.max(remainingExpense, 0))
  const actualNet = actualIncome - actualExpense
  const plannedNet = plannedIncome - plannedExpense

  // Convert previous month's transactions to preferred currency
  const previousTransactionsConverted = await Promise.all(
    previousTransactionsRaw.map(async (transaction) => ({
      type: transaction.type,
      amount: await convertTransactionAmount(
        transaction.amount,
        transaction.currency,
        preferredCurrency,
        transaction.date,
        'previous transaction',
      ),
    })),
  )

  const previousIncome = sumByType(previousTransactionsConverted, TransactionType.INCOME)
  const previousExpense = sumByType(previousTransactionsConverted, TransactionType.EXPENSE)

  const previousNet = previousIncome - previousExpense
  const change = actualNet - previousNet

  const budgetsSummary: CategoryBudgetSummary[] = budgets.map((budget) => {
    const planned = decimalToNumber(budget.planned)
    const actual =
      budget.category.type === TransactionType.EXPENSE
        ? (expensesByCategory.get(budget.categoryId) ?? 0)
        : (incomeByCategory.get(budget.categoryId) ?? 0)
    const remaining = planned - actual

    return {
      budgetId: budget.id,
      accountId: budget.accountId,
      accountName: budget.account.name,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      categoryType: budget.category.type,
      planned,
      actual,
      remaining,
      month: monthKey,
    }
  })

  // Convert history transactions to preferred currency
  const historyTransactionsConverted = await Promise.all(
    historyTransactionsRaw.map(async (transaction) => ({
      type: transaction.type,
      amount: await convertTransactionAmount(
        transaction.amount,
        transaction.currency,
        preferredCurrency,
        transaction.date,
        'history transaction',
      ),
      month: transaction.month as Date,
    })),
  )

  const historySeed = new Map<string, { income: number; expense: number }>()
  for (let offset = 5; offset >= 0; offset -= 1) {
    const key = getMonthKey(subMonths(monthStart, offset))
    historySeed.set(key, { income: 0, expense: 0 })
  }

  const historyGrouped = historyTransactionsConverted.reduce((acc, entry) => {
    const key = getMonthKey(entry.month)
    const existing = acc.get(key) ?? { income: 0, expense: 0 }
    if (entry.type === TransactionType.INCOME) {
      existing.income += entry.amount
    } else {
      existing.expense += entry.amount
    }
    acc.set(key, existing)
    return acc
  }, historySeed)

  const history: MonthlyHistoryPoint[] = Array.from(historyGrouped.entries())
    .map(([key, value]) => ({
      month: key,
      income: value.income,
      expense: value.expense,
      net: value.income - value.expense,
    }))
    .sort((a, b) => (a.month > b.month ? 1 : -1))

  const stats: MonetaryStat[] = [
    {
      label: 'Saved so far',
      amount: actualNet,
      variant: actualNet >= 0 ? 'positive' : 'negative',
      helper: 'Income minus expenses this month',
    },
    {
      label: 'On track for',
      amount: projectedNet,
      variant: projectedNet >= 0 ? 'positive' : 'negative',
      helper: 'Where you\'ll be at month end',
    },
    {
      label: 'Left to spend',
      amount: Math.max(remainingExpense, 0),
      variant: remainingExpense <= 0 ? 'neutral' : 'negative',
      helper: 'Budget not yet used',
    },
    {
      label: 'Monthly goal',
      amount: plannedNet,
      variant: plannedNet >= 0 ? 'positive' : 'negative',
      helper: 'Your target for the month',
    },
  ]

  return {
    month: monthKey,
    stats,
    budgets: budgetsSummary,
    transactions: transactionsWithNumbers,
    recurringTemplates,
    transactionRequests,
    accounts,
    categories,
    holdings: [], // Will be populated separately in page.tsx
    comparison: {
      previousMonth: getMonthKey(previousMonthStart),
      previousNet,
      change,
    },
    history,
    exchangeRateLastUpdate,
    preferredCurrency,
    sharedExpenses,
    expensesSharedWithMe,
    settlementBalances,
  }
}

export async function getHoldingsWithPrices({
  accountId,
  preferredCurrency,
}: {
  accountId?: string
  preferredCurrency?: Currency
}): Promise<HoldingWithPrice[]> {
  const where: Prisma.HoldingWhereInput = {}
  if (accountId) {
    where.accountId = accountId
  }

  const holdings = await prisma.holding.findMany({
    where,
    include: {
      account: true,
      category: true,
    },
    orderBy: {
      symbol: 'asc',
    },
  })

  // Batch load all prices and rates in parallel (fixes N+1)
  const { batchLoadStockPrices } = await import('@/lib/stock-api')
  const symbols = holdings.map((h) => h.symbol)
  const [priceCache, rateCache] = await Promise.all([batchLoadStockPrices(symbols), batchLoadExchangeRates()])

  const enriched = holdings.map((holding) => {
    // Get price from cache
    const priceData = priceCache.get(holding.symbol.toUpperCase())
    const currentPrice = priceData?.price ?? null
    const changePercent = priceData?.changePercent ?? null
    const priceAge = priceData?.fetchedAt ?? null
    const isStale = priceData?.isStale ?? false

    const quantity = decimalToNumber(holding.quantity)
    const averageCost = decimalToNumber(holding.averageCost)
    const costBasis = quantity * averageCost
    const marketValue = currentPrice !== null ? quantity * currentPrice : costBasis
    const gainLoss = marketValue - costBasis
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

    // Currency conversion using batch-loaded rates
    let currentPriceConverted: number | null = null
    let marketValueConverted = marketValue
    let costBasisConverted = costBasis
    let gainLossConverted = gainLoss

    if (preferredCurrency && holding.currency !== preferredCurrency) {
      if (currentPrice !== null) {
        currentPriceConverted = convertAmountWithCache(currentPrice, holding.currency, preferredCurrency, rateCache)
      }
      marketValueConverted = convertAmountWithCache(marketValue, holding.currency, preferredCurrency, rateCache)
      costBasisConverted = convertAmountWithCache(costBasis, holding.currency, preferredCurrency, rateCache)
      gainLossConverted = marketValueConverted - costBasisConverted
    }

    return {
      id: holding.id,
      accountId: holding.accountId,
      accountName: holding.account.name,
      categoryId: holding.categoryId,
      categoryName: holding.category.name,
      symbol: holding.symbol,
      quantity,
      averageCost,
      currency: holding.currency,
      notes: holding.notes,
      currentPrice,
      changePercent,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent,
      priceAge,
      isStale,
      currentPriceConverted,
      marketValueConverted,
      costBasisConverted,
      gainLossConverted,
    }
  })

  return enriched
}

/**
 * Get expenses shared by a user with others.
 */
export async function getSharedExpenses(userId: string): Promise<SharedExpenseSummary[]> {
  const sharedExpenses = await prisma.sharedExpense.findMany({
    where: { ownerId: userId },
    include: {
      transaction: {
        include: {
          category: true,
        },
      },
      participants: {
        include: {
          participant: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return sharedExpenses.map((expense) => {
    const totalAmount = decimalToNumber(expense.totalAmount)
    const participants = expense.participants.map((p) => ({
      id: p.id,
      shareAmount: decimalToNumber(p.shareAmount),
      sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
      status: p.status,
      paidAt: p.paidAt,
      reminderSentAt: p.reminderSentAt,
      participant: p.participant,
    }))

    const totalOwed = participants
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.shareAmount, 0)
    const totalPaid = participants
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.shareAmount, 0)
    const allSettled = participants.every((p) => p.status !== PaymentStatus.PENDING)

    return {
      id: expense.id,
      transactionId: expense.transactionId,
      splitType: expense.splitType,
      totalAmount,
      currency: expense.currency,
      description: expense.description,
      createdAt: expense.createdAt,
      transaction: {
        id: expense.transaction.id,
        date: expense.transaction.date,
        description: expense.transaction.description,
        category: {
          id: expense.transaction.category.id,
          name: expense.transaction.category.name,
        },
      },
      participants,
      totalOwed,
      totalPaid,
      allSettled,
    }
  })
}

/**
 * Get expenses shared with a user by others.
 */
export async function getExpensesSharedWithMe(userId: string): Promise<ExpenseParticipationSummary[]> {
  const participations = await prisma.expenseParticipant.findMany({
    where: { userId },
    include: {
      sharedExpense: {
        include: {
          transaction: {
            include: {
              category: true,
            },
          },
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return participations.map((p) => ({
    id: p.id,
    shareAmount: decimalToNumber(p.shareAmount),
    sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
    status: p.status,
    paidAt: p.paidAt,
    sharedExpense: {
      id: p.sharedExpense.id,
      splitType: p.sharedExpense.splitType,
      totalAmount: decimalToNumber(p.sharedExpense.totalAmount),
      currency: p.sharedExpense.currency,
      description: p.sharedExpense.description,
      createdAt: p.sharedExpense.createdAt,
      transaction: {
        id: p.sharedExpense.transaction.id,
        date: p.sharedExpense.transaction.date,
        description: p.sharedExpense.transaction.description,
        category: {
          id: p.sharedExpense.transaction.category.id,
          name: p.sharedExpense.transaction.category.name,
        },
      },
      owner: p.sharedExpense.owner,
    },
  }))
}

/**
 * Calculate share amounts for expense sharing based on split type.
 * Pure utility function - no database interaction.
 */
export function calculateShares(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; shareAmount?: number; sharePercentage?: number }>,
  validEmails: string[],
): Map<string, { amount: number; percentage: number | null }> {
  const shares = new Map<string, { amount: number; percentage: number | null }>()
  const numParticipants = validEmails.length

  switch (splitType) {
    case SplitType.EQUAL: {
      const equalShare = Math.round((totalAmount / (numParticipants + 1)) * 100) / 100
      for (const email of validEmails) {
        shares.set(email.toLowerCase(), { amount: equalShare, percentage: null })
      }
      break
    }

    case SplitType.PERCENTAGE: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const percentage = p.sharePercentage ?? 0
        const amount = Math.round(totalAmount * (percentage / 100) * 100) / 100
        shares.set(email, { amount, percentage })
      }
      break
    }

    case SplitType.FIXED: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const amount = p.shareAmount ?? 0
        shares.set(email, { amount, percentage: null })
      }
      break
    }
  }

  return shares
}

/**
 * Calculate settlement balances between the user and everyone they share expenses with.
 * Balances are grouped by user AND currency to avoid mixing different currencies.
 */
export async function getSettlementBalance(userId: string): Promise<SettlementBalance[]> {
  // Get what others owe the user (expenses user shared)
  const sharedByUser = await prisma.expenseParticipant.findMany({
    where: {
      sharedExpense: { ownerId: userId },
      status: PaymentStatus.PENDING,
    },
    include: {
      participant: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      sharedExpense: {
        select: {
          currency: true,
        },
      },
    },
  })

  // Get what user owes others (expenses shared with user)
  const sharedWithUser = await prisma.expenseParticipant.findMany({
    where: {
      userId,
      status: PaymentStatus.PENDING,
    },
    include: {
      sharedExpense: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
  })

  // Aggregate balances by user AND currency
  const balanceMap = new Map<string, SettlementBalance>()

  // Create composite key for user + currency
  const getKey = (otherUserId: string, currency: Currency) => `${otherUserId}:${currency}`

  // Others owe user
  for (const p of sharedByUser) {
    const currency = p.sharedExpense.currency
    const key = getKey(p.participant.id, currency)
    const existing = balanceMap.get(key) || {
      userId: p.participant.id,
      userEmail: p.participant.email,
      userDisplayName: p.participant.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.theyOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  // User owes others
  for (const p of sharedWithUser) {
    const owner = p.sharedExpense.owner
    const currency = p.sharedExpense.currency
    const key = getKey(owner.id, currency)
    const existing = balanceMap.get(key) || {
      userId: owner.id,
      userEmail: owner.email,
      userDisplayName: owner.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.youOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  return Array.from(balanceMap.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
}
