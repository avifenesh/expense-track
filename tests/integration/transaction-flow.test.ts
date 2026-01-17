import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createTransactionAction, updateTransactionAction, deleteTransactionAction } from '@/app/actions/transactions'
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
    accountNames: ['TEST_Account'],
    defaultAccountName: 'TEST_Account',
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

describe('Transaction Flow Integration', () => {
  let testAccountId: string
  let testCategoryId: string

  beforeEach(async () => {
    // Setup test data with real database
    const account = await createTestAccount('TEST_Account')
    const category = await createTestCategory('TEST_Category', TransactionType.EXPENSE)
    testAccountId = account.id
    testCategoryId = category.id
  })

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  it('completes full transaction lifecycle: create → update → delete', async () => {
    // 1. Create transaction
    const createResult = await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date('2024-01-15'),
      description: 'TEST_Transaction_Original',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(createResult).toEqual({ success: true })

    // 2. Verify created in database
    const created = await prisma.transaction.findFirst({
      where: { description: 'TEST_Transaction_Original' },
    })

    expect(created).toBeDefined()
    expect(created?.accountId).toBe(testAccountId)
    expect(created?.categoryId).toBe(testCategoryId)
    expect(created?.type).toBe(TransactionType.EXPENSE)
    expect(created?.amount.toNumber()).toBe(100)
    expect(created?.currency).toBe(Currency.USD)
    expect(created?.description).toBe('TEST_Transaction_Original')

    const transactionId = created!.id

    // 3. Update transaction
    const updateResult = await updateTransactionAction({
      id: transactionId,
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 150,
      currency: Currency.USD,
      date: new Date('2024-01-15'),
      description: 'TEST_Transaction_Updated',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
    })

    expect(updateResult).toEqual({ success: true })

    // 4. Verify update in database
    const updated = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })

    expect(updated?.amount.toNumber()).toBe(150)
    expect(updated?.description).toBe('TEST_Transaction_Updated')

    // 5. Delete transaction
    const deleteResult = await deleteTransactionAction({
      id: transactionId,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(deleteResult).toEqual({ success: true })

    // 6. Verify soft deletion
    const deleted = await prisma.transaction.findUnique({
      where: { id: transactionId },
    })

    expect(deleted).not.toBeNull()
    expect(deleted?.deletedAt).not.toBeNull()
  })

  it('handles transaction with different types and currencies', async () => {
    // Create income transaction in EUR
    const incomeResult = await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.INCOME,
      amount: 500.5,
      currency: Currency.EUR,
      date: new Date('2024-02-01'),
      description: 'TEST_Income_EUR',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(incomeResult).toEqual({ success: true })

    // Verify income transaction
    const income = await prisma.transaction.findFirst({
      where: { description: 'TEST_Income_EUR' },
    })

    expect(income).toBeDefined()
    expect(income?.type).toBe(TransactionType.INCOME)
    expect(income?.amount.toNumber()).toBe(500.5)
    expect(income?.currency).toBe(Currency.EUR)
  })

  it('handles multiple transactions in sequence', async () => {
    // Create 3 transactions
    const amounts = [100, 200, 300]
    const createdIds: string[] = []

    for (let i = 0; i < amounts.length; i++) {
      const result = await createTransactionAction({
        accountId: testAccountId,
        categoryId: testCategoryId,
        type: TransactionType.EXPENSE,
        amount: amounts[i],
        currency: Currency.USD,
        date: new Date('2024-03-01'),
        description: `TEST_Transaction_${i + 1}`,
        csrfToken: MOCK_CSRF_TOKEN,
        isRecurring: false,
        recurringTemplateId: null,
      })

      expect(result).toEqual({ success: true })

      const created = await prisma.transaction.findFirst({
        where: { description: `TEST_Transaction_${i + 1}` },
      })

      expect(created).toBeDefined()
      createdIds.push(created!.id)
    }

    // Verify all 3 exist
    const allTransactions = await prisma.transaction.findMany({
      where: { id: { in: createdIds } },
    })

    expect(allTransactions).toHaveLength(3)

    // Delete all 3
    for (const id of createdIds) {
      const deleteResult = await deleteTransactionAction({
        id,
        csrfToken: MOCK_CSRF_TOKEN,
      })

      expect(deleteResult).toEqual({ success: true })
    }

    // Verify all soft deleted
    const remaining = await prisma.transaction.findMany({
      where: { id: { in: createdIds } },
    })

    expect(remaining).toHaveLength(3) // Still exist but soft deleted
    for (const tx of remaining) {
      expect(tx.deletedAt).not.toBeNull()
    }
  })

  it('correctly sets month field from date', async () => {
    // Create two transactions in same month to verify month grouping
    const result1 = await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date('2024-04-05'),
      description: 'TEST_Month_Calc_1',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    const result2 = await createTransactionAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date('2024-04-25'),
      description: 'TEST_Month_Calc_2',
      csrfToken: MOCK_CSRF_TOKEN,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result1).toEqual({ success: true })
    expect(result2).toEqual({ success: true })

    const transaction1 = await prisma.transaction.findFirst({
      where: { description: 'TEST_Month_Calc_1' },
    })

    const transaction2 = await prisma.transaction.findFirst({
      where: { description: 'TEST_Month_Calc_2' },
    })

    expect(transaction1).toBeDefined()
    expect(transaction2).toBeDefined()

    // Both transactions from April should have the same month value
    expect(transaction1!.month.getTime()).toBe(transaction2!.month.getTime())
  })
})
