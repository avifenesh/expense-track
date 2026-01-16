/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { upsertBudgetAction, deleteBudgetAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

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

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
    },
    budget: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('upsertBudgetAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await upsertBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      planned: 1000,
      csrfToken: 'test-token',
      currency: Currency.USD,
      notes: 'Test budget',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Your session expired'))).toBe(true)
    }
  })

  it('should fail when user does not have access to account', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'avi',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'other-user',
    } as any)

    const result = await upsertBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      planned: 1000,
      csrfToken: 'test-token',
      currency: Currency.USD,
      notes: 'Test budget',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId).toContain('You do not have access to this account')
    }
  })

  it('should successfully create a new budget', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'avi',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'avi',
    } as any)

    vi.mocked(prisma.budget.upsert).mockResolvedValue({} as any)

    const result = await upsertBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      planned: 1000,
      csrfToken: 'test-token',
      currency: Currency.USD,
      notes: 'Test budget',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.budget.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId_categoryId_month: {
            accountId: 'acc-1',
            categoryId: 'cat-1',
            month: expect.any(Date),
          },
        }),
      }),
    )
  })

  it('should reject negative planned amount', async () => {
    const result = await upsertBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      planned: -100,
      csrfToken: 'test-token',
      currency: Currency.USD,
      notes: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.planned).toBeDefined()
    }
  })

  it('should handle budget update', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'avi',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'avi',
    } as any)

    vi.mocked(prisma.budget.upsert).mockResolvedValue({} as any)

    const result = await upsertBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      planned: 2000,
      csrfToken: 'test-token',
      currency: Currency.EUR,
      notes: 'Updated budget',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.budget.upsert).toHaveBeenCalled()
  })
})

describe('deleteBudgetAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await deleteBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Your session expired'))).toBe(true)
    }
  })

  it('should successfully delete a budget', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'avi',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'avi',
    } as any)

    vi.mocked(prisma.budget.delete).mockResolvedValue({} as any)

    const result = await deleteBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.budget.delete).toHaveBeenCalledWith({
      where: {
        accountId_categoryId_month: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          month: expect.any(Date),
        },
      },
    })
  })

  it('should handle database error gracefully', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'avi',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'avi',
    } as any)

    vi.mocked(prisma.budget.delete).mockRejectedValue(new Error('Not found'))

    const result = await deleteBudgetAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      monthKey: '2026-01',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Unable to delete budget'))).toBe(true)
    }
  })
})
