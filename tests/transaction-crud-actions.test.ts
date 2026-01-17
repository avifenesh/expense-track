/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createTransactionAction, updateTransactionAction, deleteTransactionAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { Currency, TransactionType } from '@prisma/client'

// Fixed test date to avoid flaky tests around month boundaries
// Using mid-month to avoid edge cases with month transitions
const FIXED_TEST_DATE = new Date('2026-01-15T12:00:00.000Z')

// Note: Each describe block has its own beforeEach/afterEach for time mocking.
// This is intentional for test isolation - each suite can be run independently
// and the pattern is explicit about time mocking being required for each suite.

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

vi.mock('@/lib/prisma', () => {
  const mockAccount = { findUnique: vi.fn(), findFirst: vi.fn() }
  const mockTransaction = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
  const mockRecurringTemplate = { create: vi.fn() }

  return {
    prisma: {
      account: mockAccount,
      transaction: mockTransaction,
      recurringTemplate: mockRecurringTemplate,
      // Mock $transaction to pass a tx client with the same mocks
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          account: mockAccount,
          transaction: mockTransaction,
          recurringTemplate: mockRecurringTemplate,
        }
        return callback(tx)
      }),
    },
  }
})

describe('createTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set fixed system time to ensure consistent date behavior in tests
    vi.setSystemTime(FIXED_TEST_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Test transaction',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Your session expired'))).toBe(true)
    }
  })

  it('should successfully create an expense transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date('2026-01-15'),
      description: 'Groceries',
      isRecurring: false,
      recurringTemplateId: null,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.create).toHaveBeenCalled()
    // Verify cache invalidation is called with correct parameters
    expect(invalidateDashboardCache).toHaveBeenCalledWith({
      monthKey: '2026-01',
      accountId: 'acc-1',
    })
  })

  it('should successfully create an income transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.INCOME,
      amount: 5000,
      currency: Currency.USD,
      date: new Date('2026-01-01'),
      description: 'Salary',
      isRecurring: false,
      recurringTemplateId: null,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })

  it('should reject negative amount', async () => {
    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: -50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: null,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.amount).toBeDefined()
    }
  })

  it('should accept null description and preserve it in database call', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 25,
      currency: Currency.EUR,
      date: new Date(),
      csrfToken: 'test-token',
      description: null,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })

    // Verify null description is explicitly preserved (not converted to empty string or omitted)
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: null,
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
      }),
    })
  })

  it('should create recurring transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Rent',
      isRecurring: true,
      recurringTemplateId: 'template-1',
    })

    expect(result).toEqual({ success: true })
  })

  it('should fail when database create throws error', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.create).mockRejectedValue(new Error('DB constraint violation'))

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to create transaction'))).toBe(true)
    }
  })
})

