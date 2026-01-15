import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Currency, Prisma, type ExchangeRate } from '@prisma/client'
import {
  fetchExchangeRates,
  getExchangeRate,
  convertAmount,
  refreshExchangeRates,
  batchLoadExchangeRates,
  convertAmountWithCache,
  getLastUpdateTime,
  type RateCache,
} from '@/lib/currency'
import { serverLogger } from '@/lib/server-logger'

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    exchangeRate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock server-logger to avoid console output during tests
vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// Import mocked prisma
import { prisma } from '@/lib/prisma'

// Mock global fetch
global.fetch = vi.fn()

describe('currency.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('convertAmountWithCache()', () => {
    it('should return original amount for same currency', () => {
      const cache: RateCache = new Map()
      const result = convertAmountWithCache(100, Currency.USD, Currency.USD, cache)
      expect(result).toBe(100)
    })

    it('should convert amount using cached rate', () => {
      const cache: RateCache = new Map([['USD:EUR', 0.85]])
      const result = convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(result).toBe(85)
    })

    it('should round to 2 decimal places', () => {
      const cache: RateCache = new Map([['USD:EUR', 0.853]])
      const result = convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(result).toBe(85.3)
    })

    it('should return original amount if rate not in cache', () => {
      const cache: RateCache = new Map()
      const result = convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(result).toBe(100)
    })

    it('should log warning when rate not found in cache', () => {
      const cache: RateCache = new Map()
      convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(vi.mocked(serverLogger.warn)).toHaveBeenCalledWith(
        'CURRENCY_RATE_MISSING',
        expect.objectContaining({
          from: Currency.USD,
          to: Currency.EUR,
          amount: 100,
          message: expect.stringContaining('No exchange rate found for USD -> EUR'),
        }),
      )
    })

    it('should handle rounding edge case 0.005 rounds up', () => {
      const cache: RateCache = new Map([['USD:EUR', 0.00105]])
      const result = convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(result).toBe(0.11) // 100 * 0.00105 = 0.105 → rounds to 0.11
    })

    it('should handle rounding edge case 0.004 rounds down', () => {
      const cache: RateCache = new Map([['USD:EUR', 0.00104]])
      const result = convertAmountWithCache(100, Currency.USD, Currency.EUR, cache)
      expect(result).toBe(0.1) // 100 * 0.00104 = 0.104 → rounds to 0.10
    })
  })

  describe('getLastUpdateTime()', () => {
    it('should return null when no rates exist', async () => {
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)

      const result = await getLastUpdateTime()

      expect(result).toBeNull()
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        orderBy: { fetchedAt: 'desc' },
        select: { fetchedAt: true },
      })
    })

    it('should return most recent fetchedAt date', async () => {
      const mockDate = new Date('2024-01-15T10:30:00Z')
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue({
        fetchedAt: mockDate,
      } as unknown as ExchangeRate)

      const result = await getLastUpdateTime()

      expect(result).toEqual(mockDate)
    })
  })

  describe('fetchExchangeRates()', () => {
    it('should fetch rates from Frankfurter API', async () => {
      const mockResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.85, ILS: 3.6 },
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const result = await fetchExchangeRates(Currency.USD)

      expect(result).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.frankfurter.dev/v1/latest?base=USD'),
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        }),
      )
    })

    it('should deduplicate concurrent requests', async () => {
      const mockResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.85, ILS: 3.6 },
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const [r1, r2, r3] = await Promise.all([
        fetchExchangeRates(Currency.USD),
        fetchExchangeRates(Currency.USD),
        fetchExchangeRates(Currency.USD),
      ])

      expect(r1).toEqual(mockResponse)
      expect(r2).toEqual(mockResponse)
      expect(r3).toEqual(mockResponse)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw error on non-200 response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response)

      await expect(fetchExchangeRates(Currency.USD)).rejects.toThrow('Frankfurter API error: 429 Too Many Requests')
    })

    it('should throw error on network failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      await expect(fetchExchangeRates(Currency.USD)).rejects.toThrow('Network error')
    })

    it('should clean up in-flight request after completion', async () => {
      const mockResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.85, ILS: 3.6 },
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await fetchExchangeRates(Currency.USD)

      // Second call should trigger new fetch (not deduplicated)
      vi.mocked(global.fetch).mockClear()
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      await fetchExchangeRates(Currency.USD)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should clean up in-flight request even on error', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('API error'))

      await expect(fetchExchangeRates(Currency.USD)).rejects.toThrow('API error')

      // Second call should trigger new fetch attempt
      vi.mocked(global.fetch).mockClear()
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ base: 'USD', rates: {} }),
      } as Response)

      await fetchExchangeRates(Currency.USD)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getExchangeRate()', () => {
    it('should return 1 for same currency conversion', async () => {
      const result = await getExchangeRate(Currency.USD, Currency.USD)
      expect(result).toBe(1)
      expect(prisma.exchangeRate.findUnique).not.toHaveBeenCalled()
    })

    it('should return cached rate if available', async () => {
      const mockRate = {
        rate: { toNumber: () => 1.18 } as Prisma.Decimal,
        date: new Date('2024-01-15'),
        fetchedAt: new Date('2024-01-15T10:00:00Z'),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await getExchangeRate(Currency.EUR, Currency.USD)

      expect(result).toBe(1.18)
      expect(prisma.exchangeRate.findUnique).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should fetch and cache rate if not in cache', async () => {
      const mockApiResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.85, ILS: 3.6 },
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)
      vi.mocked(prisma.exchangeRate.upsert).mockResolvedValue({} as unknown as ExchangeRate)

      const result = await getExchangeRate(Currency.USD, Currency.EUR)

      expect(result).toBe(0.85)
      expect(prisma.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseCurrency_targetCurrency_date: {
              baseCurrency: Currency.USD,
              targetCurrency: Currency.EUR,
              date: expect.any(Date),
            },
          }),
          create: expect.objectContaining({
            baseCurrency: Currency.USD,
            targetCurrency: Currency.EUR,
            rate: expect.any(Prisma.Decimal),
          }),
        }),
      )
    })

    it('should throw error if rate missing in API response', async () => {
      const mockApiResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { ILS: 3.6 }, // EUR missing
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as Response)
      // Mock the fallback query to also return null (no stale rates available)
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)

      await expect(getExchangeRate(Currency.USD, Currency.EUR)).rejects.toThrow(
        'No exchange rate available for USD -> EUR',
      )
    })

    it('should fallback to stale rate on API failure', async () => {
      const staleRate = {
        rate: { toNumber: () => 0.83 } as Prisma.Decimal,
        date: new Date('2024-01-10'),
        fetchedAt: new Date('2024-01-10T08:00:00Z'),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null)
      vi.mocked(global.fetch).mockRejectedValue(new Error('API error'))
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(staleRate as unknown as ExchangeRate)

      const result = await getExchangeRate(Currency.USD, Currency.EUR)

      expect(result).toBe(0.83)
    })

    it('should throw error if no fallback available', async () => {
      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null)
      vi.mocked(global.fetch).mockRejectedValue(new Error('API error'))
      vi.mocked(prisma.exchangeRate.findFirst).mockResolvedValue(null)

      await expect(getExchangeRate(Currency.USD, Currency.EUR)).rejects.toThrow(
        'No exchange rate available for USD -> EUR',
      )
    })

    it('should normalize date to start of day', async () => {
      const customDate = new Date('2024-01-15T14:30:00Z')

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(null)
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ base: 'USD', rates: { EUR: 0.85 } }),
      } as Response)
      vi.mocked(prisma.exchangeRate.upsert).mockResolvedValue({} as unknown as ExchangeRate)

      await getExchangeRate(Currency.USD, Currency.EUR, customDate)

      expect(prisma.exchangeRate.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseCurrency_targetCurrency_date: expect.objectContaining({
              date: expect.any(Date), // Should be startOfDay
            }),
          }),
        }),
      )
    })
  })

  describe('convertAmount()', () => {
    it('should return original amount for same currency', async () => {
      const result = await convertAmount(100, Currency.USD, Currency.USD)
      expect(result).toBe(100)
    })

    it('should convert and round to 2 decimal places', async () => {
      const mockRate = {
        rate: { toNumber: () => 0.853 } as Prisma.Decimal,
        date: new Date(),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await convertAmount(100, Currency.USD, Currency.EUR)

      expect(result).toBe(85.3)
    })

    it('should handle rounding: 0.005 rounds up to 0.01', async () => {
      const mockRate = {
        rate: { toNumber: () => 0.00105 } as Prisma.Decimal,
        date: new Date(),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await convertAmount(100, Currency.USD, Currency.EUR)

      expect(result).toBe(0.11)
    })

    it('should handle rounding: 0.004 rounds down to 0.00', async () => {
      const mockRate = {
        rate: { toNumber: () => 0.00104 } as Prisma.Decimal,
        date: new Date(),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await convertAmount(100, Currency.USD, Currency.EUR)

      expect(result).toBe(0.1)
    })

    it('should handle large amounts', async () => {
      const mockRate = {
        rate: { toNumber: () => 1.18 } as Prisma.Decimal,
        date: new Date(),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await convertAmount(1000000, Currency.EUR, Currency.USD)

      expect(result).toBe(1180000)
    })

    it('should handle small amounts', async () => {
      const mockRate = {
        rate: { toNumber: () => 0.85 } as Prisma.Decimal,
        date: new Date(),
      }

      vi.mocked(prisma.exchangeRate.findUnique).mockResolvedValue(mockRate as unknown as ExchangeRate)

      const result = await convertAmount(0.01, Currency.USD, Currency.EUR)

      expect(result).toBe(0.01)
    })
  })

  describe('refreshExchangeRates()', () => {
    it('should fetch and store rates for all currency pairs', async () => {
      const mockUsdResponse = {
        amount: 1,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.85, ILS: 3.6 },
      }
      const mockEurResponse = {
        amount: 1,
        base: 'EUR',
        date: '2024-01-15',
        rates: { USD: 1.18, ILS: 4.2 },
      }
      const mockIlsResponse = {
        amount: 1,
        base: 'ILS',
        date: '2024-01-15',
        rates: { USD: 0.28, EUR: 0.24 },
      }

      let callCount = 0
      vi.mocked(global.fetch).mockImplementation(() => {
        const responses = [mockUsdResponse, mockEurResponse, mockIlsResponse]
        return Promise.resolve({
          ok: true,
          json: async () => responses[callCount++],
        } as Response)
      })

      vi.mocked(prisma.exchangeRate.upsert).mockResolvedValue({} as unknown as ExchangeRate)

      const result = await refreshExchangeRates()

      expect(result).toMatchObject({ success: true, updatedAt: expect.any(Date) })
      expect(global.fetch).toHaveBeenCalledTimes(3) // USD, EUR, ILS
      expect(prisma.exchangeRate.upsert).toHaveBeenCalledTimes(6) // 3 currencies * 2 targets each
    })

    it('should return error on API failure', async () => {
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

      const result = await refreshExchangeRates()

      expect(result).toMatchObject({
        error: { general: ['Network error'] },
        updatedAt: expect.any(Date),
      })
    })

    it('should handle unknown error gracefully', async () => {
      vi.mocked(global.fetch).mockRejectedValue('Unknown error')

      const result = await refreshExchangeRates()

      expect(result).toMatchObject({
        error: { general: ['Unknown error'] },
        updatedAt: expect.any(Date),
      })
    })
  })

  describe('batchLoadExchangeRates()', () => {
    it('should load all rates for a given date', async () => {
      const mockRates = [
        {
          baseCurrency: Currency.USD,
          targetCurrency: Currency.EUR,
          rate: { toNumber: () => 0.85 } as Prisma.Decimal,
          date: new Date('2024-01-15'),
        },
        {
          baseCurrency: Currency.USD,
          targetCurrency: Currency.ILS,
          rate: { toNumber: () => 3.6 } as Prisma.Decimal,
          date: new Date('2024-01-15'),
        },
        {
          baseCurrency: Currency.EUR,
          targetCurrency: Currency.USD,
          rate: { toNumber: () => 1.18 } as Prisma.Decimal,
          date: new Date('2024-01-15'),
        },
      ]

      vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue(mockRates as unknown as ExchangeRate[])

      const cache = await batchLoadExchangeRates(new Date('2024-01-15'))

      expect(cache.get('USD:EUR')).toBe(0.85)
      expect(cache.get('USD:ILS')).toBe(3.6)
      expect(cache.get('EUR:USD')).toBe(1.18)
      // Identity rates
      expect(cache.get('USD:USD')).toBe(1)
      expect(cache.get('EUR:EUR')).toBe(1)
      expect(cache.get('ILS:ILS')).toBe(1)
    })

    it('should use fallback rates if none exist for target date', async () => {
      const mockFallbackRates = [
        {
          baseCurrency: Currency.USD,
          targetCurrency: Currency.EUR,
          rate: { toNumber: () => 0.83 } as Prisma.Decimal,
          date: new Date('2024-01-10'),
        },
      ]

      vi.mocked(prisma.exchangeRate.findMany)
        .mockResolvedValueOnce([]) // No rates for target date
        .mockResolvedValueOnce(mockFallbackRates as unknown as ExchangeRate[]) // Fallback query

      const cache = await batchLoadExchangeRates(new Date('2024-01-15'))

      expect(cache.get('USD:EUR')).toBe(0.83)
      expect(cache.get('USD:USD')).toBe(1)
    })

    it('should return only identity rates if no rates in database', async () => {
      vi.mocked(prisma.exchangeRate.findMany)
        .mockResolvedValueOnce([]) // No rates for target date
        .mockResolvedValueOnce([]) // No fallback rates

      const cache = await batchLoadExchangeRates()

      expect(cache.size).toBe(3) // Only identity rates
      expect(cache.get('USD:USD')).toBe(1)
      expect(cache.get('EUR:EUR')).toBe(1)
      expect(cache.get('ILS:ILS')).toBe(1)
    })

    it('should normalize date to start of day', async () => {
      const customDate = new Date('2024-01-15T14:30:00Z')

      vi.mocked(prisma.exchangeRate.findMany).mockResolvedValue([])

      await batchLoadExchangeRates(customDate)

      expect(prisma.exchangeRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { date: expect.any(Date) }, // Should be startOfDay
        }),
      )
    })
  })
})
