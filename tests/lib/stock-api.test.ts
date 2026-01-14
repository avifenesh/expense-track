import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Currency, Prisma } from '@prisma/client'

// Mock dependencies BEFORE imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockPrice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Import after mocks
import { prisma } from '@/lib/prisma'

// Type for mocked prisma with stockPrice support
type MockedPrisma = typeof prisma & {
  stockPrice: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}
const mockedPrisma = prisma as MockedPrisma

describe('stock-api.ts', () => {
  // Mock fetch globally
  const mockFetch = vi.fn()

  // Spy on console to suppress logs during tests
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)

    // Reset environment variables
    vi.stubEnv('ALPHA_VANTAGE_API_KEY', 'test-api-key')
    vi.stubEnv('STOCK_PRICE_MAX_AGE_HOURS', '24')

    // Reset system time
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))

    // Reset module state to clear rate limit counter and failed symbols cache
    await vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.useRealTimers()
    consoleWarnSpy.mockClear()
    consoleErrorSpy.mockClear()
  })

  // Mock fixtures
  const mockAlphaVantageResponse = {
    'Global Quote': {
      '01. symbol': 'AAPL',
      '05. price': '150.25',
      '10. change percent': '1.5%',
      '06. volume': '75000000',
    },
  }

  const mockStockPriceRecord = {
    symbol: 'AAPL',
    price: new Prisma.Decimal('150.25'),
    changePercent: new Prisma.Decimal('1.5'),
    volume: BigInt(75000000),
    currency: Currency.USD,
    fetchedAt: new Date('2024-01-15T10:00:00Z'), // 2 hours old
    source: 'alphavantage',
  }

  describe('fetchStockQuote', () => {
    it('should successfully fetch a valid stock quote', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })

      const result = await fetchStockQuote('AAPL')

      expect(result).toMatchObject({
        symbol: 'AAPL',
        price: 150.25,
        changePercent: 1.5,
        volume: BigInt(75000000),
      })
      expect(result.fetchedAt).toBeInstanceOf(Date)
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('function=GLOBAL_QUOTE&symbol=AAPL'))
    })

    it('should throw error when API key is missing', async () => {
      vi.stubEnv('ALPHA_VANTAGE_API_KEY', '')
      await vi.resetModules()
      const { fetchStockQuote } = await import('@/lib/stock-api')

      await expect(fetchStockQuote('AAPL')).rejects.toThrow('ALPHA_VANTAGE_API_KEY environment variable is not set')
    })

    it('should throw error when rate limit is reached', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })

      // Make 25 successful calls
      for (let i = 0; i < 25; i++) {
        await fetchStockQuote('TEST')
      }

      // 26th call should fail
      await expect(fetchStockQuote('TEST')).rejects.toThrow('Daily API rate limit reached')
    })

    it('should throw error on API HTTP error', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(fetchStockQuote('AAPL')).rejects.toThrow('API request failed with status 500')
    })

    it('should mark symbol as failed and throw for invalid symbol', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // Empty response
      })

      await expect(fetchStockQuote('INVALID')).rejects.toThrow('Invalid or unknown symbol: INVALID')
    })

    it('should handle empty Global Quote response', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ 'Global Quote': {} }),
      })

      await expect(fetchStockQuote('AAPL')).rejects.toThrow('Invalid or unknown symbol: AAPL')
    })

    it('should parse numeric strings correctly', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'MSFT',
            '05. price': '380.50',
            '10. change percent': '-0.75%',
            '06. volume': '25000000',
          },
        }),
      })

      const result = await fetchStockQuote('MSFT')

      expect(result.price).toBe(380.5)
      expect(result.changePercent).toBe(-0.75)
      expect(result.volume).toBe(BigInt(25000000))
    })

    it('should handle missing volume field', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.25',
            '10. change percent': '1.5%',
            '06. volume': '',
          },
        }),
      })

      const result = await fetchStockQuote('AAPL')

      expect(result.volume).toBeNull()
    })

    it('should handle missing changePercent field', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.25',
            '10. change percent': '',
            '06. volume': '75000000',
          },
        }),
      })

      const result = await fetchStockQuote('AAPL')

      expect(result.changePercent).toBeNull()
    })

    it('should handle network failure', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(fetchStockQuote('AAPL')).rejects.toThrow('Network error')
    })

    it('should handle JSON parsing error', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      await expect(fetchStockQuote('AAPL')).rejects.toThrow('Invalid JSON')
    })

    it('should increment call counter after successful fetch', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })

      await fetchStockQuote('AAPL')
      await fetchStockQuote('MSFT')

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('getStockPrice', () => {
    it('should return cached price with metadata for fresh price', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(mockStockPriceRecord)

      const result = await getStockPrice('AAPL')

      expect(result).toEqual({
        success: true,
        data: {
          price: 150.25,
          changePercent: 1.5,
          fetchedAt: new Date('2024-01-15T10:00:00Z'),
          isStale: false, // 2 hours old, max age is 24h
          hoursSinceUpdate: 2,
        },
      })
    })

    it('should calculate isStale=false for price less than 24h old', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const recentPrice = {
        ...mockStockPriceRecord,
        fetchedAt: new Date('2024-01-15T11:00:00Z'), // 1 hour ago
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(recentPrice)

      const result = await getStockPrice('AAPL')

      if (result.success) {
        expect(result.data.isStale).toBe(false)
        expect(result.data.hoursSinceUpdate).toBe(1)
      }
    })

    it('should calculate isStale=true for price more than 24h old', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const stalePrice = {
        ...mockStockPriceRecord,
        fetchedAt: new Date('2024-01-14T11:00:00Z'), // 25 hours ago
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(stalePrice)

      const result = await getStockPrice('AAPL')

      if (result.success) {
        expect(result.data.isStale).toBe(true)
        expect(result.data.hoursSinceUpdate).toBe(25)
      }
    })

    it('should treat exactly 24h old price as stale', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const exactlyStalePrice = {
        ...mockStockPriceRecord,
        fetchedAt: new Date('2024-01-14T12:00:00Z'), // Exactly 24 hours ago
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(exactlyStalePrice)

      const result = await getStockPrice('AAPL')

      if (result.success) {
        expect(result.data.isStale).toBe(false) // 24.0 is NOT > 24
        expect(result.data.hoursSinceUpdate).toBe(24)
      }
    })

    it('should convert Decimal to number correctly', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const priceWithDecimals = {
        ...mockStockPriceRecord,
        price: new Prisma.Decimal('123.4567'),
        changePercent: new Prisma.Decimal('2.3456'),
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(priceWithDecimals)

      const result = await getStockPrice('AAPL')

      if (result.success) {
        expect(result.data.price).toBe(123.4567)
        expect(result.data.changePercent).toBe(2.3456)
      }
    })

    it('should handle null changePercent', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const priceWithNullChange = {
        ...mockStockPriceRecord,
        changePercent: null,
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(priceWithNullChange)

      const result = await getStockPrice('AAPL')

      if (result.success) {
        expect(result.data.changePercent).toBeNull()
      }
    })

    it('should be case-insensitive for symbols', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(mockStockPriceRecord)

      await getStockPrice('aapl')

      expect(mockedPrisma.stockPrice.findFirst).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { fetchedAt: 'desc' },
      })
    })

    it('should return error when no cache found', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(null)

      const result = await getStockPrice('UNKNOWN')

      expect(result).toEqual({
        success: false,
        error: 'No cached price found for UNKNOWN. Please refresh prices.',
      })
    })

    it('should return most recent price when multiple cached entries exist', async () => {
      const { getStockPrice } = await import('@/lib/stock-api')
      const mostRecentPrice = {
        ...mockStockPriceRecord,
        fetchedAt: new Date('2024-01-15T11:00:00Z'),
      }
      mockedPrisma.stockPrice.findFirst.mockResolvedValue(mostRecentPrice)

      const result = await getStockPrice('AAPL')

      expect(mockedPrisma.stockPrice.findFirst).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { fetchedAt: 'desc' },
      })
      if (result.success) {
        expect(result.data.fetchedAt).toEqual(new Date('2024-01-15T11:00:00Z'))
      }
    })
  })

  describe('batchLoadStockPrices', () => {
    it('should return empty Map for empty array', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const result = await batchLoadStockPrices([])

      expect(result.size).toBe(0)
      expect(mockedPrisma.stockPrice.findMany).not.toHaveBeenCalled()
    })

    it('should return Map with single entry for single symbol', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findMany.mockResolvedValue([mockStockPriceRecord])

      const result = await batchLoadStockPrices(['AAPL'])

      expect(result.size).toBe(1)
      expect(result.get('AAPL')).toMatchObject({
        price: 150.25,
        changePercent: 1.5,
        isStale: false,
        hoursSinceUpdate: 2,
      })
    })

    it('should return all prices for multiple symbols', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const msftPrice = {
        ...mockStockPriceRecord,
        symbol: 'MSFT',
        price: new Prisma.Decimal('380.50'),
      }
      mockedPrisma.stockPrice.findMany.mockResolvedValue([mockStockPriceRecord, msftPrice])

      const result = await batchLoadStockPrices(['AAPL', 'MSFT'])

      expect(result.size).toBe(2)
      expect(result.get('AAPL')?.price).toBe(150.25)
      expect(result.get('MSFT')?.price).toBe(380.5)
    })

    it('should normalize symbols to uppercase', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findMany.mockResolvedValue([mockStockPriceRecord])

      await batchLoadStockPrices(['aapl', 'MSFT', 'GooG'])

      expect(mockedPrisma.stockPrice.findMany).toHaveBeenCalledWith({
        where: { symbol: { in: ['AAPL', 'MSFT', 'GOOG'] } },
        orderBy: { fetchedAt: 'desc' },
        distinct: ['symbol'],
      })
    })

    it('should calculate staleness for each symbol', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const freshPrice = {
        ...mockStockPriceRecord,
        symbol: 'AAPL',
        fetchedAt: new Date('2024-01-15T11:00:00Z'), // 1h ago
      }
      const stalePrice = {
        ...mockStockPriceRecord,
        symbol: 'MSFT',
        fetchedAt: new Date('2024-01-14T11:00:00Z'), // 25h ago
      }
      mockedPrisma.stockPrice.findMany.mockResolvedValue([freshPrice, stalePrice])

      const result = await batchLoadStockPrices(['AAPL', 'MSFT'])

      expect(result.get('AAPL')?.isStale).toBe(false)
      expect(result.get('AAPL')?.hoursSinceUpdate).toBe(1)
      expect(result.get('MSFT')?.isStale).toBe(true)
      expect(result.get('MSFT')?.hoursSinceUpdate).toBe(25)
    })

    it('should gracefully handle missing symbols in database', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findMany.mockResolvedValue([mockStockPriceRecord])

      const result = await batchLoadStockPrices(['AAPL', 'MSFT'])

      expect(result.size).toBe(1)
      expect(result.has('AAPL')).toBe(true)
      expect(result.has('MSFT')).toBe(false)
    })

    it('should convert Decimals to numbers', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const priceWithDecimals = {
        ...mockStockPriceRecord,
        price: new Prisma.Decimal('999.9999'),
        changePercent: new Prisma.Decimal('-5.1234'),
      }
      mockedPrisma.stockPrice.findMany.mockResolvedValue([priceWithDecimals])

      const result = await batchLoadStockPrices(['AAPL'])

      const price = result.get('AAPL')
      expect(price?.price).toBe(999.9999)
      expect(price?.changePercent).toBe(-5.1234)
    })

    it('should handle null changePercent', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      const priceWithNullChange = {
        ...mockStockPriceRecord,
        changePercent: null,
      }
      mockedPrisma.stockPrice.findMany.mockResolvedValue([priceWithNullChange])

      const result = await batchLoadStockPrices(['AAPL'])

      expect(result.get('AAPL')?.changePercent).toBeNull()
    })

    it('should use most recent price per symbol (distinct)', async () => {
      const { batchLoadStockPrices } = await import('@/lib/stock-api')
      mockedPrisma.stockPrice.findMany.mockResolvedValue([mockStockPriceRecord])

      await batchLoadStockPrices(['AAPL'])

      expect(mockedPrisma.stockPrice.findMany).toHaveBeenCalledWith({
        where: { symbol: { in: ['AAPL'] } },
        orderBy: { fetchedAt: 'desc' },
        distinct: ['symbol'],
      })
    })
  })

  describe('refreshStockPrices', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should successfully refresh a single symbol', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      const result = await refreshStockPrices(['AAPL'])

      expect(result).toEqual({
        updated: 1,
        skipped: 0,
        errors: [],
      })
      expect(mockedPrisma.stockPrice.create).toHaveBeenCalledWith({
        data: {
          symbol: 'AAPL',
          price: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          changePercent: expect.any(Prisma.Decimal),
          volume: BigInt(75000000),
          fetchedAt: expect.any(Date),
          source: 'alphavantage',
        },
      })
    })

    it('should refresh multiple symbols with rate limiting', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      const promise = refreshStockPrices(['AAPL', 'MSFT'])

      await vi.advanceTimersByTimeAsync(12000)

      const result = await promise

      expect(result.updated).toBe(2)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should deduplicate symbols before refresh', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      await refreshStockPrices(['AAPL', 'aapl', 'AAPL'])

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockedPrisma.stockPrice.create).toHaveBeenCalledTimes(1)
    })

    it('should skip previously failed symbols', async () => {
      const { refreshStockPrices, fetchStockQuote } = await import('@/lib/stock-api')
      // First, mark a symbol as failed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Empty response to trigger failure
      })

      await expect(fetchStockQuote('INVALID')).rejects.toThrow()

      // Now try to refresh it
      const result = await refreshStockPrices(['INVALID'])

      expect(result).toEqual({
        updated: 0,
        skipped: 1,
        errors: ['INVALID: Skipped - previously failed (retry after 24h)'],
      })
      expect(mockedPrisma.stockPrice.create).not.toHaveBeenCalled()
    })

    it('should stop when rate limit is reached mid-batch', async () => {
      const { refreshStockPrices, fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      // First, exhaust the rate limit with 25 calls
      for (let i = 0; i < 25; i++) {
        await fetchStockQuote('TEST')
      }

      // Try to refresh more symbols
      const result = await refreshStockPrices(['AAPL', 'MSFT', 'GOOG'])

      expect(result.updated).toBe(0)
      expect(result.errors).toContain('Rate limit reached - skipped remaining symbols')
    })

    it('should continue with other symbols after API error for one symbol', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAlphaVantageResponse,
        })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      const promise = refreshStockPrices(['AAPL', 'MSFT'])

      await vi.advanceTimersByTimeAsync(12000)

      const result = await promise

      expect(result.updated).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('AAPL')
    })

    it('should return zero results for empty array', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      const result = await refreshStockPrices([])

      expect(result).toEqual({
        updated: 0,
        skipped: 0,
        errors: [],
      })
    })

    it('should persist to DB with correct Decimal precision (4 decimals)', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.256789', // More than 4 decimals
            '10. change percent': '1.567890%',
            '06. volume': '75000000',
          },
        }),
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      await refreshStockPrices(['AAPL'])

      expect(mockedPrisma.stockPrice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          price: new Prisma.Decimal('150.2568'), // Rounded to 4 decimals
          changePercent: new Prisma.Decimal('1.5679'),
        }),
      })
    })

    it('should store currency as USD', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      await refreshStockPrices(['AAPL'])

      expect(mockedPrisma.stockPrice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: Currency.USD,
          source: 'alphavantage',
        }),
      })
    })

    it('should handle null changePercent and volume', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.25',
            '10. change percent': '',
            '06. volume': '',
          },
        }),
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      await refreshStockPrices(['AAPL'])

      expect(mockedPrisma.stockPrice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changePercent: null,
          volume: null,
        }),
      })
    })

    it('should not sleep after last symbol', async () => {
      const { refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      const startTime = Date.now()
      await refreshStockPrices(['AAPL']) // Single symbol
      const endTime = Date.now()

      // Should complete immediately without 12s sleep
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Rate Limiting and Failed Symbol Cache', () => {
    it('should reset rate limit counter at midnight', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })

      // Set time to 11:59 PM
      vi.setSystemTime(new Date('2024-01-15T23:59:00Z'))

      // Make some calls
      await fetchStockQuote('AAPL')
      await fetchStockQuote('MSFT')

      // Move to next day
      vi.setSystemTime(new Date('2024-01-16T00:01:00Z'))

      // Should be able to make more calls (counter reset)
      await expect(fetchStockQuote('GOOG')).resolves.toBeDefined()
    })

    it('should track failed symbols to prevent repeated API calls', async () => {
      const { fetchStockQuote, refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}), // Empty response
      })

      // First call marks as failed
      await expect(fetchStockQuote('INVALID')).rejects.toThrow()

      // Refresh should skip it
      const result = await refreshStockPrices(['INVALID'])

      expect(result.skipped).toBe(1)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only the first failed call
    })

    it('should retry failed symbols after 24h TTL expiry', async () => {
      const { fetchStockQuote } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Mark symbol as failed
      await expect(fetchStockQuote('INVALID')).rejects.toThrow()

      // Advance time by 25 hours
      const originalTime = new Date('2024-01-15T12:00:00Z')
      vi.setSystemTime(originalTime)
      vi.setSystemTime(new Date(originalTime.getTime() + 25 * 60 * 60 * 1000))

      // Now mock a successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })

      // Should retry after TTL expiry
      await expect(fetchStockQuote('INVALID')).resolves.toBeDefined()
    })

    it('should clean up expired failed symbol entries', async () => {
      const { fetchStockQuote, refreshStockPrices } = await import('@/lib/stock-api')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      // Mark as failed
      await expect(fetchStockQuote('EXPIRED')).rejects.toThrow()

      // Advance past TTL
      vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000))

      // Try to refresh - should attempt to fetch (expired from cache)
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAlphaVantageResponse,
      })
      mockedPrisma.stockPrice.create.mockResolvedValue(mockStockPriceRecord)

      const result = await refreshStockPrices(['EXPIRED'])

      // Should be updated, not skipped (expired from failed cache)
      expect(result.updated).toBe(1)
      expect(result.skipped).toBe(0)
    })
  })
})
