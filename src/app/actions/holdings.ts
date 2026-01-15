'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for some models */
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, toDecimalString, ensureAccountAccess, requireCsrfToken } from './shared'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import {
  holdingSchema,
  updateHoldingSchema,
  deleteHoldingSchema,
  refreshHoldingPricesSchema,
  type HoldingInput,
} from '@/schemas'

export async function createHoldingAction(input: HoldingInput) {
  const parsed = parseInput(holdingSchema, {
    ...input,
    symbol: input.symbol.toUpperCase(),
  })
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(data.accountId)
  if ('error' in access) {
    return access
  }

  // Validate that category has isHolding = true
  try {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      return failure({ categoryId: ['Category not found'] })
    }

    if (!category.isHolding) {
      return failure({ categoryId: ['Category must be marked as a holding category'] })
    }
  } catch {
    return generalError('Unable to validate category')
  }

  // Test symbol validity with API call (counts toward daily limit)
  const { fetchStockQuote } = await import('@/lib/stock-api')
  try {
    await fetchStockQuote(data.symbol)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid symbol'
    return failure({ symbol: [errorMessage] })
  }

  // Create holding
  try {
    await (prisma as any).holding.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        symbol: data.symbol,
        quantity: new Prisma.Decimal(data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(toDecimalString(data.averageCost)),
        currency: data.currency,
        notes: data.notes ?? null,
      },
    })

    // Invalidate dashboard cache for this account (holdings affect portfolio value across all months)
    await invalidateDashboardCache({
      accountId: data.accountId,
    })
  } catch {
    return generalError('Unable to create holding. It may already exist.')
  }

  revalidatePath('/')
  return successVoid()
}

export async function updateHoldingAction(input: z.infer<typeof updateHoldingSchema>) {
  const parsed = parseInput(updateHoldingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  try {
    const holding = await (prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    })

    if (!holding) {
      return generalError('Holding not found')
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await (prisma as any).holding.update({
      where: { id: parsed.data.id },
      data: {
        quantity: new Prisma.Decimal(parsed.data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(toDecimalString(parsed.data.averageCost)),
        notes: parsed.data.notes ?? null,
      },
    })

    // Invalidate dashboard cache for this account (holdings affect portfolio value across all months)
    await invalidateDashboardCache({
      accountId: holding.accountId,
    })
  } catch {
    return generalError('Holding not found')
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteHoldingAction(input: z.infer<typeof deleteHoldingSchema>) {
  const parsed = parseInput(deleteHoldingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  try {
    const holding = await (prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    })

    if (!holding) {
      return generalError('Holding not found')
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await (prisma as any).holding.delete({
      where: { id: parsed.data.id },
    })

    // Invalidate dashboard cache for this account (holdings affect portfolio value across all months)
    await invalidateDashboardCache({
      accountId: holding.accountId,
    })
  } catch {
    return generalError('Holding not found')
  }

  revalidatePath('/')
  return successVoid()
}

export async function refreshHoldingPricesAction(input: z.infer<typeof refreshHoldingPricesSchema>) {
  const parsed = parseInput(refreshHoldingPricesSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    // Get all unique symbols for this account's holdings
    const holdings = await (prisma as any).holding.findMany({
      where: { accountId: parsed.data.accountId },
      select: { symbol: true },
    })

    const symbols: string[] = Array.from(new Set(holdings.map((h: any) => h.symbol as string)))

    if (symbols.length === 0) {
      return success({ updated: 0, skipped: 0, errors: [] as string[] })
    }

    const { refreshStockPrices } = await import('@/lib/stock-api')
    const result = await refreshStockPrices(symbols)

    revalidatePath('/')
    return success(result)
  } catch {
    return generalError('Unable to refresh stock prices')
  }
}
