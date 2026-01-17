import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Currency } from '@prisma/client'

// Mock Prisma.Decimal
vi.mock('@prisma/client', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('@prisma/client')

  class MockDecimal {
    constructor(public value: string | number) {}
    toNumber() {
      return Number(this.value)
    }
    toString() {
      return String(this.value)
    }
    toFixed(decimals: number) {
      return Number(this.value).toFixed(decimals)
    }
  }

  return {
    ...original,
    Prisma: {
      ...original.Prisma,
      Decimal: MockDecimal,
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    holding: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/stock-api', () => ({
  fetchStockQuote: vi.fn(),
  refreshStockPrices: vi.fn(),
}))

vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((value: number) => {
    const DECIMAL_PRECISION = 2
    const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)
    return (Math.round(value * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
  }),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { fetchStockQuote, refreshStockPrices } from '@/lib/stock-api'
import {
  createHolding,
  updateHolding,
  deleteHolding,
  getHoldingById,
  getAccountHoldingSymbols,
  refreshHoldingPrices,
  validateHoldingCategory,
  validateStockSymbol,
  type CreateHoldingInput,
  type UpdateHoldingInput,
} from '@/lib/services/holding-service'

const mockDecimal = (value: string) => ({
  value,
  toNumber: () => Number(value),
  toString: () => value,
  toFixed: (decimals: number) => Number(value).toFixed(decimals),
})

interface PrismaError extends Error {
  code: string
}

describe('holding-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Phase 1: createHolding()', () => {
    it('should create holding with all fields', async () => {
      const input: CreateHoldingInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: 100.5,
        averageCost: 150.25,
        currency: Currency.USD,
        notes: 'Apple stock',
      }

      const mockHolding = {
        id: 'hold-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('100.500000'),
        averageCost: mockDecimal('150.25'),
        currency: Currency.USD,
        notes: 'Apple stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.create).mockResolvedValue(mockHolding as never)

      await createHolding(input)

      const call = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(call.data.symbol).toBe('AAPL')
    })

    it('should normalize symbol to uppercase: aapl -> AAPL', async () => {
      const input: CreateHoldingInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'aapl',
        quantity: 100,
        averageCost: 150,
        currency: Currency.USD,
      }

      const mockHolding = {
        id: 'hold-2',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('100.000000'),
        averageCost: mockDecimal('150.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.create).mockResolvedValue(mockHolding as never)

      await createHolding(input)

      const call = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(call.data.symbol).toBe('AAPL')
    })

    it('should preserve 6 decimal precision for quantity', async () => {
      const input: CreateHoldingInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'MSFT',
        quantity: 100.123456,
        averageCost: 200,
        currency: Currency.USD,
      }

      const mockHolding = {
        id: 'hold-3',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'MSFT',
        quantity: mockDecimal('100.123456'),
        averageCost: mockDecimal('200.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.create).mockResolvedValue(mockHolding as never)

      await createHolding(input)

      const call = vi.mocked(prisma.holding.create).mock.calls[0][0]
      // Check that toFixed(6) was used
      expect((call.data.quantity as unknown as { value: string }).value).toBe('100.123456')
    })

    it('should create without notes (null)', async () => {
      const input: CreateHoldingInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'TSLA',
        quantity: 50,
        averageCost: 250,
        currency: Currency.USD,
      }

      const mockHolding = {
        id: 'hold-4',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'TSLA',
        quantity: mockDecimal('50.000000'),
        averageCost: mockDecimal('250.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.create).mockResolvedValue(mockHolding as never)

      await createHolding(input)

      const call = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(call.data.notes).toBeNull()
    })
  })

  describe('Phase 2: updateHolding()', () => {
    it('should update quantity, averageCost, and notes', async () => {
      const input: UpdateHoldingInput = {
        id: 'hold-1',
        quantity: 150.5,
        averageCost: 160.75,
        notes: 'Updated',
      }

      const mockHolding = {
        id: 'hold-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('150.500000'),
        averageCost: mockDecimal('160.75'),
        currency: Currency.USD,
        notes: 'Updated',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.update).mockResolvedValue(mockHolding as never)

      await updateHolding(input)

      expect(prisma.holding.update).toHaveBeenCalledWith({
        where: { id: 'hold-1' },
        data: expect.any(Object),
      })
    })

    it('should preserve 6 decimal precision on update', async () => {
      const input: UpdateHoldingInput = {
        id: 'hold-1',
        quantity: 200.987654,
        averageCost: 100,
      }

      const mockHolding = {
        id: 'hold-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('200.987654'),
        averageCost: mockDecimal('100.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.update).mockResolvedValue(mockHolding as never)

      await updateHolding(input)

      const call = vi.mocked(prisma.holding.update).mock.calls[0][0]
      expect((call.data.quantity as { value: string }).value).toBe('200.987654')
    })
  })

  describe('Phase 3: deleteHolding()', () => {
    it('should delete holding by ID', async () => {
      const mockHolding = {
        id: 'hold-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('100.000000'),
        averageCost: mockDecimal('150.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.delete).mockResolvedValue(mockHolding as never)

      await deleteHolding('hold-1')

      expect(prisma.holding.delete).toHaveBeenCalledWith({ where: { id: 'hold-1' } })
    })

    it('should handle holding not found', async () => {
      const error = new Error('Record not found')
      ;(error as PrismaError).code = 'P2025'

      vi.mocked(prisma.holding.delete).mockRejectedValue(error)

      await expect(deleteHolding('nonexistent')).rejects.toThrow('Record not found')
    })
  })

  describe('Phase 4: getHoldingById()', () => {
    it('should find existing holding', async () => {
      const mockHolding = {
        id: 'hold-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: mockDecimal('100.000000'),
        averageCost: mockDecimal('150.00'),
        currency: Currency.USD,
        notes: 'Test',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.findUnique).mockResolvedValue(mockHolding as never)

      const result = await getHoldingById('hold-1')

      expect(result).toEqual(mockHolding)
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.holding.findUnique).mockResolvedValue(null)

      const result = await getHoldingById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('Phase 5: getAccountHoldingSymbols()', () => {
    it('should return unique symbols', async () => {
      const mockHoldings = [{ symbol: 'AAPL' }, { symbol: 'MSFT' }, { symbol: 'AAPL' }]

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as never)

      const result = await getAccountHoldingSymbols('acc-1')

      expect(result).toEqual(['AAPL', 'MSFT'])
    })

    it('should return empty array when no holdings', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([])

      const result = await getAccountHoldingSymbols('acc-1')

      expect(result).toEqual([])
    })
  })

  describe('Phase 6: validateHoldingCategory()', () => {
    it('should return true for valid holding category', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Stocks',
        type: 'EXPENSE' as const,
        color: null,
        isHolding: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(mockCategory as never)

      const result = await validateHoldingCategory('cat-1')

      expect(result).toBe(true)
    })

    it('should return true for valid holding category with userId filter', async () => {
      const mockCategory = {
        id: 'cat-1',
        userId: 'user-1',
        name: 'Stocks',
        type: 'EXPENSE' as const,
        color: null,
        isHolding: true,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(mockCategory as never)

      const result = await validateHoldingCategory('cat-1', 'user-1')

      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'user-1' },
      })
      expect(result).toBe(true)
    })

    it('should throw if category not found', async () => {
      vi.mocked(prisma.category.findFirst).mockResolvedValue(null)

      await expect(validateHoldingCategory('nonexistent')).rejects.toThrow('Category not found')
    })

    it('should throw if category isHolding=false', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Groceries',
        type: 'EXPENSE' as const,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findFirst).mockResolvedValue(mockCategory as never)

      await expect(validateHoldingCategory('cat-1')).rejects.toThrow('Category must be marked as a holding category')
    })
  })

  describe('Phase 7: validateStockSymbol()', () => {
    it('should call fetchStockQuote with symbol', async () => {
      vi.mocked(fetchStockQuote).mockResolvedValue({
        symbol: 'AAPL',
        price: 150.25,
        change: 2.5,
        changePercent: 1.69,
        lastUpdated: new Date(),
      } as never)

      await validateStockSymbol('AAPL')

      expect(fetchStockQuote).toHaveBeenCalledWith('AAPL')
    })

    it('should throw if stock symbol invalid', async () => {
      vi.mocked(fetchStockQuote).mockRejectedValue(new Error('Invalid symbol'))

      await expect(validateStockSymbol('INVALID')).rejects.toThrow('Invalid symbol')
    })
  })

  describe('Phase 8: refreshHoldingPrices()', () => {
    it('should return empty result when no holdings', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([])

      const result = await refreshHoldingPrices({ accountId: 'acc-1' })

      expect(result).toEqual({ updated: 0, skipped: 0, errors: [] })
    })

    it('should call refreshStockPrices with symbols', async () => {
      const mockHoldings = [{ symbol: 'AAPL' }, { symbol: 'MSFT' }]

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as never)
      vi.mocked(refreshStockPrices).mockResolvedValue({
        updated: 2,
        skipped: 0,
        errors: [],
      } as never)

      await refreshHoldingPrices({ accountId: 'acc-1' })

      expect(refreshStockPrices).toHaveBeenCalledWith(['AAPL', 'MSFT'])
    })

    it('should return stats from refreshStockPrices', async () => {
      const mockHoldings = [{ symbol: 'AAPL' }]

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as never)
      vi.mocked(refreshStockPrices).mockResolvedValue({
        updated: 1,
        skipped: 0,
        errors: [],
      } as never)

      const result = await refreshHoldingPrices({ accountId: 'acc-1' })

      expect(result).toEqual({ updated: 1, skipped: 0, errors: [] })
    })
  })
})
