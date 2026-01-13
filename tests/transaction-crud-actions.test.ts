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
  getAuthUserFromSession: vi.fn(),
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
      description: 'Test transaction',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Your session expired')
    }
  })

  it('should successfully create an expense transaction', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
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
    })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.create).toHaveBeenCalled()
  })

  it('should successfully create an income transaction', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
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
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
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
    } as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 25,
      currency: Currency.EUR,
      date: new Date(),
      description: null,
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
  })

  it('should create recurring transaction', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
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
    } as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await createTransactionAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      type: TransactionType.EXPENSE,
      amount: 100,
      currency: Currency.USD,
      date: new Date(),
      description: 'Rent',
      isRecurring: true,
      recurringTemplateId: 'template-1',
    })

    expect(result).toEqual({ success: true })
  })
})

describe('updateTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when transaction not found', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
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
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Transaction not found')
    }
  })

  it('should successfully update transaction', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
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
      description: 'Updated',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.update).toHaveBeenCalled()
  })

  it('should handle account change', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1', 'Account2'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique)
      .mockResolvedValueOnce({
        id: 'acc-1',
        name: 'Account1',
        type: 'SELF',
      } as any)
      .mockResolvedValueOnce({
        id: 'acc-2',
        name: 'Account2',
        type: 'SELF',
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
      description: 'Moved to different account',
      isRecurring: false,
      recurringTemplateId: null,
    })

    expect(result).toEqual({ success: true })
  })
})

describe('deleteTransactionAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when transaction not found', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

    const result = await deleteTransactionAction({ id: 'tx-1' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Transaction not found')
    }
  })

  it('should successfully delete transaction', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Account1'],
      defaultAccountName: 'Account1',
    })

    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
    } as any)

    vi.mocked(prisma.transaction.delete).mockResolvedValue({} as any)

    const result = await deleteTransactionAction({ id: 'tx-1' })

    expect(result).toEqual({ success: true })
    expect(prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'tx-1' },
    })
  })

  it('should fail when user lacks access to transaction account', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
      email: 'test@example.com',
      id: 'user-1',
      displayName: 'Test User',
      passwordHash: 'hash',
      preferredCurrency: Currency.USD,
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
    } as any)

    const result = await deleteTransactionAction({ id: 'tx-1' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId).toContain('You do not have access')
    }
  })
})
