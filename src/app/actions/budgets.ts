'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { successVoid, generalError } from '@/lib/action-result'
import { parseInput, toDecimalString, ensureAccountAccess, requireCsrfToken } from './shared'
import { budgetSchema, deleteBudgetSchema, type BudgetInput } from '@/schemas'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function upsertBudgetAction(input: BudgetInput) {
  const parsed = parseInput(budgetSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, categoryId, monthKey, planned, currency, notes, csrfToken } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch {
    return generalError('Unable to save budget')
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteBudgetAction(input: z.infer<typeof deleteBudgetSchema>) {
  const parsed = parseInput(deleteBudgetSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, categoryId, monthKey, csrfToken } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch {
    return generalError('Budget entry not found')
  }

  revalidatePath('/')
  return successVoid()
}
