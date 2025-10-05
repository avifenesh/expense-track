import { TransactionType } from '@prisma/client'
import { CategoryBudgetSummary, DashboardData, RecurringTemplateSummary } from '@/lib/finance'

export type BudgetFilter = {
  accountId?: string
  type?: 'all' | TransactionType
}

export function filterBudgets(budgets: CategoryBudgetSummary[], filter: BudgetFilter) {
  return budgets.filter((budget) => {
    const matchAccount = !filter.accountId || budget.accountId === filter.accountId
    const matchType = !filter.type || filter.type === 'all' || budget.categoryType === filter.type
    return matchAccount && matchType
  })
}

export function getBudgetProgress(budget: CategoryBudgetSummary) {
  if (budget.planned <= 0) return budget.actual > 0 ? 1 : 0
  return Math.min(Math.max(budget.actual / budget.planned, 0), 1)
}

export function getHighlightedBudgets(budgets: CategoryBudgetSummary[], limit = 3) {
  return budgets
    .slice()
    .sort((a, b) => getBudgetProgress(b) - getBudgetProgress(a))
    .slice(0, limit)
}

export type TransactionFilter = {
  type?: 'all' | TransactionType
  search?: string
  accountId?: string
}

type Transaction = DashboardData['transactions'][number]

export function filterTransactions(transactions: Transaction[], filter: TransactionFilter) {
  const searchTerm = filter.search?.trim().toLowerCase() ?? ''

  return transactions.filter((transaction) => {
    const matchType = !filter.type || filter.type === 'all' || transaction.type === filter.type
    const matchAccount = !filter.accountId || transaction.accountId === filter.accountId
    const matchSearch =
      searchTerm === '' ||
      transaction.category.name.toLowerCase().includes(searchTerm) ||
      transaction.account.name.toLowerCase().includes(searchTerm) ||
      (transaction.description ?? '').toLowerCase().includes(searchTerm)

    return matchType && matchAccount && matchSearch
  })
}

export type RecurringFilter = {
  type?: 'all' | TransactionType
  includeInactive?: boolean
  accountId?: string
}

export function filterRecurringTemplates(templates: RecurringTemplateSummary[], filter: RecurringFilter) {
  return templates.filter((template) => {
    const matchType = !filter.type || filter.type === 'all' || template.type === filter.type
    const matchAccount = !filter.accountId || template.accountId === filter.accountId
    const matchActive = filter.includeInactive ? true : template.isActive
    return matchType && matchAccount && matchActive
  })
}

export type CategoryFilter = {
  search?: string
  type?: 'all' | TransactionType
  includeArchived?: boolean
}

type Category = DashboardData['categories'][number]

export function filterCategories(categories: Category[], filter: CategoryFilter) {
  const searchTerm = filter.search?.trim().toLowerCase() ?? ''

  return categories.filter((category) => {
    const matchType = !filter.type || filter.type === 'all' || category.type === filter.type
    const matchArchived = filter.includeArchived ? true : !category.isArchived
    const matchSearch = searchTerm === '' || category.name.toLowerCase().includes(searchTerm)
    return matchType && matchArchived && matchSearch
  })
}

export function getBudgetTotals(budgets: CategoryBudgetSummary[]) {
  return budgets.reduce(
    (acc, budget) => {
      if (budget.categoryType === TransactionType.EXPENSE) {
        acc.expensePlanned += budget.planned
        acc.expenseActual += budget.actual
      } else {
        acc.incomePlanned += budget.planned
        acc.incomeActual += budget.actual
      }
      return acc
    },
    {
      expensePlanned: 0,
      expenseActual: 0,
      incomePlanned: 0,
      incomeActual: 0,
    },
  )
}