describe('updateTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(FIXED_TEST_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should fail when transaction not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Transaction not found'))).toBe(true)
    }
  })

  it('should successfully update transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    // Mock for the new account check (prisma.account.findFirst outside transaction)
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    // Mock for the existing account check (tx.account.findUnique inside transaction)
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

    const testDate = new Date('2024-03-15')
    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: testDate,
      csrfToken: 'test-token',
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.update).toHaveBeenCalled()
    // Verify cache invalidation is called for both old month and new month
    expect(invalidateDashboardCache).toHaveBeenCalledWith({
      monthKey: '2024-01',
      accountId: 'acc-1',
    })
    expect(invalidateDashboardCache).toHaveBeenCalledWith({
      monthKey: '2024-03',
      accountId: 'acc-1',
    })
  })

  it('should handle account change', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'test@example.com',
      id: 'test-user',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      hasCompletedOnboarding: true,
      accountNames: ['Account1', 'Account2'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    // Mock for the new account check (prisma.account.findFirst outside transaction)
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-2',
      name: 'Account2',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    // Mock for the existing account check (tx.account.findUnique inside transaction)
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-2',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Moved to different account',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
  })

  it('should fail when user lacks access to existing transaction account', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-unauthorized',
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-unauthorized',
      name: 'UnauthorizedAccount',
      type: 'SELF',
      userId: 'other-user',
    } as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-unauthorized',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Update attempt on unauthorized transaction',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId?.some((msg: string) => msg.includes('You do not have access'))).toBe(true)
    }
  })

  it('should fail when changing to unauthorized account', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    // Mock for the NEW account check (prisma.account.findFirst outside transaction)
    // The new account belongs to a different user, so access should be denied
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-unauthorized',
      name: 'UnauthorizedAccount',
      type: 'SELF',
      userId: 'other-user', // Different user - should trigger access denied
    } as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-unauthorized',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Trying to move to unauthorized account',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId?.some((msg: string) => msg.includes('You do not have access'))).toBe(true)
    }
  })

  it('should fail when database update throws error', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    // Mock for the existing account check (tx.account.findUnique inside transaction)
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockRejectedValue(new Error('DB deadlock'))

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to update transaction'))).toBe(true)
    }
  })

  it('should handle concurrent modification (P2025 - record deleted between find and update)', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    // Transaction exists at the time of findUnique
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    // Mock for the existing account check (tx.account.findUnique inside transaction)
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
    } as any)

    // Simulate concurrent deletion - P2025 error
    const p2025Error = new Error('Record to update not found') as Error & { code: string }
    p2025Error.code = 'P2025'
    vi.mocked(prisma.transaction.update).mockRejectedValue(p2025Error)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date('2024-01-15'),
      csrfToken: 'test-token',
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      // Should handle the concurrent modification gracefully
      expect(result.error.general).toBeDefined()
    }
  })
})

describe('deleteTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(FIXED_TEST_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should fail when transaction not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Transaction not found'))).toBe(true)
    }
  })

  it('should successfully delete transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: { deletedAt: expect.any(Date), deletedBy: 'test-user' },
    })
    // Verify cache invalidation is called with correct parameters
    expect(invalidateDashboardCache).toHaveBeenCalledWith({
      monthKey: '2024-01',
      accountId: 'acc-1',
    })
  })

  it('should fail when user lacks access to transaction account', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-2',
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-2',
      name: 'DifferentAccount',
      type: 'SELF',
      userId: 'other-user',
    } as any)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId?.some((msg: string) => msg.includes('You do not have access'))).toBe(true)
    }
  })

  it('should fail when database delete throws error', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockRejectedValue(new Error('DB error'))

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to delete transaction'))).toBe(true)
    }
  })

  it('should handle concurrent deletion (P2025 - record deleted between find and delete)', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    // Transaction exists at the time of findFirst
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    // Simulate concurrent deletion by another request - P2025 error
    const p2025Error = new Error('Record to update does not exist') as Error & { code: string }
    p2025Error.code = 'P2025'
    vi.mocked(prisma.transaction.update).mockRejectedValue(p2025Error)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      // Should handle the concurrent deletion gracefully
      expect(result.error.general).toBeDefined()
    }
  })

  it('should fail when database findFirst throws error', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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

    vi.mocked(prisma.transaction.findFirst).mockRejectedValue(new Error('DB connection lost'))

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to delete transaction'))).toBe(true)
    }
  })
})

