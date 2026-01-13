'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for some models */
import { Prisma, TransactionType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { refreshExchangeRates } from '@/lib/currency'
import { success, generalError } from '@/lib/action-result'
import { requireSession } from '@/lib/auth-server'
import { parseInput, toDecimalString, ensureAccountAccess } from './shared'
import { setBalanceSchema } from '@/schemas'

export async function refreshExchangeRatesAction() {
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
  } catch (err) {
    console.error('refreshExchangeRatesAction', err)
    return generalError('Unable to refresh exchange rates')
  }
}

export async function setBalanceAction(input: z.infer<typeof setBalanceSchema>) {
  const parsed = parseInput(setBalanceSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, targetBalance, currency, monthKey } = parsed.data

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  const monthStart = getMonthStartFromKey(monthKey)

  // Find or create "Balance Adjustment" category
  let adjustmentCategory = await prisma.category.findFirst({
    where: { name: 'Balance Adjustment' },
  })

  if (!adjustmentCategory) {
    adjustmentCategory = await prisma.category.create({
      data: {
        name: 'Balance Adjustment',
        type: TransactionType.INCOME,
      },
    })
  }

  // Calculate current net for this account in the current month
  const transactions = await (prisma as any).transaction.findMany({
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
    await (prisma as any).transaction.create({
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
  } catch (err) {
    console.error('setBalanceAction', err)
    return generalError('Unable to create balance adjustment')
  }

  revalidatePath('/')
  return success({ adjustment })
}
