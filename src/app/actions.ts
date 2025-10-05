'use server'

import { Prisma, TransactionType, Currency } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStart, getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'
import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import {
  clearSession,
  establishSession,
  updateSessionAccount,
  verifyCredentials,
  getAuthUserFromSession,
  requireSession,
} from '@/lib/auth-server'
import { refreshExchangeRates } from '@/lib/currency'

const AMOUNT_SCALE = 100

function toDecimalString(input: number) {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(2)
}

type AccountRecord = NonNullable<Awaited<ReturnType<typeof prisma.account.findUnique>>>

type AccountAccessSuccess = {
  account: AccountRecord
  authUser: (typeof AUTH_USERS)[number]
}

type AccountAccessError = { error: Record<string, string[]> }

async function ensureAccountAccess(accountId: string): Promise<AccountAccessSuccess | AccountAccessError> {
  let session
  try {
    session = await requireSession()
  } catch (error) {
    return { error: { general: ['Your session expired. Please sign in again.'] } }
  }

  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return { error: { general: ['We could not resolve your user profile. Please sign in again.'] } }
  }

  let account
  try {
    account = await prisma.account.findUnique({ where: { id: accountId } })
  } catch (error) {
    console.error('ensureAccountAccess.accountLookup', error)
    return { error: { general: ['Unable to verify the selected account. Try again shortly.'] } }
  }

  if (!account) {
    return { error: { accountId: ['Account not found'] } }
  }

  if (!authUser.accountNames.includes(account.name)) {
    return { error: { accountId: ['You do not have access to this account'] } }
  }

  return { account, authUser }
}

const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  type: z.nativeEnum(TransactionType),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  isMutual: z.boolean().optional().default(false),
  recurringTemplateId: z.string().optional().nullable(),
})

type TransactionInput = z.infer<typeof transactionSchema>

const transactionUpdateSchema = transactionSchema.extend({
  id: z.string().min(1),
})

type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

export async function createTransactionAction(input: TransactionInput) {
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const access = await ensureAccountAccess(data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await(prisma as any).transaction.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: new Prisma.Decimal(toDecimalString(data.amount)),
        currency: data.currency,
        date: data.date,
        month: monthStart,
        description: data.description,
        isRecurring: data.isRecurring ?? false,
        isMutual: data.isMutual ?? false,
        recurringTemplateId: data.recurringTemplateId ?? null,
      },
    });
  } catch (error) {
    console.error('createTransactionAction', error)
    return { error: { general: ['Unable to create transaction'] } }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateTransactionAction(input: TransactionUpdateInput) {
  const parsed = transactionUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const existing = await prisma.transaction.findUnique({
    where: { id: data.id },
    select: {
      accountId: true,
    },
  })

  if (!existing) {
    return { error: { general: ['Transaction not found'] } }
  }

  const existingAccess = await ensureAccountAccess(existing.accountId)
  if ('error' in existingAccess) {
    return existingAccess
  }

  if (existing.accountId !== data.accountId) {
    const newAccountAccess = await ensureAccountAccess(data.accountId)
    if ('error' in newAccountAccess) {
      return newAccountAccess
    }
  }

  try {
    await(prisma as any).transaction.update({
      where: { id: data.id },
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: new Prisma.Decimal(toDecimalString(data.amount)),
        currency: data.currency,
        date: data.date,
        month: monthStart,
        description: data.description,
        isRecurring: data.isRecurring ?? false,
        isMutual: data.isMutual ?? false,
      },
    });
  } catch (error) {
    console.error('updateTransactionAction', error)
    return { error: { general: ['Unable to update transaction'] } }
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
    const transaction = await prisma.transaction.findUnique({
      where: { id: parsed.data.id },
    })

    if (!transaction) {
      return { error: { general: ['Transaction not found'] } }
    }

    const access = await ensureAccountAccess(transaction.accountId)
    if ('error' in access) {
      return access
    }

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
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240).optional().nullable(),
})

type BudgetInput = z.infer<typeof budgetSchema>

export async function upsertBudgetAction(input: BudgetInput) {
  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

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
  currency: z.nativeEnum(Currency).default(Currency.USD),
  dayOfMonth: z.coerce.number().min(1).max(31),
  description: z.string().max(240).optional().nullable(),
  startMonthKey: z.string().min(7, 'Start month is required'),
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
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null

  if (endMonth && endMonth < startMonth) {
    return { error: { endMonthKey: ['End month must be after the start month'] } }
  }

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
    const template = await prisma.recurringTemplate.findUnique({ where: { id: parsed.data.id } })
    if (!template) {
      return { error: { general: ['Recurring template not found'] } }
    }

    const access = await ensureAccountAccess(template.accountId)
    if ('error' in access) {
      return access
    }

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
  accountId: z.string().min(1),
  templateIds: z.array(z.string()).optional(),
})

