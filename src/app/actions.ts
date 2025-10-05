'use server'

import { Prisma, TransactionType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStart, getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'
import { AUTH_USER, RECOVERY_CONTACTS } from '@/lib/auth'
import {
  clearSession,
  establishSession,
  updateSessionAccount,
  verifyCredentials,
} from '@/lib/auth-server'

const AMOUNT_SCALE = 100

function toDecimalString(input: number) {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(2)
}

const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurringTemplateId: z.string().optional().nullable(),
})

type TransactionInput = z.infer<typeof transactionSchema>

export async function createTransactionAction(input: TransactionInput) {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  try {
    await prisma.transaction.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: new Prisma.Decimal(toDecimalString(data.amount)),
        date: data.date,
        month: monthStart,
        description: data.description,
        isRecurring: data.isRecurring ?? false,
        recurringTemplateId: data.recurringTemplateId ?? null,
      },
    })
  } catch (error) {
    console.error('createTransactionAction', error)
    return { error: { general: ['Unable to create transaction'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const deleteTransactionSchema = z.object({
  id: z.string().min(1),
})

export async function deleteTransactionAction(input: z.infer<typeof deleteTransactionSchema>) {
  const parsed = deleteTransactionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.transaction.delete({ where: { id: parsed.data.id } })
  } catch (error) {
    console.error('deleteTransactionAction', error)
    return { error: { general: ['Transaction not found'] } }
  }
  revalidatePath('/')
  return { success: true }
}

const budgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  notes: z.string().max(240).optional().nullable(),
})

type BudgetInput = z.infer<typeof budgetSchema>

export async function upsertBudgetAction(input: BudgetInput) {
  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { accountId, categoryId, monthKey, planned, notes } = parsed.data
  const month = getMonthStartFromKey(monthKey)

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
        notes: notes ?? null,
      },
      create: {
        accountId,
        categoryId,
        month,
        planned: new Prisma.Decimal(toDecimalString(planned)),
        notes: notes ?? null,
      },
    })
  } catch (error) {
    console.error('upsertBudgetAction', error)
    return { error: { general: ['Unable to save budget'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const deleteBudgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
})

export async function deleteBudgetAction(input: z.infer<typeof deleteBudgetSchema>) {
  const parsed = deleteBudgetSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { accountId, categoryId, monthKey } = parsed.data
  const month = getMonthStartFromKey(monthKey)

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
  } catch (error) {
    console.error('deleteBudgetAction', error)
    return { error: { general: ['Budget entry not found'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const recurringTemplateSchema = z.object({
  id: z.string().optional(),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01),
  dayOfMonth: z.coerce.number().min(1).max(31),
  description: z.string().max(240).optional().nullable(),
  startMonthKey: z.string().min(7).optional().nullable(),
  endMonthKey: z.string().min(7).optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

type RecurringTemplateInput = z.infer<typeof recurringTemplateSchema>

export async function upsertRecurringTemplateAction(input: RecurringTemplateInput) {
  const parsed = recurringTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  const startMonth = data.startMonthKey ? getMonthStartFromKey(data.startMonthKey) : null
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null

  if (startMonth && endMonth && endMonth < startMonth) {
    return { error: { endMonthKey: ['End month must be after the start month'] } }
  }

  const payload = {
    accountId: data.accountId,
    categoryId: data.categoryId,
    type: data.type,
    amount: new Prisma.Decimal(toDecimalString(data.amount)),
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
    console.error('upsertRecurringTemplateAction', error)
    return { error: { general: ['Unable to save recurring template'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const toggleRecurringSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
})

export async function toggleRecurringTemplateAction(input: z.infer<typeof toggleRecurringSchema>) {
  const parsed = toggleRecurringSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.recurringTemplate.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    })
  } catch (error) {
    console.error('toggleRecurringTemplateAction', error)
    return { error: { general: ['Recurring template not found'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const applyRecurringSchema = z.object({
  monthKey: z.string().min(7),
  accountId: z.string().optional(),
  templateIds: z.array(z.string()).optional(),
})

export async function applyRecurringTemplatesAction(input: z.infer<typeof applyRecurringSchema>) {
  const parsed = applyRecurringSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { monthKey, accountId, templateIds } = parsed.data
  const monthStart = getMonthStartFromKey(monthKey)

  const where: Prisma.RecurringTemplateWhereInput = {
    isActive: true,
    OR: [
      { startMonth: null },
      { startMonth: { lte: monthStart } },
    ],
    AND: [
      { OR: [{ endMonth: null }, { endMonth: { gte: monthStart } }] },
    ],
  }

  if (accountId && accountId !== 'all') {
    where.accountId = accountId
  }

  if (templateIds && templateIds.length > 0) {
    where.id = { in: templateIds }
  }

  const templates = await prisma.recurringTemplate.findMany({ where })

  if (templates.length === 0) {
    return { success: true, created: 0 }
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
        date,
        month: monthStart,
        description: template.description,
        isRecurring: true,
        recurringTemplateId: template.id,
      }
    })

  if (transactionsToCreate.length === 0) {
    return { success: true, created: 0 }
  }

  try {
    await prisma.transaction.createMany({ data: transactionsToCreate })
  } catch (error) {
    console.error('applyRecurringTemplatesAction', error)
    return { error: { general: ['Unable to create recurring transactions'] } }
  }

  revalidatePath('/')
  return { success: true, created: transactionsToCreate.length }
}

const categorySchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(TransactionType),
  color: z.string().optional().nullable(),
})

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? null,
      },
    })
  } catch (error) {
    console.error('createCategoryAction', error)
    return { error: { general: ['Category already exists'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const archiveCategorySchema = z.object({
  id: z.string().min(1),
  isArchived: z.boolean(),
})

export async function archiveCategoryAction(input: z.infer<typeof archiveCategorySchema>) {
  const parsed = archiveCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.category.update({
      where: { id: parsed.data.id },
      data: { isArchived: parsed.data.isArchived },
    })
  } catch (error) {
    console.error('archiveCategoryAction', error)
    return { error: { general: ['Category not found'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  accountId: z.string().min(1, 'Choose an account'),
})

export async function loginAction(input: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.safeParse({
    ...input,
    username: input.username.trim().toLowerCase(),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { username, password, accountId } = parsed.data

  let account
  try {
    account = await prisma.account.findUnique({ where: { id: accountId } })
  } catch (error) {
    console.error('loginAction.accountLookup', error)
    return { error: { general: ['We could not verify the selected account. Try again shortly.'] } }
  }

  if (!account) {
    return { error: { accountId: ['Selected account is unavailable'] } }
  }

  const credentialsValid = await verifyCredentials({ username, password })
  if (!credentialsValid) {
    return { error: { credentials: ['Invalid username or password'] } }
  }

  await establishSession({ username: AUTH_USER.username, accountId })
  return { success: true, accountId }
}

export async function logoutAction() {
  await clearSession()
  return { success: true }
}

const recoverySchema = z.object({
  email: z.string().email('Provide a valid email address'),
})

export async function requestPasswordResetAction(input: z.infer<typeof recoverySchema>) {
  const parsed = recoverySchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const recoveryContact = RECOVERY_CONTACTS.find(
    (contact) => contact.email.toLowerCase() === parsed.data.email.trim().toLowerCase(),
  )

  if (!recoveryContact) {
    return {
      error: {
        email: ['Email is not registered. Reach out to the finance team to restore access.'],
      },
    }
  }

  return {
    success: true,
    message: `A reset link was sent to ${recoveryContact.email}. Use the standard password after completing the guided reset.`,
  }
}

const accountSelectionSchema = z.object({
  accountId: z.string().min(1),
})

export async function persistActiveAccountAction(input: z.infer<typeof accountSelectionSchema>) {
  const parsed = accountSelectionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const account = await prisma.account.findUnique({ where: { id: parsed.data.accountId } })
  if (!account) {
    return { error: { accountId: ['Account not found'] } }
  }

  const updateResult = await updateSessionAccount(account.id)
  if ('error' in updateResult) {
    return { error: { general: [updateResult.error] } }
  }

  return { success: true }
}
