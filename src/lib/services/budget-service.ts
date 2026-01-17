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
  userId: string
}

/**
 * Upsert a budget (create or update based on unique constraint)
 * If a soft-deleted budget exists, it will be restored.
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
      deletedAt: null, // Clear soft delete on update (restore if previously deleted)
      deletedBy: null,
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
 * Soft delete a budget by composite key
 */
export async function deleteBudget(input: DeleteBudgetInput) {
  return await prisma.budget.update({
    where: {
      accountId_categoryId_month: {
        accountId: input.accountId,
        categoryId: input.categoryId,
        month: input.month,
      },
      deletedAt: null, // Only delete non-deleted budgets
    },
    data: {
      deletedAt: new Date(),
      deletedBy: input.userId,
    },
  })
}

export interface GetBudgetByKeyInput {
  accountId: string
  categoryId: string
  month: Date
}

/**
 * Get a budget by composite key (excludes soft-deleted budgets)
 */
export async function getBudgetByKey(input: GetBudgetByKeyInput) {
  return await prisma.budget.findFirst({
    where: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      month: input.month,
      deletedAt: null,
    },
  })
}