export async function applyRecurringTemplatesAction(input: z.infer<typeof applyRecurringSchema>) {
  const parsed = applyRecurringSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { monthKey, accountId, templateIds } = parsed.data
  const monthStart = getMonthStartFromKey(monthKey)

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  const where: Prisma.RecurringTemplateWhereInput = {
    isActive: true,
    startMonth: { lte: monthStart },
    OR: [
      { endMonth: null },
      { endMonth: { gte: monthStart } },
    ],
  }

  where.accountId = accountId

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
        currency: template.currency,
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
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function loginAction(input: z.infer<typeof loginSchema>) {
  const parsed = loginSchema.safeParse({
    ...input,
    email: input.email.trim().toLowerCase(),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)

  const credentialsValid = await verifyCredentials({ email, password })
  if (!credentialsValid) {
    return { error: { credentials: ['Invalid username or password'] } }
  }

  if (!authUser) {
    return { error: { credentials: ['Invalid username or password'] } }
  }

  const accounts = await prisma.account.findMany({
    where: { name: { in: authUser.accountNames } },
    orderBy: { name: 'asc' },
  })

  if (accounts.length === 0) {
    return {
      error: {
        general: ['No accounts are provisioned for this user. Please contact support.'],
      },
    }
  }

  const defaultAccount =
    accounts.find((account) => account.name === authUser.defaultAccountName) ?? accounts[0]

  await establishSession({ userEmail: authUser.email, accountId: defaultAccount.id })
  return { success: true, accountId: defaultAccount.id }
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

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  const updateResult = await updateSessionAccount(access.account.id)
  if ('error' in updateResult) {
    return { error: { general: [updateResult.error] } }
  }

  return { success: true }
}

export async function refreshExchangeRatesAction() {
  try {
    await requireSession()
  } catch (error) {
    return { error: { general: ['Your session expired. Please sign in again.'] } }
  }

  try {
    const result = await refreshExchangeRates()
    if (!result.success) {
      return { error: { general: [result.error || 'Failed to refresh exchange rates'] } }
    }

    revalidatePath('/')
    return { success: true, updatedAt: result.updatedAt }
  } catch (error) {
    console.error('refreshExchangeRatesAction', error)
    return { error: { general: ['Unable to refresh exchange rates'] } }
  }
}

// Holdings Actions

const holdingSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  symbol: z.string().min(1).max(10).regex(/^[A-Z]+$/, 'Symbol must be uppercase letters'),
  quantity: z.coerce.number().min(0.000001).max(999999999, 'Quantity out of range'),
  averageCost: z.coerce.number().min(0, 'Average cost cannot be negative'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240, 'Keep notes short').optional().nullable(),
})

type HoldingInput = z.infer<typeof holdingSchema>

export async function createHoldingAction(input: HoldingInput) {
  const parsed = holdingSchema.safeParse({
    ...input,
    symbol: input.symbol.toUpperCase(),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const data = parsed.data
  const access = await ensureAccountAccess(data.accountId)
  if ('error' in access) {
    return access
  }

  // Validate that category has isHolding = true
  try {
    const category = await prisma.category.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      return { error: { categoryId: ['Category not found'] } }
    }

    if (!category.isHolding) {
      return { error: { categoryId: ['Category must be marked as a holding category'] } }
    }
  } catch (error) {
    console.error('createHoldingAction.categoryCheck', error)
    return { error: { general: ['Unable to validate category'] } }
  }

  // Test symbol validity with API call (counts toward daily limit)
  const { fetchStockQuote } = await import('@/lib/stock-api')
  try {
    await fetchStockQuote(data.symbol)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid symbol'
    return { error: { symbol: [errorMessage] } }
  }

  // Create holding
  try {
    await(prisma as any).holding.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        symbol: data.symbol,
        quantity: new Prisma.Decimal(data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(toDecimalString(data.averageCost)),
        currency: data.currency,
        notes: data.notes ?? null,
      },
    });
  } catch (error) {
    console.error('createHoldingAction', error)
    return { error: { general: ['Unable to create holding. It may already exist.'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const updateHoldingSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0.000001).max(999999999),
  averageCost: z.coerce.number().min(0),
  notes: z.string().max(240).optional().nullable(),
})

export async function updateHoldingAction(input: z.infer<typeof updateHoldingSchema>) {
  const parsed = updateHoldingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    const holding = await(prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    });

    if (!holding) {
      return { error: { general: ['Holding not found'] } }
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await(prisma as any).holding.update({
      where: { id: parsed.data.id },
      data: {
        quantity: new Prisma.Decimal(parsed.data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(
          toDecimalString(parsed.data.averageCost)
        ),
        notes: parsed.data.notes ?? null,
      },
    });
  } catch (error) {
    console.error('updateHoldingAction', error)
    return { error: { general: ['Holding not found'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const deleteHoldingSchema = z.object({
  id: z.string().min(1),
})

export async function deleteHoldingAction(input: z.infer<typeof deleteHoldingSchema>) {
  const parsed = deleteHoldingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  try {
    const holding = await(prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    });

    if (!holding) {
      return { error: { general: ['Holding not found'] } }
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await(prisma as any).holding.delete({
      where: { id: parsed.data.id },
    });
  } catch (error) {
    console.error('deleteHoldingAction', error)
    return { error: { general: ['Holding not found'] } }
  }

  revalidatePath('/')
  return { success: true }
}

const refreshHoldingPricesSchema = z.object({
  accountId: z.string().min(1),
})

export async function refreshHoldingPricesAction(input: z.infer<typeof refreshHoldingPricesSchema>) {
  const parsed = refreshHoldingPricesSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    // Get all unique symbols for this account's holdings
    const holdings = await(prisma as any).holding.findMany({
      where: { accountId: parsed.data.accountId },
      select: { symbol: true },
    });

    const symbols: string[] = Array.from(
      new Set(holdings.map((h: any) => h.symbol as string))
    );

    if (symbols.length === 0) {
      return { success: true, updated: 0, skipped: 0, errors: [] }
    }

    const { refreshStockPrices } = await import('@/lib/stock-api')
    const result = await refreshStockPrices(symbols)

    revalidatePath('/')
    return { success: true, ...result }
  } catch (error) {
    console.error('refreshHoldingPricesAction', error)
    return { error: { general: ['Unable to refresh stock prices'] } }
  }
}
