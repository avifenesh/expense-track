// Finance module - dashboard data aggregation
import { TransactionType, Currency } from '@prisma/client'
import { subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getMonthKey, getMonthStartFromKey } from '@/utils/date'
import { getLastUpdateTime, batchLoadExchangeRates } from '@/lib/currency'
import { sumByType, convertTransactionAmountSync, buildAccountScopedWhere } from './utils'
import { getAccounts, getCategories, getTransactionRequests } from './accounts'
import { getTransactionsForMonth } from './transactions'
import { getBudgetsForMonth, getMonthlyIncomeGoal } from './budgets'
import { getRecurringTemplates } from './recurring'
import { getSharedExpenses, getExpensesSharedWithMe, getSettlementBalance } from './expense-sharing'
import type { DashboardData, CategoryBudgetSummary, MonetaryStat, MonthlyHistoryPoint } from './types'

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
    monthlyIncomeGoal,
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
    getMonthlyIncomeGoal({ monthKey, accountId }),
    prisma.transaction.findMany({
      where: buildAccountScopedWhere(
        {
          date: {
            gte: previousMonthStart,
            lt: monthStart,
          },
          deletedAt: null,
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
          deletedAt: null,
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
      take: 1000, // Limit results to prevent unbounded queries
    }),
    getLastUpdateTime(),
    // Note: Dashboard uses first page of shared expenses (default 50 items).
    // For users with many shared expenses, the full list is available via dedicated UI.
    userId ? getSharedExpenses(userId).then((r) => r.items) : Promise.resolve([]),
    userId ? getExpensesSharedWithMe(userId).then((r) => r.items) : Promise.resolve([]),
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

  const actualNet = actualIncome - actualExpense

  // Load exchange rates per-month for historical accuracy (fixes N+1 query pattern)
  // Each month uses the exchange rate from the first day of that month, providing
  // more accurate currency conversion for historical data while keeping performance
  // acceptable through batching (one rate lookup per month rather than per transaction).
  const uniqueMonths = new Set<string>()
  uniqueMonths.add(getMonthKey(monthStart)) // Current month
  uniqueMonths.add(getMonthKey(previousMonthStart)) // Previous month
  historyTransactionsRaw.forEach((t) => uniqueMonths.add(getMonthKey(t.month as Date)))

  // Load rates for all unique months in parallel
  const monthRates = new Map<string, Awaited<ReturnType<typeof batchLoadExchangeRates>>>()
  await Promise.all(
    Array.from(uniqueMonths).map(async (monthKey) => {
      const monthDate = getMonthStartFromKey(monthKey)
      const rates = await batchLoadExchangeRates(monthDate)
      monthRates.set(monthKey, rates)
    }),
  )

  // Helper to get rates for a specific month, with fallback to current month rates
  // If no rates are available at all (unlikely but possible), returns empty Map which
  // convertTransactionAmountSync handles gracefully by returning original amount
  const currentMonthKey = getMonthKey(monthStart)
  const currentMonthRates = monthRates.get(currentMonthKey) ?? new Map()
  const getRatesForMonth = (month: Date) => {
    const key = getMonthKey(month)
    return monthRates.get(key) ?? currentMonthRates
  }

  // Calculate planned and remaining amounts per-budget with currency conversion
  // Budgets are converted to preferred currency to match transaction amounts
  const { plannedIncome, remainingIncome } = budgets
    .filter((budget) => budget.category.type === TransactionType.INCOME)
    .reduce(
      (acc, budget) => {
        const planned = convertTransactionAmountSync(
          budget.planned,
          budget.currency,
          preferredCurrency,
          currentMonthRates,
        )
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
        const planned = convertTransactionAmountSync(
          budget.planned,
          budget.currency,
          preferredCurrency,
          currentMonthRates,
        )
        const actual = expensesByCategory.get(budget.categoryId) ?? 0
        return {
          plannedExpense: acc.plannedExpense + planned,
          remainingExpense: acc.remainingExpense + (planned - actual),
        }
      },
      { plannedExpense: 0, remainingExpense: 0 },
    )

  // Calculate expected income from active recurring income templates for this month
  // Only count templates that haven't been applied yet (no matching transaction with recurringTemplateId)
  const appliedTemplateIds = new Set(
    transactionsWithNumbers.filter((t) => t.recurringTemplateId).map((t) => t.recurringTemplateId),
  )
  const expectedRecurringIncome = recurringTemplates
    .filter((template) => {
      if (template.type !== TransactionType.INCOME || !template.isActive) return false
      // Check if template is active for this month (within start/end range)
      if (template.startMonthKey && template.startMonthKey > monthKey) return false
      if (template.endMonthKey && template.endMonthKey < monthKey) return false
      // Don't count if already applied as a transaction this month
      if (appliedTemplateIds.has(template.id)) return false
      return true
    })
    .reduce(
      (sum, template) =>
        sum +
        convertTransactionAmountSync(template.amount, template.currency, preferredCurrency, currentMonthRates),
      0,
    )

  // Calculate expected income with priority: income goal → recurring templates → budgets
  // Convert income goal to preferred currency if set
  const incomeGoalConverted = monthlyIncomeGoal
    ? convertTransactionAmountSync(
        monthlyIncomeGoal.amount,
        monthlyIncomeGoal.currency as Currency,
        preferredCurrency,
        currentMonthRates,
      )
    : 0

  // Calculate total expected income from all active recurring income templates (applied + unapplied)
  // This is used for plannedNet (the "Monthly goal" - a target, not a projection)
  const totalRecurringIncome = recurringTemplates
    .filter((template) => {
      if (template.type !== TransactionType.INCOME || !template.isActive) return false
      if (template.startMonthKey && template.startMonthKey > monthKey) return false
      if (template.endMonthKey && template.endMonthKey < monthKey) return false
      return true
    })
    .reduce(
      (sum, template) =>
        sum +
        convertTransactionAmountSync(template.amount, template.currency, preferredCurrency, currentMonthRates),
      0,
    )

  // Priority: income goal (month-specific or default) → recurring → budgets
  // plannedIncome is the TARGET income for the month (for "Monthly goal" stat)
  const plannedIncomeTarget =
    incomeGoalConverted > 0 ? incomeGoalConverted : totalRecurringIncome > 0 ? totalRecurringIncome : plannedIncome
  const plannedNet = plannedIncomeTarget - plannedExpense

  // For projectedNet ("On track for"), use remaining expected income:
  // - If income goal set: remaining = goal - actual
  // - If recurring templates: only count unapplied templates
  // - Otherwise: use remaining from budgets
  const expectedRemainingIncome =
    incomeGoalConverted > 0
      ? Math.max(incomeGoalConverted - actualIncome, 0)
      : expectedRecurringIncome > 0
        ? expectedRecurringIncome // Already excludes applied templates
        : Math.max(remainingIncome, 0)

  const projectedNet = actualIncome + expectedRemainingIncome - (actualExpense + Math.max(remainingExpense, 0))

  // Convert previous month's transactions using that month's exchange rates
  const previousTransactionsConverted = previousTransactionsRaw.map((transaction) => ({
    type: transaction.type,
    amount: convertTransactionAmountSync(
      transaction.amount,
      transaction.currency,
      preferredCurrency,
      getRatesForMonth(previousMonthStart),
    ),
  }))

  const previousIncome = sumByType(previousTransactionsConverted, TransactionType.INCOME)
  const previousExpense = sumByType(previousTransactionsConverted, TransactionType.EXPENSE)

  const previousNet = previousIncome - previousExpense
  const change = actualNet - previousNet

  const budgetsSummary: CategoryBudgetSummary[] = budgets.map((budget) => {
    // Convert budget amount to preferred currency to match transaction amounts
    const planned = convertTransactionAmountSync(
      budget.planned,
      budget.currency,
      preferredCurrency,
      currentMonthRates,
    )
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

  // Convert history transactions using each transaction's month's exchange rates
  const historyTransactionsConverted = historyTransactionsRaw.map((transaction) => ({
    type: transaction.type,
    amount: convertTransactionAmountSync(
      transaction.amount,
      transaction.currency,
      preferredCurrency,
      getRatesForMonth(transaction.month as Date),
    ),
    month: transaction.month as Date,
  }))

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
      label: 'Net this month',
      amount: actualNet,
      variant: actualNet >= 0 ? 'positive' : 'negative',
      helper: 'Actual income minus actual expenses',
    },
    {
      label: 'On track for',
      amount: projectedNet,
      variant: projectedNet >= 0 ? 'positive' : 'negative',
      helper: 'Projected balance at month end',
    },
    {
      label: 'Left to spend',
      amount: Math.max(remainingExpense, 0),
      variant: remainingExpense <= 0 ? 'neutral' : 'negative',
      helper: 'Remaining expense budget',
    },
    {
      label: 'Monthly target',
      amount: plannedNet,
      variant: plannedNet >= 0 ? 'positive' : 'negative',
      helper: 'Planned income minus budgeted expenses',
    },
  ]

  // Convert monthly income goal amount to preferred currency for UI display
  const monthlyIncomeGoalConverted = monthlyIncomeGoal
    ? {
        ...monthlyIncomeGoal,
        amount: convertTransactionAmountSync(
          monthlyIncomeGoal.amount,
          monthlyIncomeGoal.currency as Currency,
          preferredCurrency,
          currentMonthRates,
        ),
      }
    : null

  // Count how many recurring templates are INCOME type
  const incomeTemplateCount = recurringTemplates.filter(
    (t) => t.type === TransactionType.INCOME && t.isActive,
  ).length

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
    monthlyIncomeGoal: monthlyIncomeGoalConverted,
    actualIncome,
    sharedExpenses,
    expensesSharedWithMe,
    settlementBalances,
    plannedIncomeBreakdown: {
      fromIncomeGoal: incomeGoalConverted,
      fromRecurringTemplates: totalRecurringIncome,
      fromBudgets: plannedIncome,
      totalRecurringIncomeTemplates: incomeTemplateCount,
      plannedExpense,
    },
  }
}
