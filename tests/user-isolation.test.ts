/* eslint-disable @typescript-eslint/no-explicit-any -- Mock returns require any casts */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { approveTransactionRequestAction, rejectTransactionRequestAction, createHoldingAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

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
    RequestStatus: {
      PENDING: 'PENDING',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
    },
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
    AccountType: {
      SELF: 'SELF',
      PARTNER: 'PARTNER',
      OTHER: 'OTHER',
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

vi.mock('@/lib/stock-api', () => ({
  fetchStockQuote: vi.fn().mockResolvedValue({ price: 100, currency: 'USD' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((calls) => Promise.all(calls)),
    account: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    transactionRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    holding: {
      create: vi.fn(),
    },
  },
}))

describe('User Isolation: Transaction Requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('approveTransactionRequestAction', () => {
    it('should reject when user tries to approve request for account they do not own', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

      // User A (attacker) is logged in
      vi.mocked(requireSession).mockResolvedValue({} as any)
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
        email: 'attacker@example.com',
        id: 'attacker-user-id',
        displayName: 'Attacker',
        passwordHash: 'mock-hash',
        preferredCurrency: Currency.USD,
        hasCompletedOnboarding: true,
        accountNames: ['Attacker Account'],
        defaultAccountName: 'Attacker Account',
      })

      // The transaction request targets User B's (victim's) account
      const mockRequest = {
        id: 'req-id',
        toId: 'victim-account-id',
        fromId: 'some-sender-id',
        amount: 1000,
        currency: 'USD',
        categoryId: 'cat-id',
        description: 'Malicious approval attempt',
        date: new Date(),
        status: 'PENDING',
      }

      // The target account belongs to User B (victim), NOT the attacker
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        id: 'victim-account-id',
        name: 'Victim Account',
        type: 'SELF',
        userId: 'victim-user-id', // Different from attacker-user-id
      } as any)

      const result = await approveTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

      expect(result).toEqual({
        success: false,
        error: { general: ['You do not have access to this transaction request'] },
      })
      // Ensure the transaction was NOT created
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should allow user to approve request for account they own', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

      // User is logged in
      vi.mocked(requireSession).mockResolvedValue({} as any)
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
        email: 'owner@example.com',
        id: 'owner-user-id',
        displayName: 'Owner',
        passwordHash: 'mock-hash',
        preferredCurrency: Currency.USD,
        hasCompletedOnboarding: true,
        accountNames: ['Owner Account'],
        defaultAccountName: 'Owner Account',
      })

      const mockRequest = {
        id: 'req-id',
        toId: 'owner-account-id',
        fromId: 'sender-id',
        amount: 100,
        currency: 'USD',
        categoryId: 'cat-id',
        description: 'Legitimate request',
        date: new Date(),
        status: 'PENDING',
      }

      // Account belongs to the same user
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        id: 'owner-account-id',
        name: 'Owner Account',
        type: 'SELF',
        userId: 'owner-user-id', // Same as logged-in user
      } as any)
      vi.mocked(prisma.transactionRequest.update).mockResolvedValue({} as any)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

      const result = await approveTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

      expect(result).toEqual({ success: true })
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('rejectTransactionRequestAction', () => {
    it('should reject when user tries to reject request for account they do not own', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

      // User A (attacker) is logged in
      vi.mocked(requireSession).mockResolvedValue({} as any)
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
        email: 'attacker@example.com',
        id: 'attacker-user-id',
        displayName: 'Attacker',
        passwordHash: 'mock-hash',
        preferredCurrency: Currency.USD,
        hasCompletedOnboarding: true,
        accountNames: ['Attacker Account'],
        defaultAccountName: 'Attacker Account',
      })

      // The transaction request targets User B's (victim's) account
      const mockRequest = {
        id: 'req-id',
        toId: 'victim-account-id',
        fromId: 'some-sender-id',
        status: 'PENDING',
      }

      // The target account belongs to User B (victim)
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        id: 'victim-account-id',
        name: 'Victim Account',
        type: 'SELF',
        userId: 'victim-user-id', // Different from attacker-user-id
      } as any)

      const result = await rejectTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

      expect(result).toEqual({
        success: false,
        error: { general: ['You do not have access to this transaction request'] },
      })
      // Ensure the request was NOT updated
      expect(prisma.transactionRequest.update).not.toHaveBeenCalled()
    })

    it('should allow user to reject request for account they own', async () => {
      const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

      vi.mocked(requireSession).mockResolvedValue({} as any)
      vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
        email: 'owner@example.com',
        id: 'owner-user-id',
        displayName: 'Owner',
        passwordHash: 'mock-hash',
        preferredCurrency: Currency.USD,
        hasCompletedOnboarding: true,
        accountNames: ['Owner Account'],
        defaultAccountName: 'Owner Account',
      })

      const mockRequest = {
        id: 'req-id',
        toId: 'owner-account-id',
        fromId: 'sender-id',
        status: 'PENDING',
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        id: 'owner-account-id',
        name: 'Owner Account',
        type: 'SELF',
        userId: 'owner-user-id',
      } as any)
      vi.mocked(prisma.transactionRequest.update).mockResolvedValue({} as any)

      const result = await rejectTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

      expect(result).toEqual({ success: true })
      expect(prisma.transactionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-id' },
        data: { status: 'REJECTED' },
      })
    })
  })
})

describe('User Isolation: Holdings Category Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should reject when user tries to create holding with another user category', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

    // User A is logged in
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'userA@example.com',
      id: 'user-a-id',
      displayName: 'User A',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['User A Account'],
      defaultAccountName: 'User A Account',
    })

    // User A's account
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'user-a-account-id',
      name: 'User A Account',
      type: 'SELF',
      userId: 'user-a-id',
    } as any)

    // Category lookup returns null because userId doesn't match
    // (simulating the userId filter in the query)
    vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

    const result = await createHoldingAction({
      accountId: 'user-a-account-id',
      categoryId: 'user-b-category-id', // Category belongs to User B
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.categoryId).toContain('Category not found')
    }
    // Ensure the holding was NOT created
    expect(prisma.holding.create).not.toHaveBeenCalled()
  })

  it('should allow user to create holding with their own category', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'owner@example.com',
      id: 'owner-id',
      displayName: 'Owner',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Owner Account'],
      defaultAccountName: 'Owner Account',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'owner-account-id',
      name: 'Owner Account',
      type: 'SELF',
      userId: 'owner-id',
    } as any)

    // Category belongs to the same user and is a holding category
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'owner-category-id',
      name: 'Investments',
      userId: 'owner-id',
      isHolding: true,
    } as any)

    vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

    const result = await createHoldingAction({
      accountId: 'owner-account-id',
      categoryId: 'owner-category-id',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.holding.create).toHaveBeenCalled()
  })

  it('should reject if category is not marked as holding category', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')

    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'owner@example.com',
      id: 'owner-id',
      displayName: 'Owner',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Owner Account'],
      defaultAccountName: 'Owner Account',
    })

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'owner-account-id',
      name: 'Owner Account',
      type: 'SELF',
      userId: 'owner-id',
    } as any)

    // Category belongs to user but is NOT a holding category
    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'owner-category-id',
      name: 'Groceries',
      userId: 'owner-id',
      isHolding: false,
    } as any)

    const result = await createHoldingAction({
      accountId: 'owner-account-id',
      categoryId: 'owner-category-id',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.categoryId).toContain('Category must be marked as a holding category')
    }
    expect(prisma.holding.create).not.toHaveBeenCalled()
  })
})
