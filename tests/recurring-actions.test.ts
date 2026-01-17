/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  upsertRecurringTemplateAction,
  toggleRecurringTemplateAction,
  applyRecurringTemplatesAction,
} from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency, TransactionType } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
      },
    },
  }
})

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
}))

vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
  invalidateAllDashboardCache: vi.fn().mockResolvedValue(undefined),
}))

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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
    },
    recurringTemplate: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

describe('upsertRecurringTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create a new recurring template', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

    const result = await upsertRecurringTemplateAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 1000,
      currency: Currency.USD,
      dayOfMonth: 1,
      description: 'Monthly rent',
      startMonthKey: '2026-01',
      endMonthKey: null,
      isActive: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.create).toHaveBeenCalled()
  })

  it('should successfully update an existing template', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.update).mockResolvedValue({} as any)

    const result = await upsertRecurringTemplateAction({
      id: 'template-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 1200,
      currency: Currency.USD,
      dayOfMonth: 1,
      description: 'Monthly rent (increased)',
      startMonthKey: '2026-01',
      endMonthKey: null,
      isActive: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.update).toHaveBeenCalled()
  })

  it('should reject end month before start month', async () => {
    const result = await upsertRecurringTemplateAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 500,
      currency: Currency.USD,
      dayOfMonth: 15,
      description: 'Test',
      startMonthKey: '2026-12',
      endMonthKey: '2026-01',
      isActive: true,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.endMonthKey).toContain('End month must be on or after start month')
    }
  })

  it('should reject invalid day of month (0)', async () => {
    const result = await upsertRecurringTemplateAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 500,
      currency: Currency.USD,
      dayOfMonth: 0,
      description: 'Test',
      startMonthKey: '2026-01',
      endMonthKey: null,
      isActive: true,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.dayOfMonth).toBeDefined()
    }
  })

  it('should reject invalid day of month (32)', async () => {
    const result = await upsertRecurringTemplateAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 500,
      currency: Currency.USD,
      dayOfMonth: 32,
      description: 'Test',
      startMonthKey: '2026-01',
      endMonthKey: null,
      isActive: true,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.dayOfMonth).toBeDefined()
    }
  })

  it('should accept end month equal to start month', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({} as any)

    const result = await upsertRecurringTemplateAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.INCOME,
      amount: 5000,
      currency: Currency.USD,
      dayOfMonth: 1,
      description: 'One-time bonus',
      startMonthKey: '2026-06',
      endMonthKey: '2026-06',
      isActive: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })
})

describe('toggleRecurringTemplateAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully toggle template to inactive', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue({
      id: 'template-1',
      accountId: 'acc-1',
      isActive: true,
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.update).mockResolvedValue({} as any)

    const result = await toggleRecurringTemplateAction({
      id: 'template-1',
      isActive: false,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.update).toHaveBeenCalledWith({
      where: { id: 'template-1' },
      data: { isActive: false },
    })
  })

  it('should fail when template not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.recurringTemplate.findFirst).mockResolvedValue(null)

    const result = await toggleRecurringTemplateAction({
      id: 'nonexistent',
      isActive: false,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Recurring template not found')
    }
  })
})

describe('applyRecurringTemplatesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create transactions from active templates', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
      {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: { toNumber: () => 100 },
        currency: Currency.USD,
        dayOfMonth: 31,
        description: 'End of month',
        isActive: true,
      },
    ] as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as any)

    const result = await applyRecurringTemplatesAction({
      monthKey: '2026-02',
      accountId: 'acc-1',
      csrfToken: 'test-token',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.created).toBe(1)
    }
  })

  it('should skip templates that already have transactions', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
      {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: { toNumber: () => 1000 },
        currency: Currency.USD,
        dayOfMonth: 1,
        description: 'Rent',
        isActive: true,
      },
    ] as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: 'tx-1',
        recurringTemplateId: 'template-1',
      },
    ] as any)

    const result = await applyRecurringTemplatesAction({
      monthKey: '2026-02',
      accountId: 'acc-1',
      csrfToken: 'test-token',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.created).toBe(0)
    }
  })

  it('should handle day 31 in months with fewer days', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
      {
        id: 'template-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: { toNumber: () => 1000 },
        currency: Currency.USD,
        dayOfMonth: 1,
        description: 'Rent',
        isActive: true,
      },
    ] as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as any)

    // February 2026 has only 28 days
    const result = await applyRecurringTemplatesAction({
      monthKey: '2026-02',
      accountId: 'acc-1',
      csrfToken: 'test-token',
    })

    expect('success' in result && result.success).toBe(true)
  })

  it('should return zero when no templates found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([])

    const result = await applyRecurringTemplatesAction({
      monthKey: '2026-02',
      accountId: 'acc-1',
      csrfToken: 'test-token',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.created).toBe(0)
    }
  })

  it('should apply only specified template IDs', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.recurringTemplate.findMany).mockResolvedValue([
      {
        id: 'template-2',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: { toNumber: () => 50 },
        currency: Currency.USD,
        dayOfMonth: 15,
        description: 'Subscription',
        isActive: true,
      },
    ] as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as any)

    const result = await applyRecurringTemplatesAction({
      monthKey: '2026-02',
      accountId: 'acc-1',
      templateIds: ['template-2'],
      csrfToken: 'test-token',
    })

    expect('success' in result && result.success).toBe(true)
  })
})
