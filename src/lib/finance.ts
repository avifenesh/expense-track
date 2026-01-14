// Finance module - handles transactions, budgets, holdings, and dashboard data
/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for Holding model */
import { Prisma, TransactionType, Currency } from '@prisma/client'
import { addMonths, subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { formatMonthLabel, getMonthKey, getMonthStartFromKey } from '@/utils/date'
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

export async function getAccounts() {
  return prisma.account.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function getCategories() {
  return prisma.category.findMany({
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

export async function getBudgetsForMonth({ monthKey, accountId }: { monthKey: string; accountId?: string }) {
  const monthStart = getMonthStartFromKey(monthKey)
  const where: Prisma.BudgetWhereInput = {
    month: monthStart,
  }

  if (accountId) {
    where.accountId = accountId
  }

  const budgets = await prisma.budget.findMany({
    where,
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

export async function getRecurringTemplates({ accountId }: { accountId?: string }) {
  const where: Prisma.RecurringTemplateWhereInput = {}
  if (accountId) {
    where.accountId = accountId
  }

  const templates = await prisma.recurringTemplate.findMany({
    where,
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
}: {
  monthKey: string
  accountId?: string
  preferredCurrency?: Currency
  accounts?: Awaited<ReturnType<typeof getAccounts>>
}): Promise<DashboardData> {
  const monthStart = getMonthStartFromKey(monthKey)
  const previousMonthStart = subMonths(monthStart, 1)
  const accounts = providedAccounts ?? (await getAccounts())

  const [
    categories,
    budgets,
    transactions,
    transactionRequests,
    recurringTemplates,
    previousTransactionsRaw,
    historyTransactionsRaw,
    exchangeRateLastUpdate,
  ] = await Promise.all([
    getCategories(),
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
  ])

  const transactionsWithNumbers = transactions

  // Use converted amounts for calculations when preferred currency is set
  const totals = transactionsWithNumbers.map((t) => ({
    type: t.type,
    amount: t.convertedAmount,
  }))

  const actualIncome = sumByType(totals, TransactionType.INCOME)
  const actualExpense = sumByType(totals, TransactionType.EXPENSE)

  const plannedIncome = budgets
    .filter((budget) => budget.category.type === TransactionType.INCOME)
    .reduce((acc, curr) => acc + decimalToNumber(curr.planned), 0)

  const plannedExpense = budgets
    .filter((budget) => budget.category.type === TransactionType.EXPENSE)
    .reduce((acc, curr) => acc + decimalToNumber(curr.planned), 0)

  const remainingIncome = plannedIncome - actualIncome
  const remainingExpense = plannedExpense - actualExpense

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

  const expensesByCategory = new Map<string, number>()
  const incomeByCategory = new Map<string, number>()

  transactionsWithNumbers.forEach((transaction) => {
    const map = transaction.type === TransactionType.EXPENSE ? expensesByCategory : incomeByCategory
    const current = map.get(transaction.categoryId) ?? 0
    map.set(transaction.categoryId, current + transaction.convertedAmount)
  })

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
      label: 'Actual net',
      amount: actualNet,
      variant: actualNet >= 0 ? 'positive' : 'negative',
      helper: `${formatMonthLabel(monthKey)} performance`,
    },
    {
      label: 'Projected end of month',
      amount: projectedNet,
      variant: projectedNet >= 0 ? 'positive' : 'negative',
      helper: 'Includes planned budgets',
    },
    {
      label: 'Remaining budgets',
      amount: Math.max(remainingExpense, 0),
      variant: remainingExpense <= 0 ? 'neutral' : 'negative',
      helper: 'Expense budgets left to spend',
    },
    {
      label: 'Planned net',
      amount: plannedNet,
      variant: plannedNet >= 0 ? 'positive' : 'negative',
      helper: 'Based on monthly budgets',
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
  }
}

export async function getHoldingsWithPrices({
  accountId,
  preferredCurrency,
}: {
  accountId?: string
  preferredCurrency?: Currency
}): Promise<HoldingWithPrice[]> {
  const where: any = {} // Type assertion workaround for Prisma.HoldingWhereInput
  if (accountId) {
    where.accountId = accountId
  }

  const holdings = await (prisma as any).holding.findMany({
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
  const symbols = holdings.map((h: any) => h.symbol as string)
  const [priceCache, rateCache] = await Promise.all([batchLoadStockPrices(symbols), batchLoadExchangeRates()])

  const enriched = holdings.map((holding: any) => {
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
