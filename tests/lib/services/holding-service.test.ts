/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Currency, Prisma } from '@prisma/client'

// 1. Mock @prisma/client FIRST (enums & Decimal)
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: { USD: 'USD', EUR: 'EUR', ILS: 'ILS' },
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

// 2. Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    holding: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
  },
}))

// 3. Mock dependencies
vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((n) => n.toFixed(2)),
}))

vi.mock('@/lib/stock-api', () => ({
  refreshStockPrices: vi.fn(),
  fetchStockQuote: vi.fn(),
}))

// 4. Import AFTER all mocks
import {
  createHolding,
  updateHolding,
  deleteHolding,
  getHoldingById,
  getAccountHoldingSymbols,
  refreshHoldingPrices,
  validateHoldingCategory,
  validateStockSymbol,
} from '@/lib/services/holding-service'
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/app/actions/shared'

describe('holding-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createHolding', () => {
    it('should create holding with all fields', async () => {
      const mockHolding = {
        id: 'holding-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: new Prisma.Decimal('10.500000'),
        averageCost: new Prisma.Decimal('150.00'),
        currency: Currency.USD,
        notes: 'Apple stock',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.create).mockResolvedValue(mockHolding)

      const result = await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: 10.5,
        averageCost: 150.0,
        currency: Currency.USD,
        notes: 'Apple stock',
      })

      expect(toDecimalString).toHaveBeenCalledWith(150.0)
      expect(prisma.holding.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          symbol: 'AAPL',
          quantity: expect.any(Prisma.Decimal),
          averageCost: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          notes: 'Apple stock',
        },
      })
      expect(result).toEqual(mockHolding)
    })

    it('should normalize symbol to uppercase', async () => {
      vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

      await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'aapl',
        quantity: 5.0,
        averageCost: 100.0,
        currency: Currency.USD,
      })

      const createCall = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(createCall.data.symbol).toBe('AAPL')
    })

    it('should use 6 decimal precision for quantity', async () => {
      vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

      await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'TSLA',
        quantity: 10.123456789,
        averageCost: 200.0,
        currency: Currency.USD,
      })

      const createCall = vi.mocked(prisma.holding.create).mock.calls[0][0]
      // Verify toFixed(6) was applied
      expect(createCall.data.quantity).toBeInstanceOf(Prisma.Decimal)
      // The value should be truncated to 6 decimals
      expect(createCall.data.quantity.value).toBe('10.123457') // Rounded
    })

    it('should use 2 decimal precision for averageCost via toDecimalString', async () => {
      vi.mocked(toDecimalString).mockReturnValue('199.99')
      vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

      await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'MSFT',
        quantity: 1.0,
        averageCost: 199.99,
        currency: Currency.USD,
      })

      expect(toDecimalString).toHaveBeenCalledWith(199.99)
      const createCall = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(createCall.data.averageCost).toBeInstanceOf(Prisma.Decimal)
    })

    it('should handle null notes', async () => {
      vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

      await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'GOOGL',
        quantity: 2.0,
        averageCost: 2500.0,
        currency: Currency.USD,
        // notes not provided
      })

      const createCall = vi.mocked(prisma.holding.create).mock.calls[0][0]
      expect(createCall.data.notes).toBeNull()
    })

    it('should use type casting (prisma as any).holding', async () => {
      vi.mocked(prisma.holding.create).mockResolvedValue({} as any)

      await createHolding({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AMZN',
        quantity: 1.0,
        averageCost: 3000.0,
        currency: Currency.USD,
      })

      // Verify the mock was called (proves (prisma as any) works)
      expect(prisma.holding.create).toHaveBeenCalled()
    })
  })

  describe('updateHolding', () => {
    it('should update holding with quantity, averageCost, and notes', async () => {
      const mockUpdated = {
        id: 'holding-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: new Prisma.Decimal('20.000000'),
        averageCost: new Prisma.Decimal('145.00'),
        currency: Currency.USD,
        notes: 'Updated notes',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.update).mockResolvedValue(mockUpdated)

      const result = await updateHolding({
        id: 'holding-1',
        quantity: 20.0,
        averageCost: 145.0,
        notes: 'Updated notes',
      })

      expect(toDecimalString).toHaveBeenCalledWith(145.0)
      expect(prisma.holding.update).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
        data: {
          quantity: expect.any(Prisma.Decimal),
          averageCost: expect.any(Prisma.Decimal),
          notes: 'Updated notes',
        },
      })
      expect(result).toEqual(mockUpdated)
    })

    it('should handle precision for both quantity (6) and averageCost (2)', async () => {
      vi.mocked(toDecimalString).mockReturnValue('99.99')
      vi.mocked(prisma.holding.update).mockResolvedValue({} as any)

      await updateHolding({
        id: 'holding-1',
        quantity: 5.123456,
        averageCost: 99.99,
      })

      expect(toDecimalString).toHaveBeenCalledWith(99.99)
      const updateCall = vi.mocked(prisma.holding.update).mock.calls[0][0]
      expect(updateCall.data.quantity).toBeInstanceOf(Prisma.Decimal)
      expect(updateCall.data.averageCost).toBeInstanceOf(Prisma.Decimal)
    })

    it('should only update quantity, averageCost, notes (not symbol/account/category)', async () => {
      vi.mocked(prisma.holding.update).mockResolvedValue({} as any)

      await updateHolding({
        id: 'holding-1',
        quantity: 10.0,
        averageCost: 100.0,
        notes: 'Test',
      })

      const updateCall = vi.mocked(prisma.holding.update).mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('symbol')
      expect(updateCall.data).not.toHaveProperty('accountId')
      expect(updateCall.data).not.toHaveProperty('categoryId')
      expect(updateCall.data).toHaveProperty('quantity')
      expect(updateCall.data).toHaveProperty('averageCost')
      expect(updateCall.data).toHaveProperty('notes')
    })

    it('should propagate Prisma error for non-existent holding', async () => {
      const prismaError = new Error('Record to update not found')
      vi.mocked(prisma.holding.update).mockRejectedValue(prismaError)

      await expect(
        updateHolding({
          id: 'non-existent',
          quantity: 1.0,
          averageCost: 100.0,
        }),
      ).rejects.toThrow('Record to update not found')
    })
  })

  describe('deleteHolding', () => {
    it('should delete holding by ID', async () => {
      const mockDeleted = {
        id: 'holding-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: new Prisma.Decimal('10.000000'),
        averageCost: new Prisma.Decimal('150.00'),
        currency: Currency.USD,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.delete).mockResolvedValue(mockDeleted)

      const result = await deleteHolding('holding-1')

      expect(prisma.holding.delete).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
      })
      expect(result).toEqual(mockDeleted)
    })

    it('should propagate Prisma error for non-existent holding', async () => {
      const prismaError = new Error('Record to delete does not exist')
      vi.mocked(prisma.holding.delete).mockRejectedValue(prismaError)

      await expect(deleteHolding('non-existent')).rejects.toThrow('Record to delete does not exist')
    })
  })

  describe('getHoldingById', () => {
    it('should return holding when found', async () => {
      const mockHolding = {
        id: 'holding-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        symbol: 'AAPL',
        quantity: new Prisma.Decimal('10.000000'),
        averageCost: new Prisma.Decimal('150.00'),
        currency: Currency.USD,
        notes: 'Test holding',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.holding.findUnique).mockResolvedValue(mockHolding)

      const result = await getHoldingById('holding-1')

      expect(prisma.holding.findUnique).toHaveBeenCalledWith({
        where: { id: 'holding-1' },
      })
      expect(result).toEqual(mockHolding)
    })

    it('should return null when holding not found', async () => {
      vi.mocked(prisma.holding.findUnique).mockResolvedValue(null)

      const result = await getHoldingById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getAccountHoldingSymbols', () => {
    it('should return unique symbols for multiple holdings', async () => {
      const mockHoldings = [{ symbol: 'AAPL' }, { symbol: 'GOOGL' }, { symbol: 'MSFT' }]

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as any)

      const result = await getAccountHoldingSymbols('acc-1')

      expect(prisma.holding.findMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        select: { symbol: true },
      })
      expect(result).toEqual(['AAPL', 'GOOGL', 'MSFT'])
    })

    it('should deduplicate symbols using Set', async () => {
      const mockHoldings = [
        { symbol: 'AAPL' },
        { symbol: 'AAPL' }, // Duplicate
        { symbol: 'GOOGL' },
        { symbol: 'AAPL' }, // Another duplicate
      ]

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as any)

      const result = await getAccountHoldingSymbols('acc-1')

      // Should only have unique symbols
      expect(result).toHaveLength(2)
      expect(result).toContain('AAPL')
      expect(result).toContain('GOOGL')
    })

    it('should return empty array when no holdings', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([])

      const result = await getAccountHoldingSymbols('acc-1')

      expect(result).toEqual([])
    })

    it('should use select optimization (only fetch symbols)', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([])

      await getAccountHoldingSymbols('acc-1')

      const findManyCall = vi.mocked(prisma.holding.findMany).mock.calls[0][0]
      expect(findManyCall.select).toEqual({ symbol: true })
    })
  })

  describe('refreshHoldingPrices', () => {
    it('should call stock API with symbols from holdings', async () => {
      const mockHoldings = [{ symbol: 'AAPL' }, { symbol: 'GOOGL' }]
      const mockRefreshResult = {
        updated: 2,
        skipped: 0,
        errors: [],
      }

      vi.mocked(prisma.holding.findMany).mockResolvedValue(mockHoldings as any)

      // Mock the dynamic import
      const { refreshStockPrices } = await import('@/lib/stock-api')
      vi.mocked(refreshStockPrices).mockResolvedValue(mockRefreshResult)

      const result = await refreshHoldingPrices({ accountId: 'acc-1' })

      expect(refreshStockPrices).toHaveBeenCalledWith(['AAPL', 'GOOGL'])
      expect(result).toEqual(mockRefreshResult)
    })

    it('should return {updated: 0} when no holdings', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([])

      const result = await refreshHoldingPrices({ accountId: 'acc-1' })

      // Should not call stock API
      const { refreshStockPrices } = await import('@/lib/stock-api')
      expect(refreshStockPrices).not.toHaveBeenCalled()
      expect(result).toEqual({ updated: 0, skipped: 0, errors: [] })
    })

    it('should use dynamic import pattern', async () => {
      vi.mocked(prisma.holding.findMany).mockResolvedValue([{ symbol: 'AAPL' }] as any)

      const { refreshStockPrices } = await import('@/lib/stock-api')
      vi.mocked(refreshStockPrices).mockResolvedValue({
        updated: 1,
        skipped: 0,
        errors: [],
      })

      await refreshHoldingPrices({ accountId: 'acc-1' })

      // Verify dynamic import was used (function was called)
      expect(refreshStockPrices).toHaveBeenCalled()
    })
  })

  describe('validateHoldingCategory', () => {
    it('should return true when category has isHolding=true', async () => {
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

      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory)

      const result = await validateHoldingCategory('cat-1')

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      })
      expect(result).toBe(true)
    })

    it('should throw error when category isHolding=false', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Regular Category',
        type: 'EXPENSE' as const,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory)

      await expect(validateHoldingCategory('cat-1')).rejects.toThrow('Category must be marked as a holding category')
    })

    it('should throw error when category not found', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null)

      await expect(validateHoldingCategory('non-existent')).rejects.toThrow('Category not found')
    })
  })

  describe('validateStockSymbol', () => {
    it('should call fetchStockQuote for API validation', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      vi.mocked(fetchStockQuote).mockResolvedValue({
        symbol: 'AAPL',
        price: 150.0,
        currency: 'USD',
        changePercent: 1.5,
        volume: 1000000,
        fetchedAt: new Date(),
      })

      await validateStockSymbol('AAPL')

      expect(fetchStockQuote).toHaveBeenCalledWith('AAPL')
    })
  })
})
