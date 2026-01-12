/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for StockPrice model */
import { Currency, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || ''
const STOCK_PRICE_MAX_AGE_HOURS = Number(process.env.STOCK_PRICE_MAX_AGE_HOURS) || 24

// Warn at module load if API key is missing - feature will fail at runtime
if (!ALPHA_VANTAGE_API_KEY) {
  console.warn('[stock-api] ALPHA_VANTAGE_API_KEY not configured - stock price fetching will be disabled')
}

// In-memory rate limiting (resets on serverless cold start)
let dailyCallCount = 0
let lastResetDate = new Date().toDateString()

// Track failed symbols to prevent repeated API calls for invalid symbols
// Map: symbol -> timestamp of last failure (expires after 24 hours)
const failedSymbols = new Map<string, number>()
const FAILED_SYMBOL_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function isSymbolKnownInvalid(symbol: string): boolean {
  const failedAt = failedSymbols.get(symbol.toUpperCase())
  if (!failedAt) return false
  // Check if the failure is still within TTL
  if (Date.now() - failedAt < FAILED_SYMBOL_TTL_MS) {
    return true
  }
  // Expired - remove from cache
  failedSymbols.delete(symbol.toUpperCase())
  return false
}

function markSymbolAsFailed(symbol: string): void {
  failedSymbols.set(symbol.toUpperCase(), Date.now())
}

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

export type StockPriceResult = { success: true; data: StockPriceWithMeta } | { success: false; error: string }

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
      markSymbolAsFailed(symbol)
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
 * Get cached stock price - returns result object instead of throwing
 */
export async function getStockPrice(symbol: string): Promise<StockPriceResult> {
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
      success: true,
      data: {
        price: cached.price.toNumber(),
        changePercent: cached.changePercent ? cached.changePercent.toNumber() : null,
        fetchedAt: cached.fetchedAt,
        isStale,
        hoursSinceUpdate,
      },
    }
  }

  // No cache found
  return {
    success: false,
    error: `No cached price found for ${symbol}. Please refresh prices.`,
  }
}

/**
 * Price cache type for batch operations
 */
export type PriceCache = Map<string, StockPriceWithMeta>

/**
 * Batch load stock prices for multiple symbols in one query (reduces N+1)
 */
export async function batchLoadStockPrices(symbols: string[]): Promise<PriceCache> {
  const cache: PriceCache = new Map()
  const upperSymbols = symbols.map((s) => s.toUpperCase())

  if (upperSymbols.length === 0) return cache

  // Get most recent price for each symbol in one query
  const prices = await (prisma as any).stockPrice.findMany({
    where: { symbol: { in: upperSymbols } },
    orderBy: { fetchedAt: 'desc' },
    distinct: ['symbol'],
  })

  const now = new Date()
  for (const price of prices) {
    const hoursSinceUpdate = (now.getTime() - price.fetchedAt.getTime()) / (1000 * 60 * 60)
    const isStale = hoursSinceUpdate > STOCK_PRICE_MAX_AGE_HOURS

    cache.set(price.symbol.toUpperCase(), {
      price: price.price.toNumber(),
      changePercent: price.changePercent ? price.changePercent.toNumber() : null,
      fetchedAt: price.fetchedAt,
      isStale,
      hoursSinceUpdate,
    })
  }

  return cache
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

  for (let i = 0; i < uniqueSymbols.length; i++) {
    const symbol = uniqueSymbols[i]

    // Skip symbols that have previously failed (prevents rate limit abuse)
    if (isSymbolKnownInvalid(symbol)) {
      result.skipped++
      result.errors.push(`${symbol}: Skipped - previously failed (retry after 24h)`)
      continue
    }

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
      if (i < uniqueSymbols.length - 1) {
        await sleep(12000)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.errors.push(`${symbol}: ${errorMessage}`)
    }
  }

  return result
}
