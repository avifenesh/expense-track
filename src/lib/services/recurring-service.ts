import { Prisma, TransactionType, Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { toDecimalString } from '@/utils/decimal'
import { getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'

export interface UpsertRecurringTemplateInput {
  id?: string
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency: Currency
  dayOfMonth: number
  description?: string | null
  startMonth: Date
  endMonth?: Date | null
  isActive?: boolean
}

export interface ToggleRecurringTemplateInput {
  id: string
  isActive: boolean
}

export interface ApplyRecurringTemplatesInput {
  monthKey: string
  accountId: string
  templateIds?: string[]
}

/**
 * Upsert a recurring template (create or update)
 */
export async function upsertRecurringTemplate(input: UpsertRecurringTemplateInput) {
  const payload = {
    accountId: input.accountId,
    categoryId: input.categoryId,
    type: input.type,
    amount: new Prisma.Decimal(toDecimalString(input.amount)),
    currency: input.currency,
    dayOfMonth: input.dayOfMonth,
    description: input.description ?? null,
    startMonth: input.startMonth,
    endMonth: input.endMonth ?? null,
    isActive: input.isActive ?? true,
  }

  if (input.id) {
    return await prisma.recurringTemplate.update({
      where: { id: input.id },
      data: payload,
    })
  } else {
    return await prisma.recurringTemplate.create({ data: payload })
  }
}

/**
 * Toggle isActive status of a recurring template
 */
export async function toggleRecurringTemplate(input: ToggleRecurringTemplateInput) {
  return await prisma.recurringTemplate.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  })
}

/**
 * Get a recurring template by ID
 * If userId is provided, only returns the template if it belongs to that user (via account)
 */
export async function getRecurringTemplateById(id: string, userId?: string) {
  if (userId) {
    return await prisma.recurringTemplate.findFirst({
      where: { id, account: { userId } },
      include: { account: true },
    })
  }
  return await prisma.recurringTemplate.findUnique({ where: { id } })
}

/**
 * Apply recurring templates to create transactions for a month
 * Returns the number of transactions created
 */
export async function applyRecurringTemplates(input: ApplyRecurringTemplatesInput): Promise<{ created: number }> {
  const monthStart = getMonthStartFromKey(input.monthKey)

  const where: Prisma.RecurringTemplateWhereInput = {
    isActive: true,
    startMonth: { lte: monthStart },
    OR: [{ endMonth: null }, { endMonth: { gte: monthStart } }],
    accountId: input.accountId,
  }

  if (input.templateIds && input.templateIds.length > 0) {
    where.id = { in: input.templateIds }
  }

  const templates = await prisma.recurringTemplate.findMany({ where })

  if (templates.length === 0) {
    return { created: 0 }
  }

  // Check which templates already have transactions for this month
  const existing = await prisma.transaction.findMany({
    where: {
      month: monthStart,
      recurringTemplateId: { in: templates.map((t) => t.id) },
    },
    select: {
      recurringTemplateId: true,
    },
  })

  const existingSet = new Set(existing.map((item) => item.recurringTemplateId))

  // Create transactions for templates that don't have one yet
  const transactionsToCreate = templates
    .filter((template) => !existingSet.has(template.id))
    .map((template) => {
      const daysInMonth = getDaysInMonth(monthStart)
      const day = Math.min(template.dayOfMonth, daysInMonth)
      const date = new Date(monthStart)
      date.setDate(day)

      return {
        accountId: template.accountId,
        categoryId: template.categoryId,
        type: template.type,
        amount: new Prisma.Decimal(toDecimalString(template.amount.toNumber())),
        currency: template.currency,
        date,
        month: monthStart,
        description: template.description,
        isRecurring: true,
        recurringTemplateId: template.id,
      }
    })

  if (transactionsToCreate.length === 0) {
    return { created: 0 }
  }

  await prisma.transaction.createMany({ data: transactionsToCreate })

  return { created: transactionsToCreate.length }
}
