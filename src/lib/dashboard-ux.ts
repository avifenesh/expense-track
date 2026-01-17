import { TransactionType } from '@prisma/client'
import { CategoryBudgetSummary, DashboardData, RecurringTemplateSummary } from '@/lib/finance'

// Generic predicate filter configuration
// Maps filter keys to predicate functions that check if an item matches the filter value
type PredicateConfig<TItem, TFilter> = {
  [K in keyof TFilter]?: (item: TItem, value: NonNullable<TFilter[K]>) => boolean
}

/**
 * Creates a typed filter function from predicate configuration.
 * Reduces boilerplate for filter functions with common patterns.
 *
 * @param config - Object mapping filter keys to predicate functions
 * @returns A filter function that applies all predicates
 */
function createFilter<TItem, TFilter extends Record<string, unknown>>(
  config: PredicateConfig<TItem, TFilter>,
): (items: TItem[], filter: Partial<TFilter>) => TItem[] {
  return (items, filter) => {
    return items.filter((item) =>
      Object.entries(filter).every(([key, value]) => {
        // Skip undefined/null filter values (treat as "match all")
        if (value === undefined || value === null) return true
        // Skip 'all' special value for type filters
        if (value === 'all') return true

        const predicate = config[key as keyof TFilter]
        if (!predicate) return true

        return predicate(item, value as NonNullable<TFilter[keyof TFilter]>)
      }),
    )
  }
}

export type BudgetFilter = {
  accountId?: string
  type?: 'all' | TransactionType
}

export const filterBudgets = createFilter<CategoryBudgetSummary, BudgetFilter>({
  accountId: (item, value) => item.accountId === value,
  type: (item, value) => item.categoryType === value,
})

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

// Transaction filter uses createFilter for simple predicates, with custom search logic
const baseTransactionFilter = createFilter<Transaction, Pick<TransactionFilter, 'type' | 'accountId'>>({
  type: (item, value) => item.type === value,
  accountId: (item, value) => item.accountId === value,
})

export function filterTransactions(transactions: Transaction[], filter: TransactionFilter) {
  // Apply base predicates first
  let result = baseTransactionFilter(transactions, filter)

  // Then apply search filter (spans multiple fields, so handled separately)
  const searchTerm = filter.search?.trim().toLowerCase() ?? ''
  if (searchTerm !== '') {
    result = result.filter(
      (t) =>
        t.category.name.toLowerCase().includes(searchTerm) ||
        t.account.name.toLowerCase().includes(searchTerm) ||
        (t.description ?? '').toLowerCase().includes(searchTerm),
    )
  }

  return result
}

export type RecurringFilter = {
  type?: 'all' | TransactionType
  includeInactive?: boolean
  accountId?: string
}

// Recurring filter wraps createFilter with default behavior for includeInactive
const baseRecurringFilter = createFilter<RecurringTemplateSummary, RecurringFilter>({
  type: (item, value) => item.type === value,
  accountId: (item, value) => item.accountId === value,
})

export function filterRecurringTemplates(templates: RecurringTemplateSummary[], filter: RecurringFilter) {
  // Apply base predicates first
  let result = baseRecurringFilter(templates, filter)

  // Apply includeInactive filter (default: only show active)
  // When undefined/false, exclude inactive items; when true, include all
  if (!filter.includeInactive) {
    result = result.filter((t) => t.isActive)
  }

  return result
}

export type CategoryFilter = {
  search?: string
  type?: 'all' | TransactionType
  includeArchived?: boolean
}

type Category = DashboardData['categories'][number]

// Category filter uses createFilter for type predicate, with custom search and archive logic
const baseCategoryFilter = createFilter<Category, Pick<CategoryFilter, 'type'>>({
  type: (item, value) => item.type === value,
})

export function filterCategories(categories: Category[], filter: CategoryFilter) {
  // Apply base predicates first
  let result = baseCategoryFilter(categories, filter)

  // Apply includeArchived filter (default: exclude archived)
  // When undefined/false, exclude archived items; when true, include all
  if (!filter.includeArchived) {
    result = result.filter((c) => !c.isArchived)
  }

  // Then apply search filter
  const searchTerm = filter.search?.trim().toLowerCase() ?? ''
  if (searchTerm !== '') {
    result = result.filter((c) => c.name.toLowerCase().includes(searchTerm))
  }

  return result
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
