/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  completeOnboardingAction,
  skipOnboardingAction,
  updatePreferredCurrencyAction,
  createInitialCategoriesAction,
  createQuickBudgetAction,
  seedSampleDataAction,
} from '@/app/actions/onboarding'
import { prisma } from '@/lib/prisma'
import { Currency, TransactionType } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({ userEmail: 'test@example.com', accountId: 'acc-1' }),
  getDbUserAsAuthUser: vi.fn().mockResolvedValue({
    id: 'test-user',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed',
    accountNames: ['TestAccount'],
    defaultAccountName: 'TestAccount',
    preferredCurrency: 'USD',
    hasCompletedOnboarding: false,
    activeAccountId: null,
  }),
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

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
    category: {
      upsert: vi.fn(),
    },
    budget: {
      upsert: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

describe('completeOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully mark onboarding as complete', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      passwordHash: 'hashed',
      preferredCurrency: 'USD',
      emailVerified: true,
      hasCompletedOnboarding: true,
    activeAccountId: null,
    } as any)

    const result = await completeOnboardingAction({ csrfToken: 'valid-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user' },
      data: { hasCompletedOnboarding: true },
    })
  })

  it('should reject missing CSRF token', async () => {
    const result = await completeOnboardingAction({ csrfToken: '' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.csrfToken).toBeDefined()
    }
  })

  it('should handle database error', async () => {
    vi.mocked(prisma.user.update).mockRejectedValue(new Error('DB Error'))

    const result = await completeOnboardingAction({ csrfToken: 'valid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Unable to complete onboarding')
    }
  })
})

describe('skipOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully skip onboarding', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'test-user',
      hasCompletedOnboarding: true,
    activeAccountId: null,
    } as any)

    const result = await skipOnboardingAction({ csrfToken: 'valid-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user' },
      data: { hasCompletedOnboarding: true },
    })
  })

  it('should reject missing CSRF token', async () => {
    const result = await skipOnboardingAction({ csrfToken: '' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.csrfToken).toBeDefined()
    }
  })
})

describe('updatePreferredCurrencyAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully update currency to EUR', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'test-user',
      preferredCurrency: 'EUR',
    } as any)

    const result = await updatePreferredCurrencyAction({
      currency: Currency.EUR,
      csrfToken: 'valid-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user' },
      data: { preferredCurrency: 'EUR' },
    })
  })

  it('should successfully update currency to ILS', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: 'test-user',
      preferredCurrency: 'ILS',
    } as any)

    const result = await updatePreferredCurrencyAction({
      currency: Currency.ILS,
      csrfToken: 'valid-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user' },
      data: { preferredCurrency: 'ILS' },
    })
  })

  it('should reject invalid currency', async () => {
    const result = await updatePreferredCurrencyAction({
      currency: 'INVALID' as Currency,
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.currency).toBeDefined()
    }
  })

  it('should reject missing CSRF token', async () => {
    const result = await updatePreferredCurrencyAction({
      currency: Currency.USD,
      csrfToken: '',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.csrfToken).toBeDefined()
    }
  })
})

describe('createInitialCategoriesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create categories', async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([
      { id: 'cat-1', name: 'Groceries', type: 'EXPENSE' },
      { id: 'cat-2', name: 'Salary', type: 'INCOME' },
    ])

    const result = await createInitialCategoriesAction({
      categories: [
        { name: 'Groceries', type: TransactionType.EXPENSE, color: '#22c55e' },
        { name: 'Salary', type: TransactionType.INCOME, color: '#10b981' },
      ],
      csrfToken: 'valid-token',
    })

    expect(result).toEqual({
      success: true,
      data: {
        categoriesCreated: 2,
        categories: [
          { id: 'cat-1', name: 'Groceries', type: 'EXPENSE' },
          { id: 'cat-2', name: 'Salary', type: 'INCOME' },
        ],
      },
    })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('should reject empty categories array', async () => {
    const result = await createInitialCategoriesAction({
      categories: [],
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.categories).toBeDefined()
    }
  })

  it('should reject category with short name', async () => {
    const result = await createInitialCategoriesAction({
      categories: [{ name: 'A', type: TransactionType.EXPENSE }],
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
  })

  it('should handle database error', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('DB Error'))

    const result = await createInitialCategoriesAction({
      categories: [{ name: 'Groceries', type: TransactionType.EXPENSE }],
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Unable to create categories')
    }
  })
})

