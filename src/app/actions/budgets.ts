'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { successVoid, generalError } from '@/lib/action-result'
import { parseInput, toDecimalString, ensureAccountAccess } from './shared'
import { budgetSchema, deleteBudgetSchema, type BudgetInput } from '@/schemas'

export async function upsertBudgetAction(input: BudgetInput) {
  const parsed = parseInput(budgetSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, categoryId, monthKey, planned, currency, notes } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.budget.upsert({
      where: {
        accountId_categoryId_month: {
          accountId,
          categoryId,
          month,
        },
      },
      update: {
        planned: new Prisma.Decimal(toDecimalString(planned)),
        currency,
        notes: notes ?? null,
      },
      create: {
        accountId,
        categoryId,
        month,
        planned: new Prisma.Decimal(toDecimalString(planned)),
        currency,
        notes: notes ?? null,
      },
    })
  } catch (err) {
    console.error('upsertBudgetAction', err)
    return generalError('Unable to save budget')
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteBudgetAction(input: z.infer<typeof deleteBudgetSchema>) {
  const parsed = parseInput(deleteBudgetSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, categoryId, monthKey } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.budget.delete({
      where: {
        accountId_categoryId_month: {
          accountId,
          categoryId,
          month,
        },
      },
    })
  } catch (err) {
    console.error('deleteBudgetAction', err)
    return generalError('Budget entry not found')
  }

  revalidatePath('/')
  return successVoid()
}
