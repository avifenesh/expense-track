'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { successVoid } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, toDecimalString, ensureAccountAccessWithSubscription, requireCsrfToken } from './shared'
import {
  budgetSchema,
  deleteBudgetSchema,
  monthlyIncomeGoalSchema,
  deleteMonthlyIncomeGoalSchema,
  type BudgetInput,
  type MonthlyIncomeGoalInput,
} from '@/schemas'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'

export async function upsertBudgetAction(input: BudgetInput) {
  const parsed = parseInput(budgetSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, categoryId, monthKey, planned, currency, notes, csrfToken } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccessWithSubscription(accountId)
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
        deletedAt: null, // Clear soft delete on update (restore if previously deleted)
        deletedBy: null,
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
  } catch (error) {
    return handlePrismaError(error, {
      action: 'upsertBudget',
      accountId,
      input: { categoryId, monthKey, planned },
      foreignKeyMessage: 'The selected category no longer exists',
      fallbackMessage: 'Unable to save budget',
    })
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

  const access = await ensureAccountAccessWithSubscription(accountId)
  if ('error' in access) {
    return access
  }
  const { authUser } = access

  try {
    // Soft delete: set deletedAt and deletedBy instead of hard delete
    await prisma.budget.update({
      where: {
        accountId_categoryId_month: {
          accountId,
          categoryId,
          month,
        },
        deletedAt: null, // Only delete non-deleted budgets
      },
      data: {
        deletedAt: new Date(),
        deletedBy: authUser.id,
      },
    })

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteBudget',
      accountId,
      input: { categoryId, monthKey },
      notFoundMessage: 'Budget entry not found',
      fallbackMessage: 'Unable to delete budget',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function upsertMonthlyIncomeGoalAction(input: MonthlyIncomeGoalInput) {
  const parsed = parseInput(monthlyIncomeGoalSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, monthKey, amount, currency, notes, setAsDefault, csrfToken } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccessWithSubscription(accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Upsert the monthly income goal
      await tx.monthlyIncomeGoal.upsert({
        where: {
          accountId_month: {
            accountId,
            month,
          },
        },
        update: {
          amount: new Prisma.Decimal(toDecimalString(amount)),
          currency,
          notes: notes ?? null,
          deletedAt: null,
          deletedBy: null,
        },
        create: {
          accountId,
          month,
          amount: new Prisma.Decimal(toDecimalString(amount)),
          currency,
          notes: notes ?? null,
        },
      })

      // Also set as account default if requested
      if (setAsDefault) {
        await tx.account.update({
          where: { id: accountId },
          data: {
            defaultIncomeGoal: new Prisma.Decimal(toDecimalString(amount)),
            defaultIncomeGoalCurrency: currency,
          },
        })
      }
    })

    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'upsertMonthlyIncomeGoal',
      accountId,
      input: { monthKey, amount },
      fallbackMessage: 'Unable to save income goal',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteMonthlyIncomeGoalAction(input: z.infer<typeof deleteMonthlyIncomeGoalSchema>) {
  const parsed = parseInput(deleteMonthlyIncomeGoalSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, monthKey, csrfToken } = parsed.data
  const month = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccessWithSubscription(accountId)
  if ('error' in access) {
    return access
  }
  const { authUser } = access

  try {
    await prisma.monthlyIncomeGoal.update({
      where: {
        accountId_month: {
          accountId,
          month,
        },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        deletedBy: authUser.id,
      },
    })

    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteMonthlyIncomeGoal',
      accountId,
      input: { monthKey },
      notFoundMessage: 'Income goal not found',
      fallbackMessage: 'Unable to delete income goal',
    })
  }

  revalidatePath('/')
  return successVoid()
}
