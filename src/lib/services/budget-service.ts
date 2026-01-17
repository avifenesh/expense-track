import { Prisma, Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/utils/decimal'

export interface UpsertBudgetInput {
  accountId: string
  categoryId: string
  month: Date
  planned: number
  currency: Currency
  notes?: string | null
}

export interface DeleteBudgetInput {
  accountId: string
  categoryId: string
  month: Date
}

/**
 * Upsert a budget (create or update based on unique constraint)
 */
export async function upsertBudget(input: UpsertBudgetInput) {
  return await prisma.budget.upsert({
    where: {
      accountId_categoryId_month: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        month: input.month,
      },
    },
    update: {
      planned: new Prisma.Decimal(toDecimalString(input.planned)),
      currency: input.currency,
      notes: input.notes ?? null,
    },
    create: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      month: input.month,
      planned: new Prisma.Decimal(toDecimalString(input.planned)),
      currency: input.currency,
      notes: input.notes ?? null,
    },
  })
}

/**
 * Delete a budget by composite key
 */
export async function deleteBudget(input: DeleteBudgetInput) {
  return await prisma.budget.delete({
    where: {
      accountId_categoryId_month: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        month: input.month,
      },
    },
  })
}

/**
 * Get a budget by composite key
 */
export async function getBudgetByKey(input: DeleteBudgetInput) {
  return await prisma.budget.findUnique({
    where: {
      accountId_categoryId_month: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        month: input.month,
      },
    },
  })
}
