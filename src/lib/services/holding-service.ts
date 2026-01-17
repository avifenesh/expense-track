import { Prisma, Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/utils/decimal'
import { NotFoundError, ValidationError } from './errors'

export interface CreateHoldingInput {
  accountId: string
  categoryId: string
  symbol: string
  quantity: number
  averageCost: number
  currency: Currency
  notes?: string | null
}

export interface UpdateHoldingInput {
  id: string
  quantity: number
  averageCost: number
  notes?: string | null
}

export interface RefreshHoldingPricesInput {
  accountId: string
}

/**
 * Create a new holding
 * Note: Caller must validate category has isHolding=true and symbol is valid
 */
export async function createHolding(input: CreateHoldingInput) {
  return await prisma.holding.create({
    data: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      symbol: input.symbol.toUpperCase(),
      quantity: new Prisma.Decimal(input.quantity.toFixed(6)),
      averageCost: new Prisma.Decimal(toDecimalString(input.averageCost)),
      currency: input.currency,
      notes: input.notes ?? null,
    },
  })
}

/**
 * Update an existing holding (quantity, averageCost, notes only)
 */
export async function updateHolding(input: UpdateHoldingInput) {
  return await prisma.holding.update({
    where: { id: input.id },
    data: {
      quantity: new Prisma.Decimal(input.quantity.toFixed(6)),
      averageCost: new Prisma.Decimal(toDecimalString(input.averageCost)),
      notes: input.notes ?? null,
    },
  })
}

/**
 * Delete a holding
 */
export async function deleteHolding(id: string) {
  return await prisma.holding.delete({
    where: { id },
  })
}

/**
 * Get a holding by ID
 * If userId is provided, only returns the holding if it belongs to that user (via account)
 */
export async function getHoldingById(id: string, userId?: string) {
  if (userId) {
    return await prisma.holding.findFirst({
      where: { id, account: { userId } },
      include: { account: true },
    })
  }
  return await prisma.holding.findUnique({
    where: { id },
  })
}

/**
 * Get all unique symbols for an account's holdings
 */
export async function getAccountHoldingSymbols(accountId: string): Promise<string[]> {
  const holdings = await prisma.holding.findMany({
    where: { accountId },
    select: { symbol: true },
  })

  return Array.from(new Set(holdings.map((h) => h.symbol)))
}

/**
 * Refresh stock prices for an account's holdings
 * Calls stock API to update cached prices
 */
export async function refreshHoldingPrices(input: RefreshHoldingPricesInput) {
  const symbols = await getAccountHoldingSymbols(input.accountId)

  if (symbols.length === 0) {
    return { updated: 0, skipped: 0, errors: [] as string[] }
  }

  const { refreshStockPrices } = await import('@/lib/stock-api')
  return await refreshStockPrices(symbols)
}

/**
 * Validate that a category has isHolding = true and belongs to the user
 */
export async function validateHoldingCategory(categoryId: string, userId?: string): Promise<boolean> {
  const where = userId ? { id: categoryId, userId } : { id: categoryId }
  const category = await prisma.category.findFirst({
    where,
  })

  if (!category) {
    throw new NotFoundError('Category', categoryId)
  }

  if (!category.isHolding) {
    throw ValidationError.field('categoryId', 'Category must be marked as a holding category')
  }

  return true
}

/**
 * Validate stock symbol by calling stock API
 */
export async function validateStockSymbol(symbol: string): Promise<void> {
  const { fetchStockQuote } = await import('@/lib/stock-api')
  await fetchStockQuote(symbol)
}
