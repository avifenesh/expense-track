import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTransactionAction } from '@/app/actions/transactions'
import { TransactionType, Currency } from '@prisma/client'
import { createTestAccount, createTestCategory, cleanupTestData, MOCK_CSRF_TOKEN } from './helpers'

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock auth to return user with access to both accounts (database-driven)
vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({
    userEmail: 'test@example.com',
    accountId: 'test-account-id',
  }),
  getDbUserAsAuthUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hash',
    accountNames: ['TEST_Account_A', 'TEST_Account_B'],
    defaultAccountName: 'TEST_Account_A',
    preferredCurrency: 'USD',
  }),
}))

// Mock subscription to allow access
vi.mock('@/lib/subscription', () => ({
  hasActiveSubscription: vi.fn().mockResolvedValue(true),
  getSubscriptionState: vi.fn().mockResolvedValue({
    status: 'ACTIVE',
    isActive: true,
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    daysRemaining: 30,
    canAccessApp: true,
  }),
}))

describe('Account Switching Flow Integration', () => {
  let accountAId: string
  let accountBId: string
  let categoryId: string

  beforeEach(async () => {
    // Setup two test accounts
    const accountA = await createTestAccount('TEST_Account_A')
    const accountB = await createTestAccount('TEST_Account_B')
    const category = await createTestCategory('TEST_Switching_Category', TransactionType.EXPENSE)

    accountAId = accountA.id
    accountBId = accountB.id
    categoryId = category.id
  })

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  it('isolates transactions by account correctly', async () => {
    // Create transactions for Account A
    await createTransactionAction({
      accountId: accountAId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date('2024-05-01'),
      description: 'TEST_Account_A_Trans_1',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    await createTransactionAction({
      accountId: accountAId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 150,
      currency: Currency.USD,
      date: new Date('2024-05-05'),
      description: 'TEST_Account_A_Trans_2',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    // Create transactions for Account B
    await createTransactionAction({
      accountId: accountBId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 200,
      currency: Currency.USD,
      date: new Date('2024-05-02'),
      description: 'TEST_Account_B_Trans_1',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    await createTransactionAction({
      accountId: accountBId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 250,
      currency: Currency.USD,
      date: new Date('2024-05-06'),
      description: 'TEST_Account_B_Trans_2',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    // Query Account A transactions only
    const accountATransactions = await prisma.transaction.findMany({
      where: {
        accountId: accountAId,
        description: { contains: 'TEST_Account_' },
      },
      orderBy: { date: 'asc' },
    })

    expect(accountATransactions).toHaveLength(2)
    expect(accountATransactions.map((t) => t.amount.toNumber())).toEqual([100, 150])
    expect(accountATransactions.every((t) => t.accountId === accountAId)).toBe(true)

    // Query Account B transactions only
    const accountBTransactions = await prisma.transaction.findMany({
      where: {
        accountId: accountBId,
        description: { contains: 'TEST_Account_' },
      },
      orderBy: { date: 'asc' },
    })

    expect(accountBTransactions).toHaveLength(2)
    expect(accountBTransactions.map((t) => t.amount.toNumber())).toEqual([200, 250])
    expect(accountBTransactions.every((t) => t.accountId === accountBId)).toBe(true)

    // Query all transactions across both accounts
    const allTransactions = await prisma.transaction.findMany({
      where: {
        accountId: { in: [accountAId, accountBId] },
        description: { contains: 'TEST_Account_' },
      },
      orderBy: { date: 'asc' },
    })

    expect(allTransactions).toHaveLength(4)
    expect(allTransactions.map((t) => t.amount.toNumber())).toEqual([100, 200, 150, 250])
  })

  it('calculates totals per account correctly', async () => {
    // Create income and expenses for Account A
    await createTransactionAction({
      accountId: accountAId,
      categoryId,
      type: TransactionType.INCOME,
      amount: 5000,
      currency: Currency.USD,
      date: new Date('2024-06-01'),
      description: 'TEST_Totals_A_Income',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    await createTransactionAction({
      accountId: accountAId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 1500,
      currency: Currency.USD,
      date: new Date('2024-06-02'),
      description: 'TEST_Totals_A_Expense',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    // Create income and expenses for Account B
    await createTransactionAction({
      accountId: accountBId,
      categoryId,
      type: TransactionType.INCOME,
      amount: 3000,
      currency: Currency.USD,
      date: new Date('2024-06-01'),
      description: 'TEST_Totals_B_Income',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    await createTransactionAction({
      accountId: accountBId,
      categoryId,
      type: TransactionType.EXPENSE,
      amount: 800,
      currency: Currency.USD,
      date: new Date('2024-06-02'),
      description: 'TEST_Totals_B_Expense',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    // Calculate totals for Account A
    const accountATransactions = await prisma.transaction.findMany({
      where: {
        accountId: accountAId,
        description: { contains: 'TEST_Totals_A' },
      },
    })

    const accountAIncome = accountATransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0)

    const accountAExpenses = accountATransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0)

    expect(accountAIncome).toBe(5000)
    expect(accountAExpenses).toBe(1500)
    expect(accountAIncome - accountAExpenses).toBe(3500)

    // Calculate totals for Account B
    const accountBTransactions = await prisma.transaction.findMany({
      where: {
        accountId: accountBId,
        description: { contains: 'TEST_Totals_B' },
      },
    })

    const accountBIncome = accountBTransactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0)

    const accountBExpenses = accountBTransactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount.toNumber(), 0)

    expect(accountBIncome).toBe(3000)
    expect(accountBExpenses).toBe(800)
    expect(accountBIncome - accountBExpenses).toBe(2200)
  })

  it('filters budgets by account correctly', async () => {
    // Create budget for Account A
    await prisma.budget.create({
      data: {
        accountId: accountAId,
        categoryId,
        month: new Date('2024-07-01'),
        planned: 500,
        currency: Currency.USD,
        notes: 'TEST_Budget_A',
      },
    })

    // Create budget for Account B
    await prisma.budget.create({
      data: {
        accountId: accountBId,
        categoryId,
        month: new Date('2024-07-01'),
        planned: 750,
        currency: Currency.USD,
        notes: 'TEST_Budget_B',
      },
    })

    // Query Account A budgets
    const accountABudgets = await prisma.budget.findMany({
      where: {
        accountId: accountAId,
        notes: { contains: 'TEST_Budget_' },
      },
    })

    expect(accountABudgets).toHaveLength(1)
    expect(accountABudgets[0].planned.toNumber()).toBe(500)

    // Query Account B budgets
    const accountBBudgets = await prisma.budget.findMany({
      where: {
        accountId: accountBId,
        notes: { contains: 'TEST_Budget_' },
      },
    })

    expect(accountBBudgets).toHaveLength(1)
    expect(accountBBudgets[0].planned.toNumber()).toBe(750)

    // Verify no cross-contamination
    expect(accountABudgets[0].id).not.toBe(accountBBudgets[0].id)
  })

  it('filters recurring templates by account correctly', async () => {
    // Create recurring template for Account A
    await prisma.recurringTemplate.create({
      data: {
        accountId: accountAId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        dayOfMonth: 1,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        description: 'TEST_Recurring_A',
        isActive: true,
      },
    })

    // Create recurring template for Account B
    await prisma.recurringTemplate.create({
      data: {
        accountId: accountBId,
        categoryId,
        type: TransactionType.EXPENSE,
        amount: 200,
        currency: Currency.USD,
        dayOfMonth: 15,
        startMonth: new Date('2024-01-01'),
        endMonth: null,
        description: 'TEST_Recurring_B',
        isActive: true,
      },
    })

    // Query Account A recurring templates
    const accountATemplates = await prisma.recurringTemplate.findMany({
      where: {
        accountId: accountAId,
        description: { contains: 'TEST_Recurring_' },
      },
    })

    expect(accountATemplates).toHaveLength(1)
    expect(accountATemplates[0].amount.toNumber()).toBe(100)

    // Query Account B recurring templates
    const accountBTemplates = await prisma.recurringTemplate.findMany({
      where: {
        accountId: accountBId,
        description: { contains: 'TEST_Recurring_' },
      },
    })

    expect(accountBTemplates).toHaveLength(1)
    expect(accountBTemplates[0].amount.toNumber()).toBe(200)
  })
})
