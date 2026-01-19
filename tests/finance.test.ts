import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma, TransactionType, Currency } from '@prisma/client'
import type { Account, Category, Transaction, TransactionRequest, Budget, RecurringTemplate } from '@prisma/client'

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

// Type for mocked prisma with holding and income goal support
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
}
const mockedPrisma = prisma as MockedPrisma

describe('finance.ts', () => {
  // Mock data fixtures
  const mockAccounts = [
    { id: 'acc1', name: 'Checking', currency: Currency.USD },
    { id: 'acc2', name: 'Savings', currency: Currency.EUR },
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
    ['EUR:ILS', 4.2],
    ['EUR:EUR', 1],
    ['ILS:USD', 0.28],
    ['ILS:EUR', 0.24],
    ['ILS:ILS', 1],
  ])

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAccounts', () => {
    it('should return accounts sorted by name', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts as unknown as Account[])

      const result = await financeLib.getAccounts()

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      })
      expect(result).toEqual(mockAccounts)
    })

    it('should filter accounts by userId when provided', async () => {
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts as unknown as Account[])

      await financeLib.getAccounts('user-123')

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', deletedAt: null },
        orderBy: { name: 'asc' },
      })
    })
  })

  describe('getCategories', () => {
    it('should return categories sorted by name', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as unknown as Category[])

      const result = await financeLib.getCategories()

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { isArchived: false },
        orderBy: { name: 'asc' },
      })
      expect(result).toEqual(mockCategories)
    })

    it('should filter categories by userId when provided', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as unknown as Category[])

      await financeLib.getCategories('user-123')

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', isArchived: false },
        orderBy: { name: 'asc' },
      })
    })

    it('should include archived categories when requested', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as unknown as Category[])

      await financeLib.getCategories('user-123', true)

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { name: 'asc' },
      })
    })
  })

  describe('getTransactionRequests', () => {
    const mockRequests = [
      {
        id: 'req1',
        fromId: 'acc1',
        toId: 'acc2',
        status: 'PENDING',
        createdAt: new Date('2024-01-15'),
        from: mockAccounts[0],
        category: mockCategories[0],
      },
    ]

    it('should return all requests when no filters provided', async () => {
      vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue(mockRequests as unknown as TransactionRequest[])

      const result = await financeLib.getTransactionRequests()

      expect(prisma.transactionRequest.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          from: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      expect(result).toEqual(mockRequests)
    })

    it('should filter by accountId', async () => {
      vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue(mockRequests as unknown as TransactionRequest[])

      await financeLib.getTransactionRequests({ accountId: 'acc1' })

      expect(prisma.transactionRequest.findMany).toHaveBeenCalledWith({
        where: { toId: 'acc1' },
        include: {
          from: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue(mockRequests as unknown as TransactionRequest[])

      await financeLib.getTransactionRequests({ status: 'APPROVED' })

      expect(prisma.transactionRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'APPROVED' },
        include: {
          from: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })

    it('should filter by both accountId and status', async () => {
      vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue(mockRequests as unknown as TransactionRequest[])

      await financeLib.getTransactionRequests({ accountId: 'acc1', status: 'PENDING' })

      expect(prisma.transactionRequest.findMany).toHaveBeenCalledWith({
        where: { toId: 'acc1', status: 'PENDING' },
        include: {
          from: true,
          category: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    })
  })

  describe('getTransactionsForMonth', () => {
    const mockTransactions = [
      {
        id: 'tx1',
        accountId: 'acc1',
        categoryId: 'cat1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(100.5),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: 'Test transaction',
        account: mockAccounts[0],
        category: mockCategories[0],
      },
      {
        id: 'tx2',
        accountId: 'acc1',
        categoryId: 'cat2',
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(2000),
        currency: Currency.USD,
        date: new Date('2024-01-10'),
        month: new Date('2024-01-01'),
        description: 'Salary',
        account: mockAccounts[0],
        category: mockCategories[1],
      },
    ]

    beforeEach(() => {
      vi.mocked(currencyLib.batchLoadExchangeRates).mockResolvedValue(mockExchangeRates)
      vi.mocked(currencyLib.convertAmountWithCache).mockImplementation((amount, from, to) => {
        if (from === to) return amount
        const rate = mockExchangeRates.get(`${from}:${to}`) ?? 1
        return Math.round(amount * rate * 100) / 100
      })
    })

    it('should return transactions with converted amounts', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as unknown as Transaction[])

      const result = await financeLib.getTransactionsForMonth({
        monthKey: '2024-01',
        preferredCurrency: Currency.USD,
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'tx1',
        amount: 100.5,
        convertedAmount: 100.5,
        displayCurrency: Currency.USD,
        month: '2024-01',
      })
      expect(result[1]).toMatchObject({
        id: 'tx2',
        amount: 2000,
        convertedAmount: 2000,
        displayCurrency: Currency.USD,
        month: '2024-01',
      })
    })

    it('should filter by accountId', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue(mockTransactions as unknown as Transaction[])

      await financeLib.getTransactionsForMonth({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      const callArg = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
      expect(callArg?.where).toMatchObject({
        accountId: 'acc1',
      })
    })

    it('should convert currencies when preferredCurrency differs', async () => {
      const eurTransaction = {
        ...mockTransactions[0],
        currency: Currency.EUR,
        amount: new Prisma.Decimal(100),
      }
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([eurTransaction] as unknown as Transaction[])

      const result = await financeLib.getTransactionsForMonth({
        monthKey: '2024-01',
        preferredCurrency: Currency.USD,
      })

      expect(result[0].convertedAmount).toBe(118) // 100 EUR * 1.18 USD/EUR
      expect(result[0].displayCurrency).toBe(Currency.USD)
    })

    it('should handle empty results', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      const result = await financeLib.getTransactionsForMonth({
        monthKey: '2024-01',
      })

      expect(result).toEqual([])
    })

    it('should use correct date range for month', async () => {
      vi.mocked(prisma.transaction.findMany).mockResolvedValue([])

      await financeLib.getTransactionsForMonth({
        monthKey: '2024-01',
      })

      const callArg = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
      const dateFilter = callArg?.where?.date as { gte?: Date; lt?: Date }
      const gteDate = dateFilter?.gte
      const ltDate = dateFilter?.lt

      // Check that dates are for January 2024 (allowing for timezone offset)
      expect(gteDate?.getFullYear()).toBe(2024)
      expect(gteDate?.getMonth()).toBe(0) // January is 0
      expect(ltDate?.getFullYear()).toBe(2024)
      expect(ltDate?.getMonth()).toBe(1) // February is 1
    })
  })

  describe('getBudgetsForMonth', () => {
    const mockBudgets = [
      {
        id: 'bud1',
        accountId: 'acc1',
        categoryId: 'cat1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal(500),
        currency: Currency.USD,
        category: mockCategories[0],
        account: mockAccounts[0],
      },
      {
        id: 'bud2',
        accountId: 'acc1',
        categoryId: 'cat2',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal(3000),
        currency: Currency.USD,
        category: mockCategories[1],
        account: mockAccounts[0],
      },
    ]

    it('should return budgets for given month and accountId', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as unknown as Budget[])

      const result = await financeLib.getBudgetsForMonth({ monthKey: '2024-01', accountId: 'acc1' })

      const callArg = vi.mocked(prisma.budget.findMany).mock.calls[0]?.[0]
      const monthDate = callArg?.where?.month as Date

      expect(monthDate?.getFullYear()).toBe(2024)
      expect(monthDate?.getMonth()).toBe(0) // January is 0
      expect(callArg?.where?.accountId).toBe('acc1')
      expect(callArg?.include).toEqual({ category: true, account: true })
      expect(result).toEqual(mockBudgets)
    })

    it('should order budgets by category name', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as unknown as Budget[])

      await financeLib.getBudgetsForMonth({ monthKey: '2024-01', accountId: 'acc1' })

      const callArg = vi.mocked(prisma.budget.findMany).mock.calls[0]?.[0]
      expect(callArg?.orderBy).toEqual({ category: { name: 'asc' } })
    })
  })

  describe('getRecurringTemplates', () => {
    const mockTemplates = [
      {
        id: 'rec1',
        accountId: 'acc1',
        categoryId: 'cat1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(50),
        description: 'Subscription',
        dayOfMonth: 15,
        isActive: true,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        account: mockAccounts[0],
        category: mockCategories[0],
      },
    ]

    it('should return formatted recurring templates for accountId', async () => {
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates as unknown as RecurringTemplate[])

      const result = await financeLib.getRecurringTemplates({ accountId: 'acc1' })

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'rec1',
        accountId: 'acc1',
        categoryId: 'cat1',
        type: TransactionType.EXPENSE,
        amount: 50,
        description: 'Subscription',
        dayOfMonth: 15,
        isActive: true,
        accountName: 'Checking',
        categoryName: 'Groceries',
        startMonthKey: '2024-01',
        endMonthKey: null,
      })

      const callArg = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0]?.[0]
      expect(callArg?.where).toEqual({ accountId: 'acc1', deletedAt: null })
    })

    it('should order templates by dayOfMonth', async () => {
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue(mockTemplates as unknown as RecurringTemplate[])

      await financeLib.getRecurringTemplates({ accountId: 'acc1' })

      const callArg = vi.mocked(prisma.recurringTemplate.findMany).mock.calls[0]?.[0]
      expect(callArg?.orderBy).toEqual({ dayOfMonth: 'asc' })
    })

    it('should handle null start and end months', async () => {
      const templateWithNullDates = {
        ...mockTemplates[0],
        startMonth: null,
        endMonth: null,
      }
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
        templateWithNullDates,
      ] as unknown as RecurringTemplate[])

      const result = await financeLib.getRecurringTemplates({ accountId: 'acc1' })

      expect(result[0].startMonthKey).toBeNull()
      expect(result[0].endMonthKey).toBeNull()
    })
  })

  describe('getDashboardData', () => {
    const mockTransactions = [
      {
        id: 'tx1',
        accountId: 'acc1',
        categoryId: 'cat1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(150),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: 'Groceries',
        account: mockAccounts[0],
        category: mockCategories[0],
      },
      {
        id: 'tx2',
        accountId: 'acc1',
        categoryId: 'cat2',
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(3000),
        currency: Currency.USD,
        date: new Date('2024-01-01'),
        month: new Date('2024-01-01'),
        description: 'Salary',
        account: mockAccounts[0],
        category: mockCategories[1],
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
        category: mockCategories[0],
        account: mockAccounts[0],
      },
      {
        id: 'bud2',
        accountId: 'acc1',
        categoryId: 'cat2',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal(3000),
        currency: Currency.USD,
        category: mockCategories[1],
        account: mockAccounts[0],
      },
    ]

    const mockPreviousTransactions = [
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(2500),
        currency: Currency.USD,
        date: new Date('2023-12-01'),
      },
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(200),
        currency: Currency.USD,
        date: new Date('2023-12-15'),
      },
    ]

    const mockHistoryTransactions = [
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(2000),
        currency: Currency.USD,
        date: new Date('2023-08-01'),
        month: new Date('2023-08-01'),
      },
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(300),
        currency: Currency.USD,
        date: new Date('2023-09-15'),
        month: new Date('2023-09-01'),
      },
    ]

    beforeEach(() => {
      vi.mocked(currencyLib.batchLoadExchangeRates).mockResolvedValue(mockExchangeRates)
      // Mock currency conversion with actual rate lookup
      vi.mocked(currencyLib.convertAmountWithCache).mockImplementation((amount, from, to) => {
        if (from === to) return amount
        const rate = mockExchangeRates.get(`${from}:${to}`) ?? 1
        return Math.round(amount * rate * 100) / 100
      })
      vi.mocked(currencyLib.convertAmount).mockImplementation(async (amount) => amount)
      vi.mocked(currencyLib.getLastUpdateTime).mockResolvedValue(new Date('2024-01-15'))

      // Mock all prisma calls
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts as unknown as Account[])
      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories as unknown as Category[])
      vi.mocked(prisma.transactionRequest.findMany).mockResolvedValue([])
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])
      vi.mocked(prisma.budget.findMany).mockResolvedValue(mockBudgets as unknown as Budget[])
      // Monthly income goal - default to null (no goal set)
      vi.mocked(mockedPrisma.monthlyIncomeGoal.findFirst).mockResolvedValue(null)
      // Account default income goal - default to null
      vi.mocked(mockedPrisma.account.findUnique).mockResolvedValue(null)
    })

    it('should calculate stats correctly', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[]) // current month
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[]) // previous month
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[]) // history

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result.stats).toHaveLength(4)

      // Net this month (actual net) = 3000 - 150 = 2850
      expect(result.stats[0]).toMatchObject({
        label: 'Net this month',
        amount: 2850,
        variant: 'positive',
      })

      // On track for (projected net) = 3000 + 0 - (150 + max(500-150, 0)) = 3000 - 500 = 2500
      expect(result.stats[1]).toMatchObject({
        label: 'On track for',
        amount: 2500,
        variant: 'positive',
      })

      // Left to spend (remaining expense) = max(500 - 150, 0) = 350
      expect(result.stats[2]).toMatchObject({
        label: 'Left to spend',
        amount: 350,
      })

      // Monthly target (planned net) = 3000 - 500 = 2500
      // Falls back to income budget since no recurring templates
      expect(result.stats[3]).toMatchObject({
        label: 'Monthly target',
        amount: 2500,
        variant: 'positive',
      })
    })

    it('should use recurring income templates for monthly goal when available', async () => {
      // Mock recurring income template
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValueOnce([
        {
          id: 'rec1',
          accountId: 'acc1',
          categoryId: 'cat2',
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal(5000), // Higher than budgeted 3000
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
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Monthly target should use recurring income (5000) instead of income budget (3000)
      // plannedNet = 5000 - 500 = 4500
      expect(result.stats[3]).toMatchObject({
        label: 'Monthly target',
        amount: 4500,
        variant: 'positive',
      })
    })

    it('should exclude inactive recurring templates from monthly goal', async () => {
      // Mock inactive recurring income template
      vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValueOnce([
        {
          id: 'rec1',
          accountId: 'acc1',
          categoryId: 'cat2',
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal(5000),
          description: 'Salary',
          dayOfMonth: 1,
          isActive: false, // Inactive
          startMonth: null,
          endMonth: null,
          deletedAt: null,
          category: mockCategories[1],
          account: mockAccounts[0],
        },
      ] as unknown as (RecurringTemplate & { category: Category; account: Account })[])

      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Should fall back to income budget (3000) since recurring is inactive
      // plannedNet = 3000 - 500 = 2500
      expect(result.stats[3]).toMatchObject({
        label: 'Monthly target',
        amount: 2500,
        variant: 'positive',
      })
    })

    it('should use monthly income goal when set (priority over recurring)', async () => {
      // Mock month-specific income goal
      vi.mocked(mockedPrisma.monthlyIncomeGoal.findFirst).mockResolvedValueOnce({
        id: 'goal1',
        accountId: 'acc1',
        month: new Date('2024-01-01'),
        amount: new Prisma.Decimal(7000), // Higher than recurring (5000) or budget (3000)
        currency: Currency.USD,
        notes: null,
        deletedAt: null,
      })

      // Also mock recurring income template (should be ignored)
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
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Monthly target should use income goal (7000) instead of recurring (5000)
      // plannedNet = 7000 - 500 = 6500
      expect(result.stats[3]).toMatchObject({
        label: 'Monthly target',
        amount: 6500,
        variant: 'positive',
      })
      // Should also return the monthlyIncomeGoal in the result
      expect(result.monthlyIncomeGoal).toMatchObject({
        amount: 7000,
        currency: 'USD',
        isDefault: false,
      })
    })

    it('should use account default income goal when no month-specific goal', async () => {
      // No month-specific goal
      vi.mocked(mockedPrisma.monthlyIncomeGoal.findFirst).mockResolvedValueOnce(null)

      // Account has default income goal
      vi.mocked(mockedPrisma.account.findUnique).mockResolvedValueOnce({
        id: 'acc1',
        defaultIncomeGoal: new Prisma.Decimal(6000),
        defaultIncomeGoalCurrency: Currency.USD,
      })

      // Also mock recurring income template (should be ignored since account default exists)
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
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Monthly target should use account default (6000) instead of recurring (5000)
      // plannedNet = 6000 - 500 = 5500
      expect(result.stats[3]).toMatchObject({
        label: 'Monthly target',
        amount: 5500,
        variant: 'positive',
      })
      // Should indicate this is the default
      expect(result.monthlyIncomeGoal).toMatchObject({
        amount: 6000,
        currency: 'USD',
        isDefault: true,
      })
    })

    it('should return actualIncome in dashboard data', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // actualIncome should be the sum of income transactions (3000)
      expect(result.actualIncome).toBe(3000)
    })

    it('should calculate budget summaries correctly', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result.budgets).toHaveLength(2)

      // Expense budget (Groceries): planned 500, actual 150, remaining 350
      expect(result.budgets[0]).toMatchObject({
        budgetId: 'bud1',
        categoryName: 'Groceries',
        categoryType: TransactionType.EXPENSE,
        planned: 500,
        actual: 150,
        remaining: 350,
      })

      // Income budget (Salary): planned 3000, actual 3000, remaining 0
      expect(result.budgets[1]).toMatchObject({
        budgetId: 'bud2',
        categoryName: 'Salary',
        categoryType: TransactionType.INCOME,
        planned: 3000,
        actual: 3000,
        remaining: 0,
      })
    })

    it('should convert budget amounts to preferred currency', async () => {
      // Budget in EUR, preferred currency is USD
      const eurBudget = {
        id: 'bud-eur',
        accountId: 'acc1',
        categoryId: 'cat1',
        month: new Date('2024-01-01'),
        planned: new Prisma.Decimal(600), // 600 EUR
        currency: Currency.EUR,
        category: mockCategories[0],
        account: mockAccounts[0],
      }

      vi.mocked(prisma.budget.findMany).mockResolvedValueOnce([eurBudget] as unknown as Budget[])
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([]) // No transactions
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.USD,
      })

      // 600 EUR * 1.18 (EUR:USD rate) = 708 USD
      expect(result.budgets[0].planned).toBe(708)
      // With no actual spending, remaining should equal planned
      expect(result.budgets[0].remaining).toBe(708)
    })

    it('should not convert budget amounts when currency matches preferred', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.USD, // Same as budget currency
      })

      // Budgets are in USD, preferred is USD - no conversion
      expect(result.budgets[0].planned).toBe(500)
      expect(result.budgets[1].planned).toBe(3000)
    })

    it('should calculate comparison correctly', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Previous net = 2500 - 200 = 2300
      expect(result.comparison.previousNet).toBe(2300)
      // Current net = 2850, change = 2850 - 2300 = 550
      expect(result.comparison.change).toBe(550)
      expect(result.comparison.previousMonth).toBe('2023-12')
    })

    it('should seed all 6 months in history', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce([]) // empty history

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result.history).toHaveLength(6)
      expect(result.history[0].month).toBe('2023-08')
      expect(result.history[5].month).toBe('2024-01')

      // All months should have income/expense/net even if zero
      result.history.forEach((point) => {
        expect(point).toHaveProperty('income')
        expect(point).toHaveProperty('expense')
        expect(point).toHaveProperty('net')
      })
    })

    it('should handle zero planned budgets', async () => {
      const budgetsWithZero = [
        {
          ...mockBudgets[0],
          planned: new Prisma.Decimal(0),
        },
      ]
      vi.mocked(prisma.budget.findMany).mockResolvedValue(budgetsWithZero as unknown as Budget[])
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([mockTransactions[0]] as unknown as Transaction[])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Should not cause division by zero
      expect(result.budgets[0].planned).toBe(0)
      expect(result.budgets[0].actual).toBe(150)
      expect(result.budgets[0].remaining).toBe(-150)
    })

    it('should handle no transactions', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result.stats[0].amount).toBe(0) // actual net
      expect(result.transactions).toHaveLength(0)
      expect(result.comparison.previousNet).toBe(0)
      expect(result.comparison.change).toBe(0)
    })

    it('should handle no budgets', async () => {
      vi.mocked(prisma.budget.findMany).mockResolvedValue([])
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      expect(result.budgets).toHaveLength(0)
      expect(result.stats[3].amount).toBe(0) // planned net
    })

    it('should handle negative balances', async () => {
      const negativeTransactions = [
        {
          ...mockTransactions[0],
          amount: new Prisma.Decimal(5000), // large expense
        },
        {
          ...mockTransactions[1],
          amount: new Prisma.Decimal(1000), // small income
        },
      ]
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(negativeTransactions as unknown as Transaction[])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Actual net = 1000 - 5000 = -4000
      expect(result.stats[0].amount).toBe(-4000)
      expect(result.stats[0].variant).toBe('negative')
    })

    it('should filter by accountId', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce(mockTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[])
        .mockResolvedValueOnce(mockHistoryTransactions as unknown as Transaction[])

      await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
      })

      // Check that transaction queries included accountId
      const calls = vi.mocked(prisma.transaction.findMany).mock.calls
      expect(calls[0]?.[0]?.where).toMatchObject({ accountId: 'acc1' })
      expect(calls[1]?.[0]?.where).toMatchObject({ accountId: 'acc1' })
      expect(calls[2]?.[0]?.where).toMatchObject({ accountId: 'acc1' })
    })

    it('should use provided accounts', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        accounts: mockAccounts as unknown as Account[],
      })

      expect(result.accounts).toEqual(mockAccounts)
      // Should not call getAccounts if provided
      expect(prisma.account.findMany).not.toHaveBeenCalled()
    })

    it('should include preferredCurrency in result', async () => {
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.EUR,
      })

      expect(result.preferredCurrency).toBe(Currency.EUR)
    })

    it('should convert previous month amounts when preferredCurrency differs', async () => {
      // Previous month transactions in USD, preferred currency is EUR
      vi.mocked(prisma.transaction.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockPreviousTransactions as unknown as Transaction[]) // Previous month (USD)
        .mockResolvedValueOnce([])

      const result = await financeLib.getDashboardData({
        monthKey: '2024-01',
        accountId: 'acc1',
        preferredCurrency: Currency.EUR,
      })

      // Previous transactions are converted from USD to EUR using rate 0.85
      // 2500 USD * 0.85 = 2125 EUR (income)
      // 200 USD * 0.85 = 170 EUR (expense)
      // Previous net = 2125 - 170 = 1955 EUR
      expect(result.comparison.previousNet).toBe(1955)
    })
  })

  describe('getHoldingsWithPrices', () => {
    const mockHoldings = [
      {
        id: 'hold1',
        accountId: 'acc1',
        categoryId: 'cat1',
        symbol: 'AAPL',
        quantity: new Prisma.Decimal(10),
        averageCost: new Prisma.Decimal(150),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        account: mockAccounts[0],
        category: mockCategories[0],
      },
      {
        id: 'hold2',
        accountId: 'acc1',
        categoryId: 'cat1',
        symbol: 'googl', // lowercase to test normalization
        quantity: new Prisma.Decimal(5),
        averageCost: new Prisma.Decimal(2000),
        currency: Currency.USD,
        notes: 'Tech stock',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        account: mockAccounts[0],
        category: mockCategories[0],
      },
    ]

    const mockStockPrices = new Map([
      [
        'AAPL',
        {
          price: 175,
          changePercent: 16.67,
          fetchedAt: new Date('2024-01-15'),
          hoursSinceUpdate: 0.1,
          isStale: false,
        },
      ],
      [
        'GOOGL',
        {
          price: 2800,
          changePercent: 40,
          fetchedAt: new Date('2024-01-10'),
          hoursSinceUpdate: 24,
          isStale: true, // older than 15 min
        },
      ],
    ])

    beforeEach(() => {
      vi.mocked(currencyLib.batchLoadExchangeRates).mockResolvedValue(mockExchangeRates)
      vi.mocked(currencyLib.convertAmountWithCache).mockImplementation((amount, from, to) => {
        if (from === to) return amount
        const rate = mockExchangeRates.get(`${from}:${to}`) ?? 1
        return Math.round(amount * rate * 100) / 100
      })

      // Mock dynamic import
      vi.doMock('@/lib/stock-api', () => ({
        batchLoadStockPrices: vi.fn().mockResolvedValue(mockStockPrices),
      }))
    })

    it('should calculate holdings with prices correctly', async () => {
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue(mockHoldings)

      const result = await financeLib.getHoldingsWithPrices({})

      expect(result).toHaveLength(2)

      // AAPL: cost basis = 10 * 150 = 1500, market value = 10 * 175 = 1750
      expect(result[0]).toMatchObject({
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 150,
        currentPrice: 175,
        costBasis: 1500,
        marketValue: 1750,
        gainLoss: 250,
        isStale: false,
      })
      expect(result[0].gainLossPercent).toBeCloseTo(16.67, 1) // (250 / 1500) * 100 = 16.67

      // GOOGL: cost basis = 5 * 2000 = 10000, market value = 5 * 2800 = 14000
      expect(result[1]).toMatchObject({
        symbol: 'googl',
        quantity: 5,
        averageCost: 2000,
        currentPrice: 2800,
        costBasis: 10000,
        marketValue: 14000,
        gainLoss: 4000,
        gainLossPercent: 40,
        isStale: true,
      })
    })

    it('should handle missing prices', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      vi.mocked(batchLoadStockPrices).mockResolvedValue(new Map())

      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([mockHoldings[0]])

      const result = await financeLib.getHoldingsWithPrices({})

      expect(result[0].currentPrice).toBeNull()
      expect(result[0].changePercent).toBeNull()
      expect(result[0].priceAge).toBeNull()
      // Market value should fall back to cost basis
      expect(result[0].marketValue).toBe(1500)
      expect(result[0].gainLoss).toBe(0)
    })

    it('should handle zero cost basis safely', async () => {
      const holdingWithZeroCost = {
        ...mockHoldings[0],
        averageCost: new Prisma.Decimal(0),
      }
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([holdingWithZeroCost])

      const result = await financeLib.getHoldingsWithPrices({})

      expect(result[0].costBasis).toBe(0)
      expect(result[0].gainLossPercent).toBe(0) // Should not divide by zero
    })

    it('should convert currencies correctly', async () => {
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([mockHoldings[0]])

      const result = await financeLib.getHoldingsWithPrices({
        preferredCurrency: Currency.EUR,
      })

      // Should call convertAmountWithCache for all values
      expect(result[0].currentPriceConverted).toBe(148.75) // 175 * 0.85
      expect(result[0].marketValueConverted).toBe(1487.5) // 1750 * 0.85
      expect(result[0].costBasisConverted).toBe(1275) // 1500 * 0.85
      expect(result[0].gainLossConverted).toBe(212.5) // 1487.5 - 1275
    })

    it('should not convert when currencies match', async () => {
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([mockHoldings[0]])

      const result = await financeLib.getHoldingsWithPrices({
        preferredCurrency: Currency.USD,
      })

      // When currencies match, converted values are initialized but not converted
      expect(result[0].currentPriceConverted).toBeNull()
      expect(result[0].marketValueConverted).toBe(1750) // Same as marketValue
      expect(result[0].costBasisConverted).toBe(1500) // Same as costBasis
      expect(result[0].gainLossConverted).toBe(250) // Same as gainLoss
    })

    it('should filter by accountId', async () => {
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([])

      await financeLib.getHoldingsWithPrices({ accountId: 'acc1' })

      const callArg = vi.mocked(mockedPrisma.holding.findMany).mock.calls[0]?.[0]
      expect(callArg?.where).toMatchObject({
        accountId: 'acc1',
      })
    })

    it('should normalize symbols to uppercase for price lookup', async () => {
      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([mockHoldings[1]])

      const result = await financeLib.getHoldingsWithPrices({})

      // Symbol stored as lowercase but should find price with uppercase key
      expect(result[0].symbol).toBe('googl')
      expect(result[0].currentPrice).toBe(2800)
    })

    it('should handle negative gains (losses)', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const pricesWithLoss = new Map([
        [
          'AAPL',
          {
            price: 100, // Lower than average cost of 150
            changePercent: -33.33,
            fetchedAt: new Date('2024-01-15'),
            hoursSinceUpdate: 0.1,
            isStale: false,
          },
        ],
      ])
      vi.mocked(batchLoadStockPrices).mockResolvedValue(pricesWithLoss)

      vi.mocked(mockedPrisma.holding.findMany).mockResolvedValue([mockHoldings[0]])

      const result = await financeLib.getHoldingsWithPrices({})

      // Cost basis = 1500, market value = 1000, loss = -500
      expect(result[0].gainLoss).toBe(-500)
      expect(result[0].gainLossPercent).toBeCloseTo(-33.33, 1)
    })
  })

  describe('decimal precision edge cases', () => {
    it('should handle 0.1 + 0.2 floating point precision correctly', () => {
      // Classic floating point precision issue: 0.1 + 0.2 !== 0.3
      // JavaScript: 0.1 + 0.2 = 0.30000000000000004
      const a = 0.1
      const b = 0.2
      const expected = 0.3

      // Direct comparison fails due to floating point
      expect(a + b).not.toBe(expected)

      // toBeCloseTo handles the precision correctly
      expect(a + b).toBeCloseTo(expected, 10)

      // Verify the actual floating point result
      expect(a + b).toBe(0.30000000000000004)
    })

    it('should handle currency calculations with precision', () => {
      // $19.99 * 3 should equal $59.97
      const unitPrice = 19.99
      const quantity = 3
      const expected = 59.97

      const result = unitPrice * quantity

      // Due to floating point: 19.99 * 3 = 59.97000000000001
      expect(result).toBeCloseTo(expected, 2)

      // Round to 2 decimal places for currency
      const roundedResult = Math.round(result * 100) / 100
      expect(roundedResult).toBe(expected)
    })

    it('should handle expense split rounding (100/3)', () => {
      const total = 100
      const numPeople = 3

      const share = total / numPeople
      const rounded = Math.round(share * 100) / 100

      // Each person pays $33.33
      expect(rounded).toBe(33.33)

      // Sum of 3 rounded shares doesn't equal 100
      const totalFromShares = rounded * numPeople
      expect(totalFromShares).toBeCloseTo(99.99, 2)

      // There's a penny discrepancy
      const discrepancy = total - totalFromShares
      expect(discrepancy).toBeCloseTo(0.01, 2)
    })

    it('should handle large decimal sums correctly', () => {
      // Sum of many small values
      const values = Array(100).fill(0.01)
      const sum = values.reduce((acc, val) => acc + val, 0)

      // Due to floating point accumulation, sum may not be exactly 1.00
      expect(sum).toBeCloseTo(1.0, 10)
    })
  })
})
