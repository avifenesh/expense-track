import { describe, expect, it } from 'vitest'
import { TransactionType, Currency, AccountType } from '@prisma/client'
import {
  filterBudgets,
  getBudgetProgress,
  getHighlightedBudgets,
  filterTransactions,
  filterRecurringTemplates,
  filterCategories,
} from '@/lib/dashboard-ux'

// Test data matching the types used by extracted tab components
const mockAccounts = [
  {
    id: 'acc-self',
    name: 'My Account',
    type: AccountType.SELF,
    preferredCurrency: Currency.USD,
    color: null,
    icon: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'acc-partner',
    name: 'Partner Account',
    type: AccountType.PARTNER,
    preferredCurrency: Currency.EUR,
    color: null,
    icon: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockCategories = [
  {
    id: 'cat-groceries',
    name: 'Groceries',
    type: TransactionType.EXPENSE,
    color: '#22c55e',
    isHolding: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-salary',
    name: 'Salary',
    type: TransactionType.INCOME,
    color: '#3b82f6',
    isHolding: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cat-archived',
    name: 'Old Category',
    type: TransactionType.EXPENSE,
    color: null,
    isHolding: false,
    isArchived: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockBudgets = [
  {
    budgetId: 'budget-1',
    accountId: 'acc-self',
    accountName: 'My Account',
    categoryId: 'cat-groceries',
    categoryName: 'Groceries',
    categoryType: TransactionType.EXPENSE,
    planned: 500,
    actual: 450,
    remaining: 50,
    month: '2025-01-01T00:00:00.000Z',
  },
  {
    budgetId: 'budget-2',
    accountId: 'acc-partner',
    accountName: 'Partner Account',
    categoryId: 'cat-salary',
    categoryName: 'Salary',
    categoryType: TransactionType.INCOME,
    planned: 5000,
    actual: 5000,
    remaining: 0,
    month: '2025-01-01T00:00:00.000Z',
  },
  {
    budgetId: 'budget-3',
    accountId: 'acc-self',
    accountName: 'My Account',
    categoryId: 'cat-salary',
    categoryName: 'Salary',
    categoryType: TransactionType.INCOME,
    planned: 3000,
    actual: 2800,
    remaining: 200,
    month: '2025-01-01T00:00:00.000Z',
  },
]

const mockTransactions = [
  {
    id: 'tx-1',
    accountId: 'acc-self',
    categoryId: 'cat-groceries',
    type: TransactionType.EXPENSE,
    amount: 75.5,
    currency: Currency.USD,
    convertedAmount: 75.5,
    displayCurrency: Currency.USD,
    date: new Date('2025-01-15'),
    description: 'Weekly groceries at Walmart',
    isRecurring: false,
    isMutual: false,
    recurringTemplateId: null,
    category: mockCategories[0],
    account: mockAccounts[0],
    createdAt: new Date(),
    updatedAt: new Date(),
    month: '2025-01',
  },
  {
    id: 'tx-2',
    accountId: 'acc-partner',
    categoryId: 'cat-salary',
    type: TransactionType.INCOME,
    amount: 5000,
    currency: Currency.EUR,
    convertedAmount: 5500,
    displayCurrency: Currency.USD,
    date: new Date('2025-01-01'),
    description: 'January salary deposit',
    isRecurring: true,
    isMutual: false,
    recurringTemplateId: 'rec-1',
    category: mockCategories[1],
    account: mockAccounts[1],
    createdAt: new Date(),
    updatedAt: new Date(),
    month: '2025-01',
  },
]

const mockRecurringTemplates = [
  {
    id: 'rec-1',
    accountId: 'acc-self',
    categoryId: 'cat-groceries',
    type: TransactionType.EXPENSE,
    amount: 100,
    description: 'Weekly grocery budget',
    dayOfMonth: 1,
    isActive: true,
    accountName: 'My Account',
    categoryName: 'Groceries',
    startMonthKey: '2024-01',
    endMonthKey: null,
  },
  {
    id: 'rec-2',
    accountId: 'acc-partner',
    categoryId: 'cat-salary',
    type: TransactionType.INCOME,
    amount: 5000,
    description: 'Monthly salary',
    dayOfMonth: 1,
    isActive: true,
    accountName: 'Partner Account',
    categoryName: 'Salary',
    startMonthKey: '2023-06',
    endMonthKey: null,
  },
  {
    id: 'rec-3',
    accountId: 'acc-self',
    categoryId: 'cat-archived',
    type: TransactionType.EXPENSE,
    amount: 50,
    description: 'Old subscription',
    dayOfMonth: 15,
    isActive: false,
    accountName: 'My Account',
    categoryName: 'Old Category',
    startMonthKey: '2022-01',
    endMonthKey: '2024-06',
  },
]

describe('BudgetsTab filtering logic', () => {
  it('filters budgets by account', () => {
    const filtered = filterBudgets(mockBudgets, { accountId: 'acc-self' })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((b) => b.accountId === 'acc-self')).toBe(true)
  })

  it('filters budgets by type (expense/income)', () => {
    const expenses = filterBudgets(mockBudgets, { type: TransactionType.EXPENSE })
    const income = filterBudgets(mockBudgets, { type: TransactionType.INCOME })
    expect(expenses).toHaveLength(1)
    expect(income).toHaveLength(2)
  })

  it('combines account and type filters', () => {
    const filtered = filterBudgets(mockBudgets, {
      accountId: 'acc-self',
      type: TransactionType.INCOME,
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].categoryName).toBe('Salary')
  })

  it('calculates budget progress correctly', () => {
    const progress = getBudgetProgress(mockBudgets[0])
    expect(progress).toBeCloseTo(0.9) // 450/500
  })

  it('caps progress at 1 when over budget', () => {
    const overBudget = { ...mockBudgets[0], actual: 600 }
    const progress = getBudgetProgress(overBudget)
    expect(progress).toBe(1)
  })

  it('returns highlighted budgets sorted by utilization', () => {
    const highlights = getHighlightedBudgets(mockBudgets, 2)
    expect(highlights).toHaveLength(2)
    // Budget-2 is at 100%, budget-1 is at 90%
    expect(highlights[0].budgetId).toBe('budget-2')
  })
})

describe('TransactionsTab filtering logic', () => {
  it('filters transactions by type', () => {
    const expenses = filterTransactions(mockTransactions, { type: TransactionType.EXPENSE })
    const income = filterTransactions(mockTransactions, { type: TransactionType.INCOME })
    expect(expenses).toHaveLength(1)
    expect(income).toHaveLength(1)
  })

  it('filters transactions by account', () => {
    const filtered = filterTransactions(mockTransactions, { accountId: 'acc-self' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('tx-1')
  })

  it('filters transactions by search term in description', () => {
    const filtered = filterTransactions(mockTransactions, { search: 'walmart' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].description).toContain('Walmart')
  })

  it('search is case-insensitive', () => {
    const filtered = filterTransactions(mockTransactions, { search: 'SALARY' })
    expect(filtered).toHaveLength(1)
  })

  it('combines multiple filters', () => {
    const filtered = filterTransactions(mockTransactions, {
      type: TransactionType.EXPENSE,
      accountId: 'acc-self',
      search: 'groceries',
    })
    expect(filtered).toHaveLength(1)
  })
})

describe('RecurringTab filtering logic', () => {
  it('filters by active status', () => {
    const activeOnly = filterRecurringTemplates(mockRecurringTemplates, { includeInactive: false })
    expect(activeOnly).toHaveLength(2)
    expect(activeOnly.every((r) => r.isActive)).toBe(true)
  })

  it('includes inactive when requested', () => {
    const all = filterRecurringTemplates(mockRecurringTemplates, { includeInactive: true })
    expect(all).toHaveLength(3)
  })

  it('filters by type', () => {
    const expenses = filterRecurringTemplates(mockRecurringTemplates, {
      type: TransactionType.EXPENSE,
      includeInactive: true,
    })
    expect(expenses).toHaveLength(2)
  })

  it('filters by account', () => {
    const filtered = filterRecurringTemplates(mockRecurringTemplates, {
      accountId: 'acc-partner',
      includeInactive: false,
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].accountName).toBe('Partner Account')
  })
})

describe('CategoriesTab filtering logic', () => {
  it('filters by search term', () => {
    const filtered = filterCategories(mockCategories, { search: 'groc' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('Groceries')
  })

  it('filters by type', () => {
    const income = filterCategories(mockCategories, { type: TransactionType.INCOME })
    expect(income).toHaveLength(1)
    expect(income[0].name).toBe('Salary')
  })

  it('excludes archived by default', () => {
    const filtered = filterCategories(mockCategories, {})
    expect(filtered).toHaveLength(2)
    expect(filtered.every((c) => !c.isArchived)).toBe(true)
  })

  it('includes archived when requested', () => {
    const filtered = filterCategories(mockCategories, { includeArchived: true })
    expect(filtered).toHaveLength(3)
  })
})