describe('createQuickBudgetAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create a budget', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
      name: 'TestAccount',
    } as any)

    vi.mocked(prisma.category.upsert).mockResolvedValue({
      id: 'cat-1',
      userId: 'test-user',
      name: 'Groceries',
      type: 'EXPENSE',
    } as any)

    // Mock category.findFirst
    const mockCategoryFindFirst = vi.fn().mockResolvedValue({
      id: 'cat-1',
      userId: 'test-user',
      name: 'Groceries',
      type: 'EXPENSE',
    })
    ;(prisma.category as any).findFirst = mockCategoryFindFirst

    vi.mocked(prisma.budget.upsert).mockResolvedValue({
      id: 'budget-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      planned: 500,
    } as any)

    const result = await createQuickBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2024-01',
      planned: 500,
      currency: Currency.USD,
      csrfToken: 'valid-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.budget.upsert).toHaveBeenCalled()
  })

  it('should reject account not belonging to user', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

    const result = await createQuickBudgetAction({
      accountId: 'wrong-acc',
      categoryId: 'cat-1',
      monthKey: '2024-01',
      planned: 500,
      currency: Currency.USD,
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Account not found or access denied')
    }
  })

  it('should reject invalid month key', async () => {
    const result = await createQuickBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '202',
      planned: 500,
      currency: Currency.USD,
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.monthKey).toBeDefined()
    }
  })

  it('should reject negative budget amount', async () => {
    const result = await createQuickBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2024-01',
      planned: -100,
      currency: Currency.USD,
      csrfToken: 'valid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.planned).toBeDefined()
    }
  })
})

describe('seedSampleDataAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully seed sample data', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
      name: 'TestAccount',
    } as any)

    vi.mocked(prisma.category.upsert).mockImplementation(
      (args: any) =>
        Promise.resolve({
          id: `cat-${args.create.name}`,
          name: args.create.name,
          type: args.create.type,
          userId: args.create.userId,
        }) as any,
    )

    vi.mocked(prisma.transaction.create).mockResolvedValue({
      id: 'txn-1',
    } as any)

    vi.mocked(prisma.budget.upsert).mockResolvedValue({
      id: 'budget-1',
    } as any)

    const result = await seedSampleDataAction({ csrfToken: 'valid-token' })

    expect(result).toEqual({
      success: true,
      data: {
        categoriesCreated: 14,
        transactionsCreated: 2,
        budgetsCreated: 1,
      },
    })
  })

  it('should reject if user has no accounts', async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

    const result = await seedSampleDataAction({ csrfToken: 'valid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.[0]).toMatch(/No account found/)
    }
  })

  it('should reject missing CSRF token', async () => {
    const result = await seedSampleDataAction({ csrfToken: '' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.csrfToken).toBeDefined()
    }
  })
})

describe('CSRF token validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject invalid CSRF token for completeOnboarding', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf')
    vi.mocked(validateCsrfToken).mockResolvedValueOnce(false)

    const result = await completeOnboardingAction({ csrfToken: 'invalid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toBeDefined()
    }
  })

  it('should reject invalid CSRF token for updatePreferredCurrency', async () => {
    const { validateCsrfToken } = await import('@/lib/csrf')
    vi.mocked(validateCsrfToken).mockResolvedValueOnce(false)

    const result = await updatePreferredCurrencyAction({
      currency: Currency.USD,
      csrfToken: 'invalid-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toBeDefined()
    }
  })
})

describe('Session validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValueOnce(new Error('No session'))

    const result = await completeOnboardingAction({ csrfToken: 'valid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.[0]).toMatch(/session expired/i)
    }
  })

  it('should reject when user not found', async () => {
    const { getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(getDbUserAsAuthUser).mockResolvedValueOnce(undefined)

    const result = await completeOnboardingAction({ csrfToken: 'valid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('User record not found')
    }
  })
})

describe('Subscription validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject when subscription is inactive', async () => {
    const { hasActiveSubscription } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValueOnce(false)

    const result = await completeOnboardingAction({ csrfToken: 'valid-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.subscription).toBeDefined()
    }
  })
})