describe('subscription state edge cases', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.setSystemTime(FIXED_TEST_DATE)
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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
  })

  it('should allow write when subscription is active', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(true)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'ACTIVE',
      isActive: true,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      daysRemaining: 30,
      canAccessApp: true,
    })
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Active subscription test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
  })

  it('should allow write during active trial period', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(true)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'TRIALING',
      isActive: true,
      trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days left
      currentPeriodEnd: null,
      daysRemaining: 10,
      canAccessApp: true,
    })
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Trial period test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
  })

  it('should block write when trial expired', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(false)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'EXPIRED',
      isActive: false,
      trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Expired 1 day ago
      currentPeriodEnd: null,
      daysRemaining: 0,
      canAccessApp: false,
    })

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Trial expired test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(
        result.error.subscription !== undefined ||
          result.error.general?.some((msg: string) => msg.toLowerCase().includes('subscription')),
      ).toBe(true)
    }
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('should block write when subscription cancelled', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(false)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'CANCELED',
      isActive: false,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Ended 5 days ago
      daysRemaining: 0,
      canAccessApp: false,
    })

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Cancelled subscription test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(
        result.error.subscription !== undefined ||
          result.error.general?.some((msg: string) => msg.toLowerCase().includes('subscription')),
      ).toBe(true)
    }
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('should block update when subscription inactive', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(false)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'CANCELED',
      isActive: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysRemaining: 0,
      canAccessApp: false,
    })

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date(),
      csrfToken: 'test-token',
      description: 'Update blocked test',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    expect(prisma.transaction.update).not.toHaveBeenCalled()
  })

  it('should block delete when subscription inactive', async () => {
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(hasActiveSubscription).mockResolvedValue(false)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'CANCELED',
      isActive: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysRemaining: 0,
      canAccessApp: false,
    })

    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    expect(prisma.transaction.delete).not.toHaveBeenCalled()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})

describe('auto-create RecurringTemplate', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.setSystemTime(FIXED_TEST_DATE)
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    const { hasActiveSubscription, getSubscriptionState } = await import('@/lib/subscription')
    vi.mocked(requireSession).mockResolvedValue({} as Awaited<ReturnType<typeof requireSession>>)
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
    // Mock for the existing account check (tx.account.findUnique inside transaction)
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      userId: 'test-user',
    } as any)
    // Reset subscription mocks to active state
    vi.mocked(hasActiveSubscription).mockResolvedValue(true)
    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: 'ACTIVE',
      isActive: true,
      trialEndsAt: null,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      daysRemaining: 30,
      canAccessApp: true,
    })
  })

  it('should create RecurringTemplate when isRecurring is true on new transaction', async () => {
    vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({
      id: 'template-123',
    } as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date('2026-01-15'),
      description: 'Monthly subscription',
      isRecurring: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        dayOfMonth: 15,
        isActive: true,
      }),
    })
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isRecurring: true,
        recurringTemplateId: 'template-123',
      }),
    })
  })

  it('should NOT create template if recurringTemplateId already provided', async () => {
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date('2026-01-15'),
      description: 'Existing recurring',
      isRecurring: true,
      recurringTemplateId: 'existing-template-id',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.create).not.toHaveBeenCalled()
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isRecurring: true,
        recurringTemplateId: 'existing-template-id',
      }),
    })
  })

  it('should create template when updating transaction to recurring', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2026-01-01'),
      recurringTemplateId: null,
    } as any)

    vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({
      id: 'new-template-456',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 50,
      currency: Currency.USD,
      date: new Date('2026-01-20'),
      description: 'Now recurring',
      isRecurring: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dayOfMonth: 20,
        isActive: true,
      }),
    })
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: expect.objectContaining({
        isRecurring: true,
        recurringTemplateId: 'new-template-456',
      }),
    })
  })

  it('should NOT create template when updating already recurring transaction', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2026-01-01'),
      recurringTemplateId: 'existing-template-id',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

    const result = await updateTransactionAction({
      id: 'tx-1',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 75,
      currency: Currency.USD,
      date: new Date('2026-01-20'),
      description: 'Already recurring',
      isRecurring: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.recurringTemplate.create).not.toHaveBeenCalled()
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
      data: expect.objectContaining({
        recurringTemplateId: 'existing-template-id',
      }),
    })
  })

  it('should extract correct dayOfMonth from different dates', async () => {
    vi.mocked(prisma.recurringTemplate.create).mockResolvedValue({ id: 'template-day31' } as any)
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    // Test with day 31
    await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date('2026-01-31'),
      description: 'End of month',
      isRecurring: true,
      csrfToken: 'test-token',
    })

    expect(prisma.recurringTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dayOfMonth: 31,
      }),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
