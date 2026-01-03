import { describe, expect, it } from 'vitest'
import { TransactionType, AccountType, Currency } from '@prisma/client'
import {
  filterBudgets,
  getBudgetProgress,
  getHighlightedBudgets,
  filterTransactions,
  filterRecurringTemplates,
  filterCategories,
  getBudgetTotals,
} from '@/lib/dashboard-ux'

const sampleBudgets = [
  {
    budgetId: 'b1',
    accountId: 'a1',
    accountName: 'Joint',
    categoryId: 'c1',
    categoryName: 'Rent',
    categoryType: TransactionType.EXPENSE,
    planned: 1200,
    actual: 900,
    remaining: 300,
    month: '2025-10-01T00:00:00.000Z',
  },
  {
    budgetId: 'b2',
    accountId: 'a2',
    accountName: 'Partner',
    categoryId: 'c2',
    categoryName: 'Salary',
    categoryType: TransactionType.INCOME,
    planned: 4000,
    actual: 4200,
    remaining: -200,
    month: '2025-10-01T00:00:00.000Z',
  },
  {
    budgetId: 'b3',
    accountId: 'a1',
    accountName: 'Joint',
    categoryId: 'c3',
    categoryName: 'Dining',
    categoryType: TransactionType.EXPENSE,
    planned: 400,
    actual: 380,
    remaining: 20,
    month: '2025-10-01T00:00:00.000Z',
  },
]

const sampleTransactions = [
  {
    id: 't1',
    accountId: 'a1',
    categoryId: 'c1',
    type: TransactionType.EXPENSE,
    amount: 50,
    currency: Currency.USD,
    convertedAmount: 50,
    displayCurrency: Currency.USD,
    date: new Date('2025-10-05'),
    description: 'Coffee with Sam',
    isRecurring: false,
    isMutual: false,
    recurringTemplateId: null,
    category: {
      id: 'c1',
      name: 'Dining',
      type: TransactionType.EXPENSE,
      color: null,
      isHolding: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    account: {
      id: 'a1',
      name: 'Joint',
      type: AccountType.PARTNER,
      preferredCurrency: Currency.USD,
      color: null,
      icon: null,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    month: '2025-10',
  },
  {
    id: 't2',
    accountId: 'a2',
    categoryId: 'c2',
    type: TransactionType.INCOME,
    amount: 1200,
    currency: Currency.USD,
    convertedAmount: 1200,
    displayCurrency: Currency.USD,
    date: new Date('2025-10-01'),
    description: 'October salary',
    isRecurring: true,
    isMutual: false,
    recurringTemplateId: 'rt1',
    category: {
      id: 'c2',
      name: 'Salary',
      type: TransactionType.INCOME,
      color: null,
      isHolding: false,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    account: {
      id: 'a2',
      name: 'Partner',
      type: AccountType.SELF,
      preferredCurrency: Currency.USD,
      color: null,
      icon: null,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    month: '2025-10',
  },
]

const sampleRecurring = [
  {
    id: 'r1',
    accountId: 'a1',
    categoryId: 'c1',
    type: TransactionType.EXPENSE,
    amount: 80,
    description: 'Gym membership',
    dayOfMonth: 12,
    isActive: true,
    accountName: 'Joint',
    categoryName: 'Fitness',
    startMonthKey: '2025-01',
    endMonthKey: null,
  },
  {
    id: 'r2',
    accountId: 'a2',
    categoryId: 'c2',
    type: TransactionType.INCOME,
    amount: 4500,
    description: 'Salary',
    dayOfMonth: 1,
    isActive: false,
    accountName: 'Partner',
    categoryName: 'Salary',
    startMonthKey: '2023-06',
    endMonthKey: null,
  },
]

const sampleCategories = [
  {
    id: 'c1',
    name: 'Dining',
    type: TransactionType.EXPENSE,
    color: null,
    isHolding: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c2',
    name: 'Salary',
    type: TransactionType.INCOME,
    color: null,
    isHolding: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'c3',
    name: 'Travel',
    type: TransactionType.EXPENSE,
    color: null,
    isHolding: false,
    isArchived: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('dashboard-ux helpers', () => {
  it('filters budgets by account and type', () => {
    const filtered = filterBudgets(sampleBudgets, { accountId: 'a1', type: TransactionType.EXPENSE })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((budget) => budget.accountId === 'a1')).toBe(true)
  })

  it('computes budget progress safely when planned is zero', () => {
    const progress = getBudgetProgress({ ...sampleBudgets[0], planned: 0, actual: 1500 })
    expect(progress).toBe(1)
  })

  it('returns highlighted budgets ordered by utilization', () => {
    const highlights = getHighlightedBudgets(sampleBudgets, 2)
    expect(highlights).toHaveLength(2)
    expect(highlights[0].categoryName).toBe('Salary')
  })

  it('filters transactions by type, account and search term', () => {
    const filtered = filterTransactions(sampleTransactions, {
      type: TransactionType.EXPENSE,
      search: 'sam',
      accountId: 'a1',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('t1')
  })

  it('includes inactive recurring items only when requested', () => {
    const activeOnly = filterRecurringTemplates(sampleRecurring, { type: 'all', includeInactive: false })
    expect(activeOnly).toHaveLength(1)
    const withInactive = filterRecurringTemplates(sampleRecurring, { includeInactive: true })
    expect(withInactive).toHaveLength(2)
  })

  it('filters categories by search, type and archived flag', () => {
    const filtered = filterCategories(sampleCategories, { search: 'sal', type: TransactionType.INCOME })
    expect(filtered).toHaveLength(1)
    const includeArchived = filterCategories(sampleCategories, { includeArchived: true })
    expect(includeArchived).toHaveLength(3)
  })

  it('summarizes budget totals by type', () => {
    const totals = getBudgetTotals(sampleBudgets)
    expect(totals.expensePlanned).toBe(1600)
    expect(totals.incomeActual).toBe(4200)
  })
})
