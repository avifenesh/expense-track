/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for StockPrice model */
import { Currency, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || ''
const STOCK_PRICE_MAX_AGE_HOURS = Number(process.env.STOCK_PRICE_MAX_AGE_HOURS) || 24

// In-memory rate limiting (resets on serverless cold start)
let dailyCallCount = 0
let lastResetDate = new Date().toDateString()

type AlphaVantageGlobalQuote = {
  'Global Quote': {
    '01. symbol': string
    '05. price': string
    '10. change percent': string
    '06. volume': string
  }
}

export type StockQuoteData = {
  symbol: string
  price: number
  changePercent: number | null
  volume: bigint | null
  fetchedAt: Date
}

export type StockPriceWithMeta = {
  price: number
  changePercent: number | null
  fetchedAt: Date
  isStale: boolean
  hoursSinceUpdate: number
}

export type RefreshResult = {
  updated: number
  skipped: number
  errors: string[]
}

function checkRateLimit(): boolean {
  const today = new Date().toDateString()
  if (today !== lastResetDate) {
    dailyCallCount = 0
    lastResetDate = today
  }
  return dailyCallCount < 25
}

function incrementCallCount() {
  dailyCallCount++
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch a single stock quote from Alpha Vantage API
 */
export async function fetchStockQuote(symbol: string): Promise<StockQuoteData> {
  if (!ALPHA_VANTAGE_API_KEY) {
    throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set')
  }

  if (!checkRateLimit()) {
    throw new Error('Daily API rate limit reached (25 calls/day). Prices will refresh tomorrow.')
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    const data = (await response.json()) as AlphaVantageGlobalQuote

    incrementCallCount()

    if (!data['Global Quote'] || !data['Global Quote']['01. symbol']) {
      throw new Error(`Invalid or unknown symbol: ${symbol}`)
    }

    const quote = data['Global Quote']
    const price = parseFloat(quote['05. price'])
    const changePercentStr = quote['10. change percent']
    const changePercent = changePercentStr ? parseFloat(changePercentStr.replace('%', '')) : null
    const volumeStr = quote['06. volume']
    const volume = volumeStr ? BigInt(volumeStr) : null

    return {
      symbol: quote['01. symbol'],
      price,
      changePercent,
      volume,
      fetchedAt: new Date(),
    }
  } catch (error) {
    console.error(`fetchStockQuote error for ${symbol}:`, error)
    throw error
  }
}

/**
 * Get cached stock price or fetch from API if stale
 */
export async function getStockPrice(symbol: string): Promise<StockPriceWithMeta> {
  // Try to get most recent cached price
  const cached = await (prisma as any).stockPrice.findFirst({
    where: { symbol: symbol.toUpperCase() },
    orderBy: { fetchedAt: 'desc' },
  })

  const now = new Date()

  if (cached) {
    const hoursSinceUpdate = (now.getTime() - cached.fetchedAt.getTime()) / (1000 * 60 * 60)
    const isStale = hoursSinceUpdate > STOCK_PRICE_MAX_AGE_HOURS

    return {
      price: cached.price.toNumber(),
      changePercent: cached.changePercent ? cached.changePercent.toNumber() : null,
      fetchedAt: cached.fetchedAt,
      isStale,
      hoursSinceUpdate,
    }
  }

  // No cache found - must fetch from API
  throw new Error(`No cached price found for ${symbol}. Please refresh prices.`)
}

/**
 * Refresh stock prices for an array of symbols with rate limiting
 */
export async function refreshStockPrices(symbols: string[]): Promise<RefreshResult> {
  const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
  const result: RefreshResult = {
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const symbol of uniqueSymbols) {
    try {
      if (!checkRateLimit()) {
        result.errors.push(`Rate limit reached - skipped remaining symbols`)
        break
      }

      const quote = await fetchStockQuote(symbol)

      // Save to database
      await (prisma as any).stockPrice.create({
        data: {
          symbol: quote.symbol,
          price: new Prisma.Decimal(quote.price.toFixed(4)),
          currency: Currency.USD, // Alpha Vantage returns USD prices
          changePercent: quote.changePercent !== null ? new Prisma.Decimal(quote.changePercent.toFixed(4)) : null,
          volume: quote.volume,
          fetchedAt: quote.fetchedAt,
          source: 'alphavantage',
        },
      })

      result.updated++

      // Rate limiting: sleep 12 seconds between calls (5 calls/minute max)
      if (uniqueSymbols.indexOf(symbol) < uniqueSymbols.length - 1) {
        await sleep(12000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.errors.push(`${symbol}: ${errorMessage}`)
    }
  }

  return result
}
