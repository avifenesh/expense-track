import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  upsertRecurringTemplateAction,
  toggleRecurringTemplateAction,
  applyRecurringTemplatesAction,
} from '@/app/actions/recurring'
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
    accountNames: ['TEST_Recurring_Account'],
    defaultAccountName: 'TEST_Recurring_Account',
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

describe('Recurring Template Flow Integration', () => {
  let testAccountId: string
  let testCategoryId: string

  beforeEach(async () => {
    // Setup test data with real database
    const account = await createTestAccount('TEST_Recurring_Account')
    const category = await createTestCategory('TEST_Recurring_Category', TransactionType.EXPENSE)
    testAccountId = account.id
    testCategoryId = category.id
  })

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  it('completes full recurring template lifecycle: create → apply → verify transactions', async () => {
    // 1. Create recurring template (monthly rent)
    const createResult = await upsertRecurringTemplateAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 1200,
      currency: Currency.USD,
      dayOfMonth: 1,
      startMonthKey: '2024-01',
      endMonthKey: null,
      description: 'TEST_Recurring_Rent',
      isActive: true,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createResult).toEqual({ success: true })

    // 2. Verify template created
    const template = await prisma.recurringTemplate.findFirst({
      where: { description: 'TEST_Recurring_Rent' },
    })

    expect(template).toBeDefined()
    expect(template?.accountId).toBe(testAccountId)
    expect(template?.categoryId).toBe(testCategoryId)
    expect(template?.type).toBe(TransactionType.EXPENSE)
    expect(template?.amount.toNumber()).toBe(1200)
    expect(template?.dayOfMonth).toBe(1)
    expect(template?.isActive).toBe(true)

    const templateId = template!.id

    // 3. Apply template for March 2024
    const applyResult = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-03',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyResult).toEqual({ success: true, data: { created: 1 } })

    // 4. Verify transaction created from template
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        description: 'TEST_Recurring_Rent',
        isRecurring: true,
      },
    })

    expect(transactions).toHaveLength(1)
    expect(transactions[0].amount.toNumber()).toBe(1200)
    expect(transactions[0].type).toBe(TransactionType.EXPENSE)
    expect(transactions[0].recurringTemplateId).toBe(templateId)

    // 5. Try to apply again for same month (should not create duplicate)
    const applyAgainResult = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-03',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyAgainResult).toEqual({ success: true, data: { created: 0 } })

    // Verify still only 1 transaction
    const transactionsAfterRetry = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        description: 'TEST_Recurring_Rent',
      },
    })

    expect(transactionsAfterRetry).toHaveLength(1)
  })

  it('handles recurring template with start and end dates', async () => {
    // Create template that runs for 3 months (Jan-Mar 2024)
    const result = await upsertRecurringTemplateAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      dayOfMonth: 15,
      startMonthKey: '2024-01',
      endMonthKey: '2024-03',
      description: 'TEST_Recurring_Limited',
      isActive: true,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const template = await prisma.recurringTemplate.findFirst({
      where: { description: 'TEST_Recurring_Limited' },
    })

    expect(template).toBeDefined()

    const templateId = template!.id

    // Apply for February (within range)
    const applyFeb = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-02',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyFeb).toEqual({ success: true, data: { created: 1 } })

    // Apply for April (outside range)
    const applyApr = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-04',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyApr).toEqual({ success: true, data: { created: 0 } })

    // Only February transaction should exist
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        description: 'TEST_Recurring_Limited',
      },
    })

    expect(transactions).toHaveLength(1)
  })

  it('handles pausing and reactivating recurring template', async () => {
    // Create active template
    const createResult = await upsertRecurringTemplateAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      dayOfMonth: 10,
      startMonthKey: '2024-01',
      endMonthKey: null,
      description: 'TEST_Recurring_Toggle',
      isActive: true,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(createResult).toEqual({ success: true })

    const template = await prisma.recurringTemplate.findFirst({
      where: { description: 'TEST_Recurring_Toggle' },
    })

    expect(template?.isActive).toBe(true)

    const templateId = template!.id

    // Pause template
    const pauseResult = await toggleRecurringTemplateAction({
      id: templateId,
      isActive: false,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(pauseResult).toEqual({ success: true })

    // Verify template is paused
    const pausedTemplate = await prisma.recurringTemplate.findUnique({
      where: { id: templateId },
    })

    expect(pausedTemplate?.isActive).toBe(false)

    // Try to apply paused template
    const applyPausedResult = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-05',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    // Should not create transaction (template is inactive)
    expect(applyPausedResult).toEqual({ success: true, data: { created: 0 } })

    // Reactivate template
    const reactivateResult = await toggleRecurringTemplateAction({
      id: templateId,
      isActive: true,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(reactivateResult).toEqual({ success: true })

    // Apply after reactivation
    const applyActiveResult = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-05',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyActiveResult).toEqual({ success: true, data: { created: 1 } })

    // Verify transaction created
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        description: 'TEST_Recurring_Toggle',
      },
    })

    expect(transactions).toHaveLength(1)
  })

  it('applies multiple templates at once', async () => {
    // Create 3 recurring templates
    const templates = []

    for (let i = 1; i <= 3; i++) {
      await upsertRecurringTemplateAction({
        accountId: testAccountId,
        categoryId: testCategoryId,
        type: TransactionType.EXPENSE,
        amount: i * 100,
        currency: Currency.USD,
        dayOfMonth: i,
        startMonthKey: '2024-01',
        endMonthKey: null,
        description: `TEST_Recurring_Multi_${i}`,
        isActive: true,
        csrfToken: MOCK_CSRF_TOKEN,
      })

      const template = await prisma.recurringTemplate.findFirst({
        where: { description: `TEST_Recurring_Multi_${i}` },
      })

      templates.push(template!)
    }

    // Apply all templates for April 2024
    const applyResult = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-04',
      templateIds: templates.map((t) => t.id),
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyResult).toEqual({ success: true, data: { created: 3 } })

    // Verify all 3 transactions created
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId: testAccountId,
        description: { contains: 'TEST_Recurring_Multi_' },
        month: new Date('2024-04-01'),
      },
    })

    expect(transactions).toHaveLength(3)

    const amounts = transactions.map((t) => t.amount.toNumber()).sort((a, b) => a - b)
    expect(amounts).toEqual([100, 200, 300])
  })

  it('handles day of month > days in month (February edge case)', async () => {
    // Create template for day 31
    const result = await upsertRecurringTemplateAction({
      accountId: testAccountId,
      categoryId: testCategoryId,
      type: TransactionType.EXPENSE,
      amount: 500,
      currency: Currency.USD,
      dayOfMonth: 31,
      startMonthKey: '2024-01',
      endMonthKey: null,
      description: 'TEST_Recurring_Day31',
      isActive: true,
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(result).toEqual({ success: true })

    const template = await prisma.recurringTemplate.findFirst({
      where: { description: 'TEST_Recurring_Day31' },
    })

    const templateId = template!.id

    // Apply for February 2024 (29 days in leap year)
    const applyFeb = await applyRecurringTemplatesAction({
      accountId: testAccountId,
      monthKey: '2024-02',
      templateIds: [templateId],
      csrfToken: MOCK_CSRF_TOKEN,
    })

    expect(applyFeb).toEqual({ success: true, data: { created: 1 } })

    // Verify transaction created for Feb 29
    const transaction = await prisma.transaction.findFirst({
      where: {
        accountId: testAccountId,
        description: 'TEST_Recurring_Day31',
      },
    })

    expect(transaction).toBeDefined()
    expect(transaction!.date.getDate()).toBe(29)
  })
})
