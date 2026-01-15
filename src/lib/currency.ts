import { Currency, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1'

// In-flight request deduplication to prevent duplicate API calls
const inFlightRequests = new Map<string, Promise<FrankfurterResponse>>()

type FrankfurterResponse = {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Fetch exchange rates from Frankfurter API for a specific base currency
 * Uses request deduplication to prevent duplicate API calls for concurrent requests
 */
export async function fetchExchangeRates(baseCurrency: Currency): Promise<FrankfurterResponse> {
  const cacheKey = `rates:${baseCurrency}`

  // Return existing in-flight request if one exists
  const existing = inFlightRequests.get(cacheKey)
  if (existing) {
    return existing
  }

  const symbols = Object.values(Currency)
    .filter((c) => c !== baseCurrency)
    .join(',')

  const url = `${FRANKFURTER_BASE_URL}/latest?base=${baseCurrency}&symbols=${symbols}`

  const fetchPromise = (async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } finally {
      // Clean up after request completes (success or failure)
      inFlightRequests.delete(cacheKey)
    }
  })()

  inFlightRequests.set(cacheKey, fetchPromise)
  return fetchPromise
}

/**
 * Get exchange rate from cache or fetch if not available
 */
export async function getExchangeRate(from: Currency, to: Currency, date?: Date): Promise<number> {
  // Same currency, no conversion needed
  if (from === to) {
    return 1
  }

  const targetDate = date ? startOfDay(date) : startOfDay(new Date())

  // Try to get from cache
  const cached = await prisma.exchangeRate.findUnique({
    where: {
      baseCurrency_targetCurrency_date: {
        baseCurrency: from,
        targetCurrency: to,
        date: targetDate,
      },
    },
  })

  if (cached) {
    return cached.rate.toNumber()
  }

  // Fetch fresh rates if not in cache
  try {
    const data = await fetchExchangeRates(from)
    const rate = data.rates[to]

    if (!rate) {
      throw new Error(`No exchange rate found for ${from} -> ${to}`)
    }

    // Cache the rate (upsert to handle duplicates)
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency_date: {
          baseCurrency: from,
          targetCurrency: to,
          date: targetDate,
        },
      },
      update: {
        rate: new Prisma.Decimal(rate),
        fetchedAt: new Date(),
      },
      create: {
        baseCurrency: from,
        targetCurrency: to,
        rate: new Prisma.Decimal(rate),
        date: targetDate,
      },
    })

    return rate
  } catch {
    // Fallback: try to get the most recent cached rate
    const fallback = await prisma.exchangeRate.findFirst({
      where: {
        baseCurrency: from,
        targetCurrency: to,
      },
      orderBy: {
        date: 'desc',
      },
    })

    if (fallback) {
      return fallback.rate.toNumber()
    }

    throw new Error(`No exchange rate available for ${from} -> ${to}`)
  }
}

/**
 * Convert an amount from one currency to another
 */
export async function convertAmount(amount: number, from: Currency, to: Currency, date?: Date): Promise<number> {
  if (from === to) {
    return amount
  }

  const rate = await getExchangeRate(from, to, date)
  const converted = amount * rate

  // Round to 2 decimal places for financial precision
  return Math.round(converted * 100) / 100
}

/**
 * Refresh all exchange rates for all currency pairs
 */
export async function refreshExchangeRates(): Promise<
  { success: true; updatedAt: Date } | { error: { general: string[] }; updatedAt: Date }
> {
  const now = new Date()
  const today = startOfDay(now)

  try {
    const currencies = Object.values(Currency)
    const rates: Array<{
      baseCurrency: Currency
      targetCurrency: Currency
      rate: Prisma.Decimal
      date: Date
    }> = []

    // Fetch rates for each base currency
    for (const base of currencies) {
      const data = await fetchExchangeRates(base)

      for (const [targetCurrency, rate] of Object.entries(data.rates)) {
        rates.push({
          baseCurrency: base,
          targetCurrency: targetCurrency as Currency,
          rate: new Prisma.Decimal(rate),
          date: today,
        })
      }
    }

    // Upsert all rates
    await Promise.all(
      rates.map((rate) =>
        prisma.exchangeRate.upsert({
          where: {
            baseCurrency_targetCurrency_date: {
              baseCurrency: rate.baseCurrency,
              targetCurrency: rate.targetCurrency,
              date: rate.date,
            },
          },
          update: {
            rate: rate.rate,
            fetchedAt: now,
          },
          create: {
            baseCurrency: rate.baseCurrency,
            targetCurrency: rate.targetCurrency,
            rate: rate.rate,
            date: rate.date,
            fetchedAt: now,
          },
        }),
      ),
    )

    return { success: true, updatedAt: now }
  } catch (error) {
    return {
      error: { general: [error instanceof Error ? error.message : 'Unknown error'] },
      updatedAt: now,
    }
  }
}

/**
 * Rate cache type for batch operations
 */
export type RateCache = Map<string, number>

/**
 * Create a cache key for rate lookups
 */
function rateCacheKey(from: Currency, to: Currency): string {
  return `${from}:${to}`
}

/**
 * Batch load all exchange rates for a given date (reduces N+1 queries)
 * Returns a Map for O(1) lookups during conversion
 */
export async function batchLoadExchangeRates(date?: Date): Promise<RateCache> {
  const targetDate = date ? startOfDay(date) : startOfDay(new Date())
  const cache: RateCache = new Map()

  // Load all rates for the target date in one query
  const rates = await prisma.exchangeRate.findMany({
    where: { date: targetDate },
  })

  for (const rate of rates) {
    cache.set(rateCacheKey(rate.baseCurrency, rate.targetCurrency), rate.rate.toNumber())
  }

  // If no rates for today, try most recent rates as fallback
  if (cache.size === 0) {
    const fallbackRates = await prisma.exchangeRate.findMany({
      distinct: ['baseCurrency', 'targetCurrency'],
      orderBy: { date: 'desc' },
    })
    for (const rate of fallbackRates) {
      cache.set(rateCacheKey(rate.baseCurrency, rate.targetCurrency), rate.rate.toNumber())
    }
  }

  // Add identity rates for same-currency conversions
  for (const currency of Object.values(Currency)) {
    cache.set(rateCacheKey(currency, currency), 1)
  }

  return cache
}

/**
 * Convert amount using a preloaded rate cache (no DB calls)
 * Returns the converted amount, or the original amount if no rate is found (with warning)
 */
export function convertAmountWithCache(amount: number, from: Currency, to: Currency, cache: RateCache): number {
  if (from === to) return amount

  const rate = cache.get(rateCacheKey(from, to))
  if (!rate) {
    // Log warning for missing exchange rate - this could indicate stale cache or missing data
    // eslint-disable-next-line no-console
    console.warn(
      'CURRENCY_RATE_MISSING',
      JSON.stringify({
        from,
        to,
        amount,
        message: `No exchange rate found for ${from} -> ${to}, returning original amount`,
      }),
    )
    return amount
  }

  return Math.round(amount * rate * 100) / 100
}

/**
 * Get the last time exchange rates were updated
 */
export async function getLastUpdateTime(): Promise<Date | null> {
  const latest = await prisma.exchangeRate.findFirst({
    orderBy: {
      fetchedAt: 'desc',
    },
    select: {
      fetchedAt: true,
    },
  })

  return latest?.fetchedAt || null
}
