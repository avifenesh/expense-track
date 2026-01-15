'use server'

import { Prisma, TransactionType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { refreshExchangeRates } from '@/lib/currency'
import { success, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { requireSession } from '@/lib/auth-server'
import { parseInput, toDecimalString, ensureAccountAccess, requireCsrfToken } from './shared'
import { refreshExchangeRatesSchema, setBalanceSchema } from '@/schemas'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function refreshExchangeRatesAction(input: z.infer<typeof refreshExchangeRatesSchema>) {
  const parsed = parseInput(refreshExchangeRatesSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  try {
    await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  try {
    const result = await refreshExchangeRates()
    if ('error' in result) {
      return result
    }

    revalidatePath('/')
    return success({ updatedAt: result.updatedAt })
  } catch {
    return generalError('Unable to refresh exchange rates')
  }
}

export async function setBalanceAction(input: z.infer<typeof setBalanceSchema>) {
  const parsed = parseInput(setBalanceSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, targetBalance, currency, monthKey, csrfToken } = parsed.data

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }
  const { authUser } = access

  const monthStart = getMonthStartFromKey(monthKey)

  // Find or create "Balance Adjustment" category for this user
  let adjustmentCategory = await prisma.category.findFirst({
    where: { name: 'Balance Adjustment', userId: authUser.id },
  })

  if (!adjustmentCategory) {
    adjustmentCategory = await prisma.category.create({
      data: {
        userId: authUser.id,
        name: 'Balance Adjustment',
        type: TransactionType.INCOME,
      },
    })
  }

  // Calculate current net for this account in the current month
  const transactions = await prisma.transaction.findMany({
    where: {
      accountId,
      month: monthStart,
    },
    select: {
      type: true,
      amount: true,
    },
  })

  let currentIncome = 0
  let currentExpense = 0

  for (const t of transactions) {
    const amount = typeof t.amount === 'object' ? Number(t.amount) : t.amount
    if (t.type === TransactionType.INCOME) {
      currentIncome += amount
    } else {
      currentExpense += amount
    }
  }

  const currentNet = currentIncome - currentExpense
  const adjustment = targetBalance - currentNet

  // If no adjustment needed, return early
  if (Math.abs(adjustment) < 0.01) {
    return success({ adjustment: 0 })
  }

  // Create adjustment transaction
  const transactionType = adjustment > 0 ? TransactionType.INCOME : TransactionType.EXPENSE
  const transactionAmount = Math.abs(adjustment)

  try {
    await prisma.transaction.create({
      data: {
        accountId,
        categoryId: adjustmentCategory.id,
        type: transactionType,
        amount: new Prisma.Decimal(toDecimalString(transactionAmount)),
        currency,
        date: new Date(),
        month: monthStart,
        description: 'Balance adjustment',
        isRecurring: false,
      },
    })

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'setBalance',
      accountId,
      input: { targetBalance, currency, monthKey },
      fallbackMessage: 'Unable to create balance adjustment',
    })
  }

  revalidatePath('/')
  return success({ adjustment })
}
