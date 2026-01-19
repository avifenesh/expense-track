import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma, TransactionType, Currency } from '@prisma/client'
import type { Account, Category, Transaction, Budget, RecurringTemplate } from '@prisma/client'

// Mock dependencies BEFORE imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    monthlyIncomeGoal: {
      findFirst: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    transactionRequest: {
      findMany: vi.fn(),
    },
    budget: {
      findMany: vi.fn(),
    },
    recurringTemplate: {
      findMany: vi.fn(),
    },
    holding: {
      findMany: vi.fn(),
    },
    sharedExpense: {
      findMany: vi.fn(),
    },
    expenseParticipant: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/currency', () => ({
  convertAmount: vi.fn(),
  convertAmountWithCache: vi.fn(),
  getLastUpdateTime: vi.fn(),
  batchLoadExchangeRates: vi.fn(),
}))

vi.mock('@/lib/stock-api', () => ({
  batchLoadStockPrices: vi.fn(),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import * as currencyLib from '@/lib/currency'
import * as financeLib from '@/lib/finance'
import type { RateCache } from '@/lib/currency'

// Type for mocked prisma
type MockedPrisma = typeof prisma & {
  holding: {
    findMany: ReturnType<typeof vi.fn>
  }
  monthlyIncomeGoal: {
    findFirst: ReturnType<typeof vi.fn>
  }
  account: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
  sharedExpense: {
    findMany: ReturnType<typeof vi.fn>
  }
  expenseParticipant: {
    findMany: ReturnType<typeof vi.fn>
  }
}
const mockedPrisma = prisma as MockedPrisma

describe('Stat breakdowns', () => {
  // Mock data fixtures
  const mockAccounts = [
    { id: 'acc1', name: 'Checking', currency: Currency.USD },
  ]

  const mockCategories = [
    { id: 'cat1', name: 'Groceries', type: TransactionType.EXPENSE, isArchived: false },
    { id: 'cat2', name: 'Salary', type: TransactionType.INCOME, isArchived: false },
    { id: 'cat3', name: 'Utilities', type: TransactionType.EXPENSE, isArchived: false },
  ]

  const mockExchangeRates: RateCache = new Map([
    ['USD:EUR', 0.85],
    ['USD:ILS', 3.6],
    ['USD:USD', 1],
    ['EUR:USD', 1.18],
    ['EUR:EUR', 1],
    ['ILS:USD', 0.28],
    ['ILS:ILS', 1],
  ])

  const mockTransactions = [
    {
      id: 'tx1',
      accountId: 'acc1',
      categoryId: 'cat2',
      type: TransactionType.INCOME,
      amount: new Prisma.Decimal(3000),
      currency: Currency.USD,
      date: new Date('2024-01-15'),
      month: new Date('2024-01-01'),
      description: 'January salary',
      recurringTemplateId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      account: mockAccounts[0],
      category: mockCategories[1],
    },
    {
      id: 'tx2',
      accountId: 'acc1',
      categoryId: 'cat1',
      type: TransactionType.EXPENSE,
      amount: new Prisma.Decimal(150),
      currency: Currency.USD,
      date: new Date('2024-01-10'),
      month: new Date('2024-01-01'),
      description: 'Groceries',
      recurringTemplateId: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      account: mockAccounts[0],
      category: mockCategories[0],
    },
  ]

  const mockBudgets = [
    {
      id: 'bud1',
      accountId: 'acc1',
      categoryId: 'cat1',
      month: new Date('2024-01-01'),
      planned: new Prisma.Decimal(500),
      currency: Currency.USD,
      account: mockAccounts[0],
      category: mockCategories[0],
    },
    {
      id: 'bud2',
      accountId: 'acc1',
      categoryId: 'cat3',
      month: new Date('2024-01-01'),
      planned: new Prisma.Decimal(200),
      currency: Currency.USD,
      account: mockAccounts[0],
      category: mockCategories[2],
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mocks
    vi.mocked(mockedPrisma.account.findMany).mockResolvedValue(mockAccounts as unknown as Account[])
    vi.mocked(mockedPrisma.category.findMany).mockResolvedValue(mockCategories as unknown as Category[])
    vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue([])
    vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as unknown as Budget[])
    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
    vi.mocked(mockedPrisma.monthlyIncomeGoal.findFirst).mockResolvedValue(null)
    vi.mocked(currencyLib.batchLoadExchangeRates).mockResolvedValue(mockExchangeRates)
    vi.mocked(currencyLib.getLastUpdateTime).mockResolvedValue(new Date('2024-01-01'))
    vi.mocked(mockedPrisma.sharedExpense.findMany).mockResolvedValue([])
    vi.mocked(mockedPrisma.expenseParticipant.findMany).mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should include breakdown data for Net this month stat', async () => {
    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const netStat = result.stats.find((s) => s.label === 'Net this month')
    expect(netStat).toBeDefined()
    expect(netStat?.breakdown).toBeDefined()
    expect(netStat?.breakdown?.type).toBe('net-this-month')

    if (netStat?.breakdown?.type === 'net-this-month') {
      expect(netStat.breakdown.income).toBe(3000)
      expect(netStat.breakdown.expense).toBe(150)
      expect(netStat.breakdown.net).toBe(2850)
    }
  })

  it('should include breakdown data for On track for stat', async () => {
    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const onTrackStat = result.stats.find((s) => s.label === 'On track for')
    expect(onTrackStat).toBeDefined()
    expect(onTrackStat?.breakdown).toBeDefined()
    expect(onTrackStat?.breakdown?.type).toBe('on-track-for')

    if (onTrackStat?.breakdown?.type === 'on-track-for') {
      expect(onTrackStat.breakdown.actualIncome).toBe(3000)
      expect(onTrackStat.breakdown.actualExpense).toBe(150)
      // With no recurring templates or income goal, falls back to budgets
      expect(onTrackStat.breakdown.incomeSource).toBe('none')
    }
  })

  it('should include breakdown data for Left to spend stat with category details', async () => {
    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const leftToSpendStat = result.stats.find((s) => s.label === 'Left to spend')
    expect(leftToSpendStat).toBeDefined()
    expect(leftToSpendStat?.breakdown).toBeDefined()
    expect(leftToSpendStat?.breakdown?.type).toBe('left-to-spend')

    if (leftToSpendStat?.breakdown?.type === 'left-to-spend') {
      // Total planned expense = 500 (Groceries) + 200 (Utilities) = 700
      expect(leftToSpendStat.breakdown.totalPlanned).toBe(700)
      // Actual expense = 150 (Groceries)
      expect(leftToSpendStat.breakdown.totalActual).toBe(150)
      // Remaining = 700 - 150 = 550
      expect(leftToSpendStat.breakdown.totalRemaining).toBe(550)
      // Should have 2 expense categories
      expect(leftToSpendStat.breakdown.categories).toHaveLength(2)

      const groceriesCat = leftToSpendStat.breakdown.categories.find((c) => c.name === 'Groceries')
      expect(groceriesCat).toBeDefined()
      expect(groceriesCat?.planned).toBe(500)
      expect(groceriesCat?.actual).toBe(150)
      expect(groceriesCat?.remaining).toBe(350)

      const utilitiesCat = leftToSpendStat.breakdown.categories.find((c) => c.name === 'Utilities')
      expect(utilitiesCat).toBeDefined()
      expect(utilitiesCat?.planned).toBe(200)
      expect(utilitiesCat?.actual).toBe(0)
      expect(utilitiesCat?.remaining).toBe(200)
    }
  })

  it('should include breakdown data for Monthly target stat', async () => {
    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const monthlyTargetStat = result.stats.find((s) => s.label === 'Monthly target')
    expect(monthlyTargetStat).toBeDefined()
    expect(monthlyTargetStat?.breakdown).toBeDefined()
    expect(monthlyTargetStat?.breakdown?.type).toBe('monthly-target')

    if (monthlyTargetStat?.breakdown?.type === 'monthly-target') {
      // No income goal or recurring, so falls back to 'none'
      expect(monthlyTargetStat.breakdown.incomeSource).toBe('none')
      expect(monthlyTargetStat.breakdown.plannedExpense).toBe(700)
    }
  })

  it('should set income source to "recurring" when recurring templates exist', async () => {
    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValueOnce([
      {
        id: 'rec1',
        accountId: 'acc1',
        categoryId: 'cat2',
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(5000),
        description: 'Salary',
        dayOfMonth: 1,
        isActive: true,
        startMonth: null,
        endMonth: null,
        deletedAt: null,
        category: mockCategories[1],
        account: mockAccounts[0],
      },
    ] as unknown as (RecurringTemplate & { category: Category; account: Account })[])

    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const monthlyTargetStat = result.stats.find((s) => s.label === 'Monthly target')
    if (monthlyTargetStat?.breakdown?.type === 'monthly-target') {
      expect(monthlyTargetStat.breakdown.incomeSource).toBe('recurring')
      expect(monthlyTargetStat.breakdown.plannedIncome).toBe(5000)
    }

    const onTrackStat = result.stats.find((s) => s.label === 'On track for')
    if (onTrackStat?.breakdown?.type === 'on-track-for') {
      expect(onTrackStat.breakdown.incomeSource).toBe('recurring')
    }
  })

  it('should set income source to "goal" when income goal is set', async () => {
    vi.mocked(mockedPrisma.monthlyIncomeGoal.findFirst).mockResolvedValue({
      id: 'goal1',
      accountId: 'acc1',
      monthKey: null, // default goal
      amount: new Prisma.Decimal(8000),
      currency: Currency.USD,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    const monthlyTargetStat = result.stats.find((s) => s.label === 'Monthly target')
    if (monthlyTargetStat?.breakdown?.type === 'monthly-target') {
      expect(monthlyTargetStat.breakdown.incomeSource).toBe('goal')
      expect(monthlyTargetStat.breakdown.plannedIncome).toBe(8000)
    }

    const onTrackStat = result.stats.find((s) => s.label === 'On track for')
    if (onTrackStat?.breakdown?.type === 'on-track-for') {
      expect(onTrackStat.breakdown.incomeSource).toBe('goal')
    }
  })

  it('should have all four stats with breakdowns', async () => {
    vi.mocked(prisma.transaction.findMany)
      .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const result = await financeLib.getDashboardData({
      monthKey: '2024-01',
      accountId: 'acc1',
    })

    expect(result.stats).toHaveLength(4)

    // All stats should have breakdown defined
    expect(result.stats.every((s) => s.breakdown !== undefined)).toBe(true)

    // Verify breakdown types
    const breakdownTypes = result.stats.map((s) => s.breakdown?.type)
    expect(breakdownTypes).toContain('net-this-month')
    expect(breakdownTypes).toContain('on-track-for')
    expect(breakdownTypes).toContain('left-to-spend')
    expect(breakdownTypes).toContain('monthly-target')
  })
})
