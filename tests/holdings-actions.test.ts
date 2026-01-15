/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createHoldingAction,
  updateHoldingAction,
  deleteHoldingAction,
  refreshHoldingPricesAction,
} from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

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
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
        toFixed(decimals: number) {
          return Number(this.value).toFixed(decimals)
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    holding: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stock-api', () => ({
  fetchStockQuote: vi.fn(),
  refreshStockPrices: vi.fn(),
}))

describe('createHoldingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create a holding', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: true,
    } as any)

    const { fetchStockQuote } = await import('@/lib/stock-api')
    vi.mocked(fetchStockQuote).mockResolvedValue({ price: 150.5, symbol: 'AAPL' } as any)

    vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: 'Tech stocks',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.holding.create).toHaveBeenCalled()
  })

  it('should fail when category is not a holding category', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: false,
    } as any)

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.categoryId?.some((msg: string) => msg.includes('must be marked as a holding category'))).toBe(
        true,
      )
    }
  })

  it('should fail with invalid stock symbol', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: true,
    } as any)

    const { fetchStockQuote } = await import('@/lib/stock-api')
    vi.mocked(fetchStockQuote).mockRejectedValue(new Error('Symbol not found'))

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'INVALID',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.symbol).toBeDefined()
    }
  })

  it('should convert symbol to uppercase', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: true,
    } as any)

    const { fetchStockQuote } = await import('@/lib/stock-api')
    vi.mocked(fetchStockQuote).mockResolvedValue({ price: 2500, symbol: 'GOOGL' } as any)

    vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'googl',
      quantity: 5,
      averageCost: 2400,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })

  it('should reject quantity out of range', async () => {
    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 1000000000,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.quantity).toBeDefined()
    }
  })

  it('should reject negative average cost', async () => {
    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: -150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.averageCost).toBeDefined()
    }
  })

  it('should fail when category not found', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-nonexistent',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.categoryId?.some((msg: string) => msg.includes('Category not found'))).toBe(true)
    }
  })

  it('should fail when category lookup throws database error', async () => {
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

    vi.mocked(prisma.category.findUnique).mockRejectedValue(new Error('DB connection lost'))

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to validate category'))).toBe(true)
    }
  })

  it('should handle non-Error stock API failures', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: true,
    } as any)

    const { fetchStockQuote } = await import('@/lib/stock-api')
    vi.mocked(fetchStockQuote).mockRejectedValue('API quota exceeded')

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'INVALID',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.symbol).toBeDefined()
    }
  })

  it('should fail when database cannot create holding', async () => {
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

    vi.mocked(prisma.category.findUnique).mockResolvedValue({
      id: 'cat-1',
      isHolding: true,
    } as any)

    const { fetchStockQuote } = await import('@/lib/stock-api')
    vi.mocked(fetchStockQuote).mockResolvedValue({ price: 150.5, symbol: 'AAPL' } as any)

    vi.mocked(prisma.holding.create).mockRejectedValue(new Error('Unique constraint violation'))

    const result = await createHoldingAction({
      accountId: 'acc-1',
      categoryId: 'cat-1',
      symbol: 'AAPL',
      quantity: 10,
      averageCost: 150,
      currency: Currency.USD,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to create holding'))).toBe(true)
    }
  })
})

describe('updateHoldingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully update a holding', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue({
      id: 'holding-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
    } as any)

    vi.mocked(prisma.holding.update).mockResolvedValue({} as any)

    const result = await updateHoldingAction({
      id: 'holding-1',
      quantity: 15,
      averageCost: 155,
      notes: 'Increased position',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.holding.update).toHaveBeenCalled()
  })

  it('should fail when holding not found', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue(null)

    const result = await updateHoldingAction({
      id: 'nonexistent',
      quantity: 15,
      averageCost: 155,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Holding not found'))).toBe(true)
    }
  })

  it('should fail when user lacks access to holding account', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue({
      id: 'holding-1',
      accountId: 'acc-other',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-other',
      name: 'UnauthorizedAccount',
      type: 'SELF',
    } as any)

    const result = await updateHoldingAction({
      id: 'holding-1',
      quantity: 15,
      averageCost: 155,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId?.some((msg: string) => msg.includes('You do not have access'))).toBe(true)
    }
  })

  it('should fail when database update throws error', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue({
      id: 'holding-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
    } as any)

    vi.mocked(prisma.holding.update).mockRejectedValue(new Error('DB error'))

    const result = await updateHoldingAction({
      id: 'holding-1',
      quantity: 15,
      averageCost: 155,
      notes: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Holding not found'))).toBe(true)
    }
  })
})

