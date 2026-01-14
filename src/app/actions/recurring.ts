'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, toDecimalString, ensureAccountAccess, requireCsrfToken } from './shared'
import {
  recurringTemplateSchema,
  toggleRecurringSchema,
  applyRecurringSchema,
  type RecurringTemplateInput,
} from '@/schemas'

export async function upsertRecurringTemplateAction(input: RecurringTemplateInput) {
  const parsed = parseInput(recurringTemplateSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null

  if (endMonth && endMonth < startMonth) {
    return failure({ endMonthKey: ['End month must be after the start month'] })
  }

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(data.accountId)
  if ('error' in access) {
    return access
  }

  const payload = {
    accountId: data.accountId,
    categoryId: data.categoryId,
    type: data.type,
    amount: new Prisma.Decimal(toDecimalString(data.amount)),
    currency: data.currency,
    dayOfMonth: data.dayOfMonth,
    description: data.description ?? null,
    startMonth,
    endMonth,
    isActive: data.isActive ?? true,
  }

  try {
    if (data.id) {
      await prisma.recurringTemplate.update({
        where: { id: data.id },
        data: payload,
      })
    } else {
      await prisma.recurringTemplate.create({ data: payload })
    }
  } catch (err) {
    return generalError('Unable to save recurring template')
  }

  revalidatePath('/')
  return successVoid()
}

export async function toggleRecurringTemplateAction(input: z.infer<typeof toggleRecurringSchema>) {
  const parsed = parseInput(toggleRecurringSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  try {
    const template = await prisma.recurringTemplate.findUnique({ where: { id: parsed.data.id } })
    if (!template) {
      return generalError('Recurring template not found')
    }

    const access = await ensureAccountAccess(template.accountId)
    if ('error' in access) {
      return access
    }

    await prisma.recurringTemplate.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    })
  } catch (err) {
    return generalError('Recurring template not found')
  }

  revalidatePath('/')
  return successVoid()
}

export async function applyRecurringTemplatesAction(input: z.infer<typeof applyRecurringSchema>) {
  const parsed = parseInput(applyRecurringSchema, input)
  if ('error' in parsed) return parsed
  const { monthKey, accountId, templateIds, csrfToken } = parsed.data
  const monthStart = getMonthStartFromKey(monthKey)

  const csrfCheck = await requireCsrfToken(csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  const where: Prisma.RecurringTemplateWhereInput = {
    isActive: true,
    startMonth: { lte: monthStart },
    OR: [{ endMonth: null }, { endMonth: { gte: monthStart } }],
  }

  where.accountId = accountId

  if (templateIds && templateIds.length > 0) {
    where.id = { in: templateIds }
  }

  const templates = await prisma.recurringTemplate.findMany({ where })

  if (templates.length === 0) {
    return success({ created: 0 })
  }

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
    return success({ created: 0 })
  }

  try {
    await prisma.transaction.createMany({ data: transactionsToCreate })
  } catch (err) {
    return generalError('Unable to create recurring transactions')
  }

  revalidatePath('/')
  return success({ created: transactionsToCreate.length })
}
