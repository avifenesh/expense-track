'use server'

import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, toDecimalString, ensureAccountAccessWithSubscription, requireCsrfToken } from './shared'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import {
  recurringTemplateSchema,
  toggleRecurringSchema,
  applyRecurringSchema,
  deleteRecurringTemplateSchema,
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

  const access = await ensureAccountAccessWithSubscription(data.accountId)
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
  } catch (error) {
    return handlePrismaError(error, {
      action: 'upsertRecurringTemplate',
      accountId: data.accountId,
      input: data,
      notFoundMessage: 'Recurring template not found',
      foreignKeyMessage: 'The selected account or category no longer exists',
      fallbackMessage: 'Unable to save recurring template',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function toggleRecurringTemplateAction(input: z.infer<typeof toggleRecurringSchema>) {
  const parsed = parseInput(toggleRecurringSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let template
  try {
    template = await prisma.recurringTemplate.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'toggleRecurringTemplate.findFirst',
      input: parsed.data,
      fallbackMessage: 'Unable to update recurring template',
    })
  }

  if (!template) {
    return generalError('Recurring template not found')
  }

  const access = await ensureAccountAccessWithSubscription(template.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.recurringTemplate.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'toggleRecurringTemplate',
      accountId: template.accountId,
      input: parsed.data,
      notFoundMessage: 'Recurring template not found',
      fallbackMessage: 'Unable to update recurring template',
    })
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

  const access = await ensureAccountAccessWithSubscription(accountId)
  if ('error' in access) {
    return access
  }

  const where: Prisma.RecurringTemplateWhereInput = {
    isActive: true,
    deletedAt: null,
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
      deletedAt: null,
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

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'applyRecurringTemplates',
      accountId,
      input: { monthKey, templateIds },
      foreignKeyMessage: 'Some templates reference accounts or categories that no longer exist',
      fallbackMessage: 'Unable to create recurring transactions',
    })
  }

  revalidatePath('/')
  return success({ created: transactionsToCreate.length })
}

export async function deleteRecurringTemplateAction(
  input: z.infer<typeof deleteRecurringTemplateSchema>,
) {
  const parsed = parseInput(deleteRecurringTemplateSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let template
  try {
    template = await prisma.recurringTemplate.findFirst({
      where: { id: parsed.data.id, deletedAt: null },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteRecurringTemplate.findFirst',
      input: parsed.data,
      fallbackMessage: 'Unable to delete recurring template',
    })
  }

  if (!template) {
    return generalError('Recurring template not found')
  }

  const access = await ensureAccountAccessWithSubscription(template.accountId)
  if ('error' in access) {
    return access
  }
  const { authUser } = access

  try {
    await prisma.recurringTemplate.update({
      where: { id: parsed.data.id },
      data: {
        deletedAt: new Date(),
        deletedBy: authUser.id,
      },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteRecurringTemplate',
      accountId: template.accountId,
      input: parsed.data,
      notFoundMessage: 'Recurring template not found',
      fallbackMessage: 'Unable to delete recurring template',
    })
  }

  revalidatePath('/')
  return successVoid()
}