describe('deleteHoldingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully delete a holding', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue({
      id: 'holding-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
    } as any)

    vi.mocked(prisma.holding.delete).mockResolvedValue({} as any)

    const result = await deleteHoldingAction({ id: 'holding-1', csrfToken: 'test-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.holding.delete).toHaveBeenCalledWith({
      where: { id: 'holding-1' },
    })
  })

  it('should fail when database delete throws error', async () => {
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

    vi.mocked(prisma.holding.findUnique).mockResolvedValue({
      id: 'holding-1',
      accountId: 'acc-1',
    } as any)

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'acc-1',
      name: 'Account1',
      type: 'SELF',
    } as any)

    vi.mocked(prisma.holding.delete).mockRejectedValue(new Error('Foreign key constraint'))

    const result = await deleteHoldingAction({ id: 'holding-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Holding not found'))).toBe(true)
    }
  })
})

describe('refreshHoldingPricesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully refresh prices for all holdings', async () => {
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

    vi.mocked(prisma.holding.findMany).mockResolvedValue([
      { symbol: 'AAPL' },
      { symbol: 'GOOGL' },
      { symbol: 'MSFT' },
    ] as any)

    const { refreshStockPrices } = await import('@/lib/stock-api')
    vi.mocked(refreshStockPrices).mockResolvedValue({
      updated: 3,
      skipped: 0,
      errors: [],
    })

    const result = await refreshHoldingPricesAction({ accountId: 'acc-1', csrfToken: 'test-token' })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.updated).toBe(3)
    }
  })

  it('should return zero when no holdings found', async () => {
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

    vi.mocked(prisma.holding.findMany).mockResolvedValue([])

    const result = await refreshHoldingPricesAction({ accountId: 'acc-1', csrfToken: 'test-token' })

    expect('success' in result && result.success).toBe(true)
    if ('success' in result && result.success) {
      expect(result.data.updated).toBe(0)
      expect(result.data.skipped).toBe(0)
    }
  })

  it('should handle duplicate symbols', async () => {
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

    vi.mocked(prisma.holding.findMany).mockResolvedValue([
      { symbol: 'AAPL' },
      { symbol: 'AAPL' },
      { symbol: 'GOOGL' },
    ] as any)

    const { refreshStockPrices } = await import('@/lib/stock-api')
    vi.mocked(refreshStockPrices).mockResolvedValue({
      updated: 2,
      skipped: 0,
      errors: [],
    })

    const result = await refreshHoldingPricesAction({ accountId: 'acc-1', csrfToken: 'test-token' })

    expect('success' in result && result.success).toBe(true)
    expect(refreshStockPrices).toHaveBeenCalledWith(['AAPL', 'GOOGL'])
  })

  it('should fail when user lacks account access', async () => {
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
      id: 'acc-unauthorized',
      name: 'UnauthorizedAccount',
      type: 'SELF',
    } as any)

    const result = await refreshHoldingPricesAction({ accountId: 'acc-unauthorized', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.accountId?.some((msg: string) => msg.includes('You do not have access'))).toBe(true)
    }
  })

  it('should fail when database throws error', async () => {
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

    vi.mocked(prisma.holding.findMany).mockRejectedValue(new Error('DB timeout'))

    const result = await refreshHoldingPricesAction({ accountId: 'acc-1', csrfToken: 'test-token' })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('Unable to refresh stock prices'))).toBe(true)
    }
  })
})
