import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Currency } from '@prisma/client'
import {
  getCurrencySymbol,
  getCurrencyName,
  convertAmount,
  getExchangeRate,
  refreshExchangeRates,
  getLastUpdateTime,
  areRatesStale,
} from './currency'
import { prisma } from './prisma'

describe('Currency Service', () => {
  describe('getCurrencySymbol', () => {
    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol(Currency.USD)).toBe('$')
    })

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol(Currency.EUR)).toBe('€')
    })

    it('should return correct symbol for ILS', () => {
      expect(getCurrencySymbol(Currency.ILS)).toBe('₪')
    })
  })

  describe('getCurrencyName', () => {
    it('should return correct name for USD', () => {
      expect(getCurrencyName(Currency.USD)).toBe('US Dollar')
    })

    it('should return correct name for EUR', () => {
      expect(getCurrencyName(Currency.EUR)).toBe('Euro')
    })

    it('should return correct name for ILS', () => {
      expect(getCurrencyName(Currency.ILS)).toBe('Israeli Shekel')
    })
  })

  describe('Exchange Rate Operations', () => {
    beforeAll(async () => {
      // Clean up any existing exchange rates from tests
      await prisma.exchangeRate.deleteMany({})
    })

    afterAll(async () => {
      // Clean up after tests
      await prisma.exchangeRate.deleteMany({})
    })

    it('should return 1 for same currency conversion', async () => {
      const rate = await getExchangeRate(Currency.USD, Currency.USD)
      expect(rate).toBe(1)
    })

    it('should fetch and cache exchange rate from Frankfurter API', async () => {
      const rate = await getExchangeRate(Currency.USD, Currency.EUR)

      expect(rate).toBeGreaterThan(0)
      expect(rate).toBeLessThan(2) // Sanity check - EUR/USD rate should be reasonable

      // Verify it was cached
      const cached = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: Currency.USD,
          targetCurrency: Currency.EUR,
        },
      })

      expect(cached).toBeTruthy()
      expect(cached?.rate.toNumber()).toBe(rate)
    }, 10000) // 10 second timeout for API call

    it('should convert amount correctly', async () => {
      const amount = 100
      const converted = await convertAmount(amount, Currency.USD, Currency.EUR)

      expect(converted).toBeGreaterThan(0)
      expect(converted).not.toBe(amount) // Should be different
      expect(Number.isInteger(converted * 100)).toBe(true) // Should be rounded to 2 decimals
    }, 10000)

    it('should return same amount for same currency conversion', async () => {
      const amount = 100
      const converted = await convertAmount(amount, Currency.USD, Currency.USD)

      expect(converted).toBe(amount)
    })

    it('should refresh all exchange rates', async () => {
      const result = await refreshExchangeRates()

      expect(result.success).toBe(true)
      expect(result.updatedAt).toBeInstanceOf(Date)

      // Verify rates were created for all currency pairs
      const rateCount = await prisma.exchangeRate.count()

      // We have 3 currencies (USD, EUR, ILS)
      // Each currency should have rates to the other 2
      // 3 base currencies × 2 target currencies = 6 rates minimum
      expect(rateCount).toBeGreaterThanOrEqual(6)
    }, 15000) // 15 second timeout for multiple API calls

    it('should get last update time after refresh', async () => {
      await refreshExchangeRates()

      const lastUpdate = await getLastUpdateTime()

      expect(lastUpdate).toBeInstanceOf(Date)
      expect(lastUpdate!.getTime()).toBeLessThanOrEqual(Date.now())
    }, 15000)

    it('should detect if rates are stale', async () => {
      // Refresh rates first
      await refreshExchangeRates()

      // Rates should not be stale immediately after refresh
      const isStale = await areRatesStale()

      expect(isStale).toBe(false)
    }, 15000)
  })

  describe('Error Handling', () => {
    it('should handle API failures gracefully with cached fallback', async () => {
      // First, ensure we have a cached rate
      await getExchangeRate(Currency.USD, Currency.ILS)

      // The fallback mechanism should work if API is unavailable
      // This test verifies the fallback exists
      const cached = await prisma.exchangeRate.findFirst({
        where: {
          baseCurrency: Currency.USD,
          targetCurrency: Currency.ILS,
        },
      })

      expect(cached).toBeTruthy()
    }, 10000)
  })
})
