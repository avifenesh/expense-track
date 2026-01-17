// Finance module - holdings operations
import { Prisma, Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { batchLoadExchangeRates, convertAmountWithCache } from '@/lib/currency'
import { decimalToNumber } from './utils'
import type { HoldingWithPrice } from './types'

export async function getHoldingsWithPrices({
  accountId,
  preferredCurrency,
}: {
  accountId?: string
  preferredCurrency?: Currency
}): Promise<HoldingWithPrice[]> {
  const where: Prisma.HoldingWhereInput = { deletedAt: null }
  if (accountId) {
    where.accountId = accountId
  }

  const holdings = await prisma.holding.findMany({
    where,
    include: {
      account: true,
      category: true,
    },
    orderBy: {
      symbol: 'asc',
    },
  })

  // Batch load all prices and rates in parallel (fixes N+1)
  const { batchLoadStockPrices } = await import('@/lib/stock-api')
  const symbols = holdings.map((h) => h.symbol)
  const [priceCache, rateCache] = await Promise.all([batchLoadStockPrices(symbols), batchLoadExchangeRates()])

  const enriched = holdings.map((holding) => {
    // Get price from cache
    const priceData = priceCache.get(holding.symbol.toUpperCase())
    const currentPrice = priceData?.price ?? null
    const changePercent = priceData?.changePercent ?? null
    const priceAge = priceData?.fetchedAt ?? null
    const isStale = priceData?.isStale ?? false

    const quantity = decimalToNumber(holding.quantity)
    const averageCost = decimalToNumber(holding.averageCost)
    const costBasis = quantity * averageCost
    const marketValue = currentPrice !== null ? quantity * currentPrice : costBasis
    const gainLoss = marketValue - costBasis
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

    // Currency conversion using batch-loaded rates
    let currentPriceConverted: number | null = null
    let marketValueConverted = marketValue
    let costBasisConverted = costBasis
    let gainLossConverted = gainLoss

    if (preferredCurrency && holding.currency !== preferredCurrency) {
      if (currentPrice !== null) {
        currentPriceConverted = convertAmountWithCache(currentPrice, holding.currency, preferredCurrency, rateCache)
      }
      marketValueConverted = convertAmountWithCache(marketValue, holding.currency, preferredCurrency, rateCache)
      costBasisConverted = convertAmountWithCache(costBasis, holding.currency, preferredCurrency, rateCache)
      gainLossConverted = marketValueConverted - costBasisConverted
    }

    return {
      id: holding.id,
      accountId: holding.accountId,
      accountName: holding.account.name,
      categoryId: holding.categoryId,
      categoryName: holding.category.name,
      symbol: holding.symbol,
      quantity,
      averageCost,
      currency: holding.currency,
      notes: holding.notes,
      currentPrice,
      changePercent,
      marketValue,
      costBasis,
      gainLoss,
      gainLossPercent,
      priceAge,
      isStale,
      currentPriceConverted,
      marketValueConverted,
      costBasisConverted,
      gainLossConverted,
    }
  })

  return enriched
}
