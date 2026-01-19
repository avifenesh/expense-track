import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { TransactionType, Currency, AccountType } from '@prisma/client'
import { buildFinancialContext } from '@/lib/ai/context'
import * as dashboardCache from '@/lib/dashboard-cache'
import type { DashboardData } from '@/lib/finance'

vi.mock('@/lib/dashboard-cache', async () => {
  const actual = await vi.importActual('@/lib/dashboard-cache')
  return {
    ...actual,
    getCachedDashboardData: vi.fn(),
  }
})

const mockGetDashboardData = vi.mocked(dashboardCache.getCachedDashboardData)

describe('buildFinancialContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockDashboardData = (overrides?: Partial<DashboardData>): DashboardData => ({
    month: '2025-01-01T00:00:00.000Z',
    stats: [
      { label: 'Income', amount: 5000 },
      { label: 'Expenses', amount: 3000 },
      { label: 'Net', amount: 2000 },
    ],
    budgets: [
      {
        budgetId: 'b1',
        accountId: 'a1',
        accountName: 'Joint',
        categoryId: 'c1',
        categoryName: 'Rent',
        categoryType: TransactionType.EXPENSE,
        planned: 1200,
        actual: 1200,
        remaining: 0,
        month: '2025-01-01T00:00:00.000Z',
      },
      {
        budgetId: 'b2',
        accountId: 'a1',
        accountName: 'Joint',
        categoryId: 'c2',
        categoryName: 'Groceries',
        categoryType: TransactionType.EXPENSE,
        planned: 500,
        actual: 450,
        remaining: 50,
        month: '2025-01-01T00:00:00.000Z',
      },
    ],
    transactions: [
      {
        id: 't1',
        date: new Date('2025-01-15'),
        accountId: 'a1',
        categoryId: 'c1',
        amount: 1200,
        type: TransactionType.EXPENSE,
        description: 'January rent',
        month: '2025-01-01T00:00:00.000Z',
        originalCurrency: Currency.USD,
        exchangeRate: 1,
        convertedAmount: 1200,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        currency: Currency.USD,
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        account: {
          id: 'a1',
          name: 'Joint',
          type: AccountType.SELF,
          description: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          preferredCurrency: null,
          color: null,
          icon: null,
        },
        category: {
          id: 'c1',
          name: 'Rent',
          type: TransactionType.EXPENSE,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          color: null,
          isHolding: false,
          isArchived: false,
        },
        displayAmount: '1200.00',
      },
      {
        id: 't2',
        date: new Date('2025-01-10'),
        accountId: 'a1',
        categoryId: 'c2',
        amount: 150,
        type: TransactionType.EXPENSE,
        description: 'Whole Foods shopping',
        month: '2025-01-01T00:00:00.000Z',
        originalCurrency: Currency.USD,
        exchangeRate: 1,
        convertedAmount: 150,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        currency: Currency.USD,
        createdAt: new Date('2025-01-10'),
        updatedAt: new Date('2025-01-10'),
        account: {
          id: 'a1',
          name: 'Joint',
          type: AccountType.SELF,
          description: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          preferredCurrency: null,
          color: null,
          icon: null,
        },
        category: {
          id: 'c2',
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          color: null,
          isHolding: false,
          isArchived: false,
        },
        displayAmount: '150.00',
      },
    ] as unknown as DashboardData['transactions'],
    recurringTemplates: [
      {
        id: 'r1',
        categoryId: 'c1',
        categoryName: 'Rent',
        accountId: 'a1',
        accountName: 'Joint',
        amount: 1200,
        type: TransactionType.EXPENSE,
        dayOfMonth: 1,
        isActive: true,
        description: 'Monthly rent',
        startMonthKey: '2025-01-01',
        endMonthKey: null,
      },
    ],
    transactionRequests: [],
    accounts: [
      {
        id: 'a1',
        userId: 'test-user',
        name: 'Joint',
        type: AccountType.SELF,
        description: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        preferredCurrency: null,
        color: null,
        icon: null,
        deletedAt: null,
        deletedBy: null,
        defaultIncomeGoal: null,
        defaultIncomeGoalCurrency: null,
      },
      {
        id: 'a2',
        userId: 'test-user',
        name: 'Secondary',
        type: AccountType.OTHER,
        description: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        preferredCurrency: null,
        color: null,
        icon: null,
        deletedAt: null,
        deletedBy: null,
        defaultIncomeGoal: null,
        defaultIncomeGoalCurrency: null,
      },
    ],
    categories: [
      {
        id: 'c1',
        userId: 'test-user',
        name: 'Rent',
        type: TransactionType.EXPENSE,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
      {
        id: 'c2',
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
      {
        id: 'c3',
        userId: 'test-user',
        name: 'Salary',
        type: TransactionType.INCOME,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
    ],
    holdings: [
      {
        id: 'h1',
        accountId: 'a2',
        accountName: 'Secondary',
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 150,
        currentPrice: 180,
        marketValue: 1800,
        costBasis: 1500,
        gainLoss: 300,
        gainLossPercent: 20,
        notes: null,
        categoryId: 'c_holding',
        categoryName: 'Stocks',
        currency: Currency.USD,
        changePercent: 2.5,
        priceAge: new Date('2025-01-15'),
        isStale: false,
      },
    ],
    comparison: {
      previousMonth: '2024-12-01',
      previousNet: 1800,
      change: 200,
    },
    history: [
      { month: '2024-08-01', income: 5000, expense: 3200, net: 1800 },
      { month: '2024-09-01', income: 5200, expense: 3100, net: 2100 },
      { month: '2024-10-01', income: 5000, expense: 3300, net: 1700 },
      { month: '2024-11-01', income: 5100, expense: 3000, net: 2100 },
      { month: '2024-12-01', income: 5000, expense: 3200, net: 1800 },
      { month: '2025-01-01', income: 5000, expense: 3000, net: 2000 },
    ],
    exchangeRateLastUpdate: new Date('2025-01-15'),
    preferredCurrency: Currency.USD,
    ...overrides,
  })

  it('should build context with USD currency', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(mockGetDashboardData).toHaveBeenCalledWith({
      monthKey: '2025-01-01',
      accountId: 'a1',
      preferredCurrency: Currency.USD,
    })

    expect(context).toContain('Current Month: January 2025')
    expect(context).toContain('Selected Account: Joint')
    expect(context).toContain('Preferred Currency: USD')
    expect(context).toContain('$5000.00')
    expect(context).toContain('$3000.00')
    expect(context).toContain('$2000.00')
  })

  it('should build context with EUR currency', async () => {
    const mockData = createMockDashboardData({ preferredCurrency: Currency.EUR })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.EUR)

    expect(context).toContain('Preferred Currency: EUR')
    expect(context).toContain('€5000.00')
    expect(context).toContain('€3000.00')
  })

  it('should build context with ILS currency', async () => {
    const mockData = createMockDashboardData({ preferredCurrency: Currency.ILS })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.ILS)

    expect(context).toContain('Preferred Currency: ILS')
    expect(context).toContain('₪5000.00')
    expect(context).toContain('₪3000.00')
  })

  it('should handle empty budgets', async () => {
    const mockData = createMockDashboardData({ budgets: [] })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== BUDGETS (Planned vs Actual) ===')
    expect(context).toContain('No budgets set for this month')
  })

  it('should handle empty transactions', async () => {
    const mockData = createMockDashboardData({ transactions: [] })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== RECENT TRANSACTIONS (Last 10) ===')
    expect(context).toContain('No transactions this month')
  })

  it('should handle empty recurring templates', async () => {
    const mockData = createMockDashboardData({ recurringTemplates: [] })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== RECURRING TEMPLATES ===')
    expect(context).toContain('No active recurring templates')
  })

  it('should handle empty holdings', async () => {
    const mockData = createMockDashboardData({ holdings: [] })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== INVESTMENT HOLDINGS ===')
    expect(context).toContain('No holdings')
  })

  it('should format budgets with remaining amounts', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('Rent (EXPENSE): $1200.00 / $1200.00 ($0.00 remaining)')
    expect(context).toContain('Groceries (EXPENSE): $450.00 / $500.00 ($50.00 remaining)')
  })

  it('should limit transactions to last 10', async () => {
    const transactions = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      date: new Date('2025-01-15'),
      accountId: 'a1',
      categoryId: 'c1',
      amount: 100 + i,
      type: TransactionType.EXPENSE,
      description: `Transaction ${i}`,
      month: '2025-01-01T00:00:00.000Z',
      originalCurrency: Currency.USD,
      exchangeRate: 1,
      convertedAmount: 100 + i,
      isRecurring: false,
      isMutual: false,
      recurringTemplateId: null,
      currency: Currency.USD,
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-01-15'),
      account: {
        id: 'a1',
        name: 'Joint',
        type: AccountType.SELF,
        description: null,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        preferredCurrency: null,
        color: null,
        icon: null,
      },
      category: {
        id: 'c1',
        name: 'Test',
        type: TransactionType.EXPENSE,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
        isArchived: false,
      },
      displayAmount: `${100 + i}.00`,
    })) as unknown as DashboardData['transactions']
    const mockData = createMockDashboardData({ transactions })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    const transactionMatches = context.match(/Transaction \d+/g)
    expect(transactionMatches).toHaveLength(10)
  })

  it('should filter only active recurring templates', async () => {
    const recurringTemplates = [
      {
        id: 'r1',
        categoryId: 'c1',
        categoryName: 'Active',
        accountId: 'a1',
        accountName: 'Joint',
        amount: 100,
        type: TransactionType.EXPENSE,
        dayOfMonth: 1,
        isActive: true,
        description: 'Active template',
        startMonthKey: '2025-01-01',
        endMonthKey: null,
      },
      {
        id: 'r2',
        categoryId: 'c2',
        categoryName: 'Inactive',
        accountId: 'a1',
        accountName: 'Joint',
        amount: 200,
        type: TransactionType.EXPENSE,
        dayOfMonth: 15,
        isActive: false,
        description: 'Inactive template',
        startMonthKey: '2025-01-01',
        endMonthKey: null,
      },
    ]
    const mockData = createMockDashboardData({ recurringTemplates })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('Active')
    expect(context).not.toContain('Inactive')
  })

  it('should filter only non-archived categories', async () => {
    const categories = [
      {
        id: 'c1',
        userId: 'test-user',
        name: 'Active Income',
        type: TransactionType.INCOME,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
      {
        id: 'c2',
        userId: 'test-user',
        name: 'Archived Income',
        type: TransactionType.INCOME,
        isArchived: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
      {
        id: 'c3',
        userId: 'test-user',
        name: 'Active Expense',
        type: TransactionType.EXPENSE,
        isArchived: false,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
      {
        id: 'c4',
        userId: 'test-user',
        name: 'Archived Expense',
        type: TransactionType.EXPENSE,
        isArchived: true,
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        color: null,
        isHolding: false,
      },
    ]
    const mockData = createMockDashboardData({ categories })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('Active Income')
    expect(context).toContain('Active Expense')
    expect(context).not.toContain('Archived Income')
    expect(context).not.toContain('Archived Expense')
  })

  it('should include 6-month trend history', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== 6-MONTH TREND ===')
    expect(context).toContain('2024-08-01: Income $5000, Expenses $3200, Net $1800')
    expect(context).toContain('2025-01-01: Income $5000, Expenses $3000, Net $2000')
  })

  it('should include investment holdings with gain/loss', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('=== INVESTMENT HOLDINGS ===')
    expect(context).toContain('AAPL: 10 shares @ $180.00 = $1800.00 (+20.00%)')
  })

  it('should handle holdings with undefined current price', async () => {
    const holdings = [
      {
        id: 'h1',
        accountId: 'a2',
        accountName: 'Secondary',
        symbol: 'UNKNOWN',
        quantity: 5,
        averageCost: 100,
        currentPrice: null,
        marketValue: 500,
        costBasis: 500,
        gainLoss: 0,
        gainLossPercent: 0,
        notes: null,
        categoryId: 'c_holding',
        categoryName: 'Stocks',
        currency: Currency.USD,
        changePercent: null,
        priceAge: null,
        isStale: false,
      },
    ]
    const mockData = createMockDashboardData({ holdings })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('UNKNOWN: 5 shares @ $N/A = $500.00 (+0.00%)')
  })

  it('should handle null/undefined values in dashboard data safely', async () => {
    const mockData = createMockDashboardData({
      stats: null as unknown as DashboardData['stats'],
      budgets: undefined as unknown as DashboardData['budgets'],
      transactions: null as unknown as DashboardData['transactions'],
      history: undefined as unknown as DashboardData['history'],
      holdings: null as unknown as DashboardData['holdings'],
      recurringTemplates: undefined as unknown as DashboardData['recurringTemplates'],
      categories: null as unknown as DashboardData['categories'],
      accounts: undefined as unknown as DashboardData['accounts'],
    })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toBeTruthy()
    expect(context).toContain('No budgets set for this month')
    expect(context).toContain('No transactions this month')
    expect(context).toContain('No holdings')
    expect(context).toContain('No active recurring templates')
  })

  it('should truncate long transaction descriptions to 120 chars', async () => {
    const longDescription = 'A'.repeat(150)
    const transactions = [
      {
        id: 't1',
        date: new Date('2025-01-15'),
        accountId: 'a1',
        categoryId: 'c1',
        amount: 100,
        type: TransactionType.EXPENSE,
        description: longDescription,
        month: '2025-01-01T00:00:00.000Z',
        originalCurrency: Currency.USD,
        exchangeRate: 1,
        convertedAmount: 100,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        currency: Currency.USD,
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
        account: {
          id: 'a1',
          name: 'Joint',
          type: AccountType.SELF,
          description: null,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          preferredCurrency: null,
          color: null,
          icon: null,
        },
        category: {
          id: 'c1',
          name: 'Test',
          type: TransactionType.EXPENSE,
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01'),
          color: null,
          isHolding: false,
          isArchived: false,
        },
        displayAmount: '100.00',
      },
    ] as unknown as DashboardData['transactions']
    const mockData = createMockDashboardData({ transactions })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    const truncatedDesc = longDescription.slice(0, 120)
    expect(context).toContain(truncatedDesc)
    expect(context).not.toContain(longDescription)
  })

  it('should show selected account name in context', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('Selected Account: Joint')
  })

  it('should show "All Accounts" when account not found', async () => {
    const mockData = createMockDashboardData()
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('unknown-id', '2025-01-01', Currency.USD)

    expect(context).toContain('Selected Account: All Accounts')
  })

  it('should handle empty accounts array', async () => {
    const mockData = createMockDashboardData({ accounts: [] })
    mockGetDashboardData.mockResolvedValue(mockData)

    const context = await buildFinancialContext('a1', '2025-01-01', Currency.USD)

    expect(context).toContain('Selected Account: All Accounts')
  })
})
