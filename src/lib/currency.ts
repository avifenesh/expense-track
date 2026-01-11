import { Currency, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'

const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1'

type FrankfurterResponse = {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Fetch exchange rates from Frankfurter API for a specific base currency
 */
export async function fetchExchangeRates(baseCurrency: Currency): Promise<FrankfurterResponse> {
  const symbols = Object.values(Currency)
    .filter((c) => c !== baseCurrency)
    .join(',')

  const url = `${FRANKFURTER_BASE_URL}/latest?base=${baseCurrency}&symbols=${symbols}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Frankfurter API error: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Get exchange rate from cache or fetch if not available
 */
export async function getExchangeRate(
  from: Currency,
  to: Currency,
  date?: Date
): Promise<number> {
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
  } catch (error) {
    console.error(`Failed to fetch exchange rate ${from} -> ${to}:`, error)

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
      console.warn(`Using stale exchange rate from ${fallback.date.toISOString()}`)
      return fallback.rate.toNumber()
    }

    throw new Error(`No exchange rate available for ${from} -> ${to}`)
  }
}

/**
 * Convert an amount from one currency to another
 */
export async function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  date?: Date
): Promise<number> {
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
export async function refreshExchangeRates(): Promise<{
  success: boolean
  updatedAt: Date
  error?: string
}> {
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
        })
      )
    )

    return { success: true, updatedAt: now }
  } catch (error) {
    console.error('Failed to refresh exchange rates:', error)
    return {
      success: false,
      updatedAt: now,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
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
