import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { upsertBudgetAction, deleteBudgetAction } from '@/app/actions/budgets'
import { createTransactionAction } from '@/app/actions/transactions'
import { TransactionType, Currency } from '@prisma/client'
import { createTestAccount, createTestCategory, cleanupTestData, MOCK_CSRF_TOKEN } from './helpers'

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock auth to return test user (database-driven)
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
    accountNames: ['TEST_Budget_Account'],
    defaultAccountName: 'TEST_Budget_Account',
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

describe('Budget Flow Integration', () => {
  let testAccountId: string
  let testCategoryId: string

  beforeEach(async () => {
    // Setup test data with real database
    const account = await createTestAccount('TEST_Budget_Account')
    const category = await createTestCategory('TEST_Budget_Category', TransactionType.EXPENSE)
    testAccountId = account.id
    testCategoryId = category.id
  })

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  it('completes full budget lifecycle: create → track spending → update → delete', async () => {
    // 1. Create budget for March 2024
    const createBudgetResult = await upsertBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-03',
      planned: 500,
      currency: Currency.USD,
      notes: 'TEST_Budget_Original',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createBudgetResult).toEqual({ success: true })

    // 2. Verify budget created in database
    const createdBudget = await prisma.budget.findFirst({
      where: { notes: 'TEST_Budget_Original' },
    })

    expect(createdBudget).toBeDefined()
    expect(createdBudget?.accountId).toBe(testAccountId)
    expect(createdBudget?.categoryId).toBe(testCategoryId)
    expect(createdBudget?.planned.toNumber()).toBe(500)
    expect(createdBudget?.currency).toBe(Currency.USD)

    // 3. Add transactions that affect this budget
    await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 150,
      currency: Currency.USD,
      date: new Date('2024-03-10'),
      description: 'TEST_Budget_Transaction_1',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 200,
      currency: Currency.USD,
      date: new Date('2024-03-20'),
      description: 'TEST_Budget_Transaction_2',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    // 4. Verify transactions exist
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        categoryId: testCategoryId,
        description: { contains: 'TEST_Budget_Transaction' },
      },
    })

    expect(transactions).toHaveLength(2)
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount.toNumber(), 0)
    expect(totalSpent).toBe(350)

    // 5. Update budget amount
    const updateBudgetResult = await upsertBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-03',
      planned: 600,
      currency: Currency.USD,
      notes: 'TEST_Budget_Updated',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(updateBudgetResult).toEqual({ success: true })

    // 6. Verify budget updated
    const updatedBudget = await prisma.budget.findUnique({
      where: {
        accountId_categoryId_month: {
          accountId: testAccountId,
          categoryId: testCategoryId,
          month: new Date('2024-03-01'),
        },
      },
    })

    expect(updatedBudget?.planned.toNumber()).toBe(600)
    expect(updatedBudget?.notes).toBe('TEST_Budget_Updated')

    // 7. Delete budget
    const deleteBudgetResult = await deleteBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-03',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(deleteBudgetResult).toEqual({ success: true })

    // 8. Verify budget deleted (transactions should remain)
    const deletedBudget = await prisma.budget.findUnique({
      where: {
        accountId_categoryId_month: {
          accountId: testAccountId,
          categoryId: testCategoryId,
          month: new Date('2024-03-01'),
        },
      },
    })

    // Soft delete - record exists but has deletedAt set
    expect(deletedBudget).not.toBeNull()
    expect(deletedBudget?.deletedAt).not.toBeNull()

    // Transactions should still exist after budget deletion
    const remainingTransactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        categoryId: testCategoryId,
        description: { contains: 'TEST_Budget_Transaction' },
      },
    })

    expect(remainingTransactions).toHaveLength(2)
  })

  it('handles multiple budgets for different months', async () => {
    // Create budgets for January, February, and March
    const months = ['2024-01', '2024-02', '2024-03']
    const amounts = [300, 400, 500]

    for (let i = 0; i < months.length; i++) {
      const result = await upsertBudgetAction({
        accountId: testAccountId,
        categoryId: testCategoryId,
        monthKey: months[i],
        planned: amounts[i],
        currency: Currency.USD,
        notes: `TEST_Budget_${months[i]}`,
        csrfToken: MOCK_CSRF_TOKEN,
      })

      expect(result).toEqual({ success: true })
    }

    // Verify all 3 budgets exist
    const budgets = await prisma.budget.findMany({
      where: {
        accountId: testAccountId,
        categoryId: testCategoryId,
        notes: { contains: 'TEST_Budget_2024-' },
      },
      orderBy: { month: 'asc' },
    })

    expect(budgets).toHaveLength(3)
    expect(budgets[0].planned.toNumber()).toBe(300)
    expect(budgets[1].planned.toNumber()).toBe(400)
    expect(budgets[2].planned.toNumber()).toBe(500)
  })

  it('handles budget with zero transactions', async () => {
    // Create budget without any transactions
    const result = await upsertBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-06',
      planned: 1000,
      currency: Currency.USD,
      notes: 'TEST_Budget_No_Transactions',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const budget = await prisma.budget.findFirst({
      where: { notes: 'TEST_Budget_No_Transactions' },
    })

    expect(budget).toBeDefined()
    expect(budget?.planned.toNumber()).toBe(1000)

    // Verify no transactions for this month
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        categoryId: testCategoryId,
        month: new Date('2024-06-01'),
      },
    })

    expect(transactions).toHaveLength(0)
  })

  it('handles budget upsert (create then update)', async () => {
    // First upsert creates the budget
    const createResult = await upsertBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-05',
      planned: 250,
      currency: Currency.USD,
      notes: 'TEST_Budget_Upsert_Initial',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createResult).toEqual({ success: true })

    // Second upsert updates the budget
    const updateResult = await upsertBudgetAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      monthKey: '2024-05',
      planned: 350,
      currency: Currency.USD,
      notes: 'TEST_Budget_Upsert_Updated',
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(updateResult).toEqual({ success: true })

    // Should only have one budget (updated, not duplicated)
    const budgets = await prisma.budget.findMany({
      where: {
        accountId: testAccountId,
        categoryId: testCategoryId,
        month: new Date('2024-05-01'),
      },
    })

    expect(budgets).toHaveLength(1)
    expect(budgets[0].planned.toNumber()).toBe(350)
    expect(budgets[0].notes).toBe('TEST_Budget_Upsert_Updated')
  })
})
