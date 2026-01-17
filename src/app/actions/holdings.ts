'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, toDecimalString, ensureAccountAccessWithSubscription, requireCsrfToken } from './shared'
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

  const access = await ensureAccountAccessWithSubscription(data.accountId)
  if ('error' in access) {
    return access
  }

  // Validate that category has isHolding = true and belongs to the user
  try {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId, userId: access.authUser.id },
    })

    if (!category) {
      return failure({ categoryId: ['Category not found'] })
    }

    if (!category.isHolding) {
      return failure({ categoryId: ['Category must be marked as a holding category'] })
    }
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createHolding.validateCategory',
      accountId: data.accountId,
      input: data,
      fallbackMessage: 'Unable to validate category',
    })
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
    await prisma.holding.create({
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
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createHolding',
      accountId: data.accountId,
      input: data,
      uniqueMessage: 'A holding with this symbol already exists in this account',
      foreignKeyMessage: 'The selected account or category no longer exists',
      fallbackMessage: 'Unable to create holding',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function updateHoldingAction(input: z.infer<typeof updateHoldingSchema>) {
  const parsed = parseInput(updateHoldingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let holding
  try {
    holding = await prisma.holding.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'updateHolding.findFirst',
      input: { id: parsed.data.id },
      fallbackMessage: 'Unable to update holding',
    })
  }

  if (!holding) {
    return generalError('Holding not found')
  }

  const access = await ensureAccountAccessWithSubscription(holding.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.holding.update({
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
  } catch (error) {
    return handlePrismaError(error, {
      action: 'updateHolding',
      accountId: holding.accountId,
      input: parsed.data,
      notFoundMessage: 'Holding not found',
      fallbackMessage: 'Unable to update holding',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteHoldingAction(input: z.infer<typeof deleteHoldingSchema>) {
  const parsed = parseInput(deleteHoldingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let holding
  try {
    holding = await prisma.holding.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteHolding.findFirst',
      input: { id: parsed.data.id },
      fallbackMessage: 'Unable to delete holding',
    })
  }

  if (!holding) {
    return generalError('Holding not found')
  }

  const access = await ensureAccountAccessWithSubscription(holding.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.holding.update({
      where: { id: parsed.data.id },
      data: {
        deletedAt: new Date(),
        deletedBy: access.authUser.id,
      },
    })

    // Invalidate dashboard cache for this account (holdings affect portfolio value across all months)
    await invalidateDashboardCache({
      accountId: holding.accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteHolding',
      accountId: holding.accountId,
      input: { id: parsed.data.id },
      notFoundMessage: 'Holding not found',
      fallbackMessage: 'Unable to delete holding',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function refreshHoldingPricesAction(input: z.infer<typeof refreshHoldingPricesSchema>) {
  const parsed = parseInput(refreshHoldingPricesSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccessWithSubscription(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    // Get all unique symbols for this account's holdings
    const holdings = await prisma.holding.findMany({
      where: { accountId: parsed.data.accountId, deletedAt: null },
      select: { symbol: true },
    })

    const symbols: string[] = Array.from(new Set(holdings.map((h) => h.symbol)))

    if (symbols.length === 0) {
      return success({ updated: 0, skipped: 0, errors: [] as string[] })
    }

    const { refreshStockPrices } = await import('@/lib/stock-api')
    const result = await refreshStockPrices(symbols)

    revalidatePath('/')
    return success(result)
  } catch (error) {
    return handlePrismaError(error, {
      action: 'refreshHoldingPrices',
      accountId: parsed.data.accountId,
      fallbackMessage: 'Unable to refresh stock prices',
    })
  }
}
