/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { refreshExchangeRatesAction, setBalanceAction } from '@/app/actions'
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
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/currency', () => ({
  refreshExchangeRates: vi.fn(),
}))

describe('refreshExchangeRatesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await refreshExchangeRatesAction()

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Your session expired')
    }
  })

  it('should successfully refresh exchange rates', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)

    const { refreshExchangeRates } = await import('@/lib/currency')
    vi.mocked(refreshExchangeRates).mockResolvedValue({
      success: true,
      updatedAt: new Date('2026-01-13'),
    })

    const result = await refreshExchangeRatesAction()

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.updatedAt).toEqual(new Date('2026-01-13'))
    }
  })

  it('should handle refresh error', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)

    const { refreshExchangeRates } = await import('@/lib/currency')
    vi.mocked(refreshExchangeRates).mockResolvedValue({
      error: { general: ['API rate limit exceeded'] },
      updatedAt: new Date('2026-01-13'),
    })

    const result = await refreshExchangeRatesAction()

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('API rate limit exceeded')
    }
  })

  it('should handle unexpected errors', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)

    const { refreshExchangeRates } = await import('@/lib/currency')
    vi.mocked(refreshExchangeRates).mockRejectedValue(new Error('Network error'))

    const result = await refreshExchangeRatesAction()

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Unable to refresh exchange rates')
    }
  })
})

describe('setBalanceAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 1000,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Your session expired')
    }
  })

  it('should create positive adjustment when target is higher', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-adjust',
      name: 'Balance Adjustment',
      type: TransactionType.INCOME,
    } as any)

    // Current: income 500, expense 200 = net 300
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { type: TransactionType.INCOME, amount: 500 },
      { type: TransactionType.EXPENSE, amount: 200 },
    ] as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    // Target 1000, current 300, need adjustment of +700
    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 1000,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.adjustment).toBe(700)
    }
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.INCOME,
        }),
      }),
    )
  })

  it('should create negative adjustment when target is lower', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-adjust',
      name: 'Balance Adjustment',
      type: TransactionType.INCOME,
    } as any)

    // Current: income 1000, expense 200 = net 800
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { type: TransactionType.INCOME, amount: 1000 },
      { type: TransactionType.EXPENSE, amount: 200 },
    ] as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    // Target 300, current 800, need adjustment of -500
    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 300,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.adjustment).toBe(-500)
    }
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.EXPENSE,
        }),
      }),
    )
  })

  it('should skip adjustment when balance is already correct', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    // Current: income 1000, expense 200 = net 800
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { type: TransactionType.INCOME, amount: 1000 },
      { type: TransactionType.EXPENSE, amount: 200 },
    ] as any)

    // Target 800, current 800, no adjustment needed
    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 800,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.adjustment).toBe(0)
    }
    expect(prisma.transaction.create).not.toHaveBeenCalled()
  })

  it('should create Balance Adjustment category if not exists', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    vi.mocked(prisma.category.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.category.create).mockResolvedValue({
      id: 'cat-new',
      name: 'Balance Adjustment',
      type: TransactionType.INCOME,
    } as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([{ type: TransactionType.INCOME, amount: 500 }] as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 1000,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        name: 'Balance Adjustment',
        type: TransactionType.INCOME,
      },
    })
  })

  it('should handle decimal amounts properly', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-adjust',
      name: 'Balance Adjustment',
      type: TransactionType.INCOME,
    } as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { type: TransactionType.INCOME, amount: { toNumber: () => 100.5 } },
      { type: TransactionType.EXPENSE, amount: { toNumber: () => 25.25 } },
    ] as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: 100,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.adjustment).toBeCloseTo(24.75, 2)
    }
  })

  it('should handle negative target balance', async () => {
    const { requireSession, getAuthUserFromSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getAuthUserFromSession).mockReturnValue({
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
    } as any)

    vi.mocked(prisma.category.findFirst).mockResolvedValue({
      id: 'cat-adjust',
      name: 'Balance Adjustment',
      type: TransactionType.INCOME,
    } as any)

    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      { type: TransactionType.INCOME, amount: 100 },
      { type: TransactionType.EXPENSE, amount: 200 },
    ] as any)

    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    // Current: -100, target: -200, need expense of 100
    const result = await setBalanceAction({
      accountId: 'acc-1',
      targetBalance: -200,
      currency: Currency.USD,
      monthKey: '2026-01',
    })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.adjustment).toBe(-100)
    }
  })
})
