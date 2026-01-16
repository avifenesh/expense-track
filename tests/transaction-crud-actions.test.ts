/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createTransactionAction, updateTransactionAction, deleteTransactionAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency, TransactionType } from '@prisma/client'

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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    recurringTemplate: {
      create: vi.fn(),
    },
  },
}))

describe('createTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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
  })

  it('should successfully create an income transaction', async () => {
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

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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

  it('should accept null description', async () => {
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

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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
  })

  it('should create recurring transaction', async () => {
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

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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
  })

  it('should fail when transaction not found', async () => {
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

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

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.update).toHaveBeenCalled()
  })

  it('should handle account change', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique)
      .mockResolvedValueOnce({
        id: 'acc-1',
        name: 'Account1',
        type: 'SELF',
        userId: 'test-user',
      } as any)
      .mockResolvedValueOnce({
        id: 'acc-2',
        name: 'Account2',
        type: 'SELF',
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-unauthorized',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique)
      .mockResolvedValueOnce({
        id: 'acc-1',
        name: 'Account1',
        type: 'SELF',
        userId: 'test-user',
      } as any)
      .mockResolvedValueOnce({
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
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
})

describe('deleteTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when transaction not found', async () => {
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general.some((msg: string) => msg.includes('Transaction not found'))).toBe(true)
    }
  })

  it('should successfully delete transaction', async () => {
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.delete).mockResolvedValue({} as any)

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
    })
  })

  it('should fail when user lacks access to transaction account', async () => {
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-2',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
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

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
      month: new Date('2024-01-01'),
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)

    vi.mocked(prisma.transaction.delete).mockRejectedValue(new Error('DB error'))

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to delete transaction'))).toBe(true)
    }
  })

  it('should fail when database findUnique throws error', async () => {
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

    vi.mocked(prisma.transaction.findUnique).mockRejectedValue(new Error('DB connection lost'))

    const result = await deleteTransactionAction({ id: 'tx-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to delete transaction'))).toBe(true)
    }
  })
})

describe('auto-create RecurringTemplate', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
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
    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
      userId: 'test-user',
    } as any)
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
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
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
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
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
})
