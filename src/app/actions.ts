'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for some models */
import { Prisma, TransactionType, Currency, RequestStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getMonthStart, getMonthStartFromKey } from '@/utils/date'
import { getDaysInMonth } from 'date-fns'
import { AUTH_USERS, RECOVERY_CONTACTS, type AuthUser } from '@/lib/auth'
import {
  clearSession,
  establishSession,
  updateSessionAccount,
  verifyCredentials,
  getAuthUserFromSession,
  requireSession,
} from '@/lib/auth-server'
import { refreshExchangeRates } from '@/lib/currency'
import { success, successVoid, failure, generalError } from '@/lib/action-result'

// Currency precision: 2 decimal places (cents), scale factor 100
const DECIMAL_PRECISION = 2
const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)

function toDecimalString(input: number) {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
}

function parseInput<T>(schema: z.ZodSchema<T>, input: unknown): { data: T } | { error: Record<string, string[]> } {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }
  return { data: parsed.data }
}

type AuthUserResult = { authUser: AuthUser } | { error: Record<string, string[]> }

async function requireAuthUser(): Promise<AuthUserResult> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { error: { general: ['Your session expired. Please sign in again.'] } }
  }

  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return { error: { general: ['We could not resolve your user profile. Please sign in again.'] } }
  }

  return { authUser }
}

type AccountRecord = NonNullable<Awaited<ReturnType<typeof prisma.account.findUnique>>>

type AccountAccessSuccess = {
  account: AccountRecord
  authUser: AuthUser
}

type AccountAccessError = { error: Record<string, string[]> }

async function ensureAccountAccess(accountId: string): Promise<AccountAccessSuccess | AccountAccessError> {
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  let account
  try {
    account = await prisma.account.findUnique({ where: { id: accountId } })
  } catch (err) {
    console.error('ensureAccountAccess.accountLookup', err)
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
  recurringTemplateId: z.string().optional().nullable(),
})

type TransactionInput = z.infer<typeof transactionSchema>

const transactionUpdateSchema = transactionSchema.extend({
  id: z.string().min(1),
})

type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>

const transactionRequestSchema = z.object({
  toId: z.string().min(1, 'Target partner account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  date: z.coerce.date(),
  description: z.string().max(240, 'Keep the description short').optional().nullable(),
})

type TransactionRequestInput = z.infer<typeof transactionRequestSchema>

export async function createTransactionRequestAction(input: TransactionRequestInput) {
  const parsed = parseInput(transactionRequestSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Determine current user's account ID (the 'from' account)
  const fromAccount = await prisma.account.findFirst({
    where: { name: { in: authUser.accountNames }, type: 'SELF' },
  })

  if (!fromAccount) {
    return generalError('Unable to identify your primary account')
  }

  try {
    await prisma.transactionRequest.create({
      data: {
        fromId: fromAccount.id,
        toId: data.toId,
        categoryId: data.categoryId,
        amount: new Prisma.Decimal(toDecimalString(data.amount)),
        currency: data.currency,
        date: data.date,
        description: data.description,
        status: RequestStatus.PENDING,
      },
    })
  } catch (err) {
    console.error('createTransactionRequestAction', err)
    return generalError('Unable to create transaction request')
  }

  revalidatePath('/')
  return successVoid()
}

const idSchema = z.object({
  id: z.string().min(1),
})

export async function approveTransactionRequestAction(input: z.infer<typeof idSchema>) {
  const parsed = parseInput(idSchema, input)
  if ('error' in parsed) return parsed

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const request = await prisma.transactionRequest.findUnique({
    where: { id: parsed.data.id },
  })

  if (!request) {
    return generalError('Transaction request not found')
  }

  // Ensure the user has access to the 'to' account
  const toAccount = await prisma.account.findUnique({
    where: { id: request.toId },
  })

  if (!toAccount || !authUser.accountNames.includes(toAccount.name)) {
    return generalError('You do not have access to this transaction request')
  }

  if (request.status !== RequestStatus.PENDING) {
    return generalError(`Request is already ${request.status.toLowerCase()}`)
  }

  try {
    await prisma.$transaction([
      prisma.transactionRequest.update({
        where: { id: request.id },
        data: { status: RequestStatus.APPROVED },
      }),
      (prisma as any).transaction.create({
        data: {
          accountId: request.toId,
          categoryId: request.categoryId,
          type: TransactionType.EXPENSE,
          amount: request.amount,
          currency: request.currency,
          date: request.date,
          month: getMonthStart(request.date),
          description: request.description,
        },
      }),
    ])
  } catch (err) {
    console.error('approveTransactionRequestAction', err)
    return generalError('Unable to approve transaction request')
  }

  revalidatePath('/')
  return successVoid()
}

export async function rejectTransactionRequestAction(input: z.infer<typeof idSchema>) {
  const parsed = parseInput(idSchema, input)
  if ('error' in parsed) return parsed

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const request = await prisma.transactionRequest.findUnique({
    where: { id: parsed.data.id },
  })

  if (!request) {
    return generalError('Transaction request not found')
  }

  const toAccount = await prisma.account.findUnique({
    where: { id: request.toId },
  })

  if (!toAccount || !authUser.accountNames.includes(toAccount.name)) {
    return generalError('You do not have access to this transaction request')
  }

  try {
    await prisma.transactionRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.REJECTED },
    })
  } catch (err) {
    console.error('rejectTransactionRequestAction', err)
    return generalError('Unable to reject transaction request')
  }

  revalidatePath('/')
  return successVoid()
}

export async function createTransactionAction(input: TransactionInput) {
  const parsed = parseInput(transactionSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const access = await ensureAccountAccess(data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await (prisma as any).transaction.create({
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
        recurringTemplateId: data.recurringTemplateId ?? null,
      },
    })
  } catch (err) {
    console.error('createTransactionAction', err)
    return generalError('Unable to create transaction')
  }

  revalidatePath('/')
  return successVoid()
}

export async function updateTransactionAction(input: TransactionUpdateInput) {
  const parsed = parseInput(transactionUpdateSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const existing = await prisma.transaction.findUnique({
    where: { id: data.id },
    select: {
      accountId: true,
    },
  })

  if (!existing) {
    return generalError('Transaction not found')
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
    await (prisma as any).transaction.update({
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
      },
    })
  } catch (err) {
    console.error('updateTransactionAction', err)
    return generalError('Unable to update transaction')
  }

  revalidatePath('/')
  return successVoid()
}

const deleteTransactionSchema = z.object({
  id: z.string().min(1),
})

export async function deleteTransactionAction(input: z.infer<typeof deleteTransactionSchema>) {
  const parsed = parseInput(deleteTransactionSchema, input)
  if ('error' in parsed) return parsed

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: parsed.data.id },
    })

    if (!transaction) {
      return generalError('Transaction not found')
    }

    const access = await ensureAccountAccess(transaction.accountId)
    if ('error' in access) {
      return access
    }

    await prisma.transaction.delete({ where: { id: parsed.data.id } })
  } catch (err) {
    console.error('deleteTransactionAction', err)
    return generalError('Transaction not found')
  }
  revalidatePath('/')
  return successVoid()
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

const deleteBudgetSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: z.string().min(7),
})

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
  const parsed = parseInput(recurringTemplateSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null

  if (endMonth && endMonth < startMonth) {
    return failure({ endMonthKey: ['End month must be after the start month'] })
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
  } catch (err) {
    console.error('upsertRecurringTemplateAction', err)
    return generalError('Unable to save recurring template')
  }

  revalidatePath('/')
  return successVoid()
}

const toggleRecurringSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
})

export async function toggleRecurringTemplateAction(input: z.infer<typeof toggleRecurringSchema>) {
  const parsed = parseInput(toggleRecurringSchema, input)
  if ('error' in parsed) return parsed

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
    console.error('toggleRecurringTemplateAction', err)
    return generalError('Recurring template not found')
  }

  revalidatePath('/')
  return successVoid()
}

const applyRecurringSchema = z.object({
  monthKey: z.string().min(7),
  accountId: z.string().min(1),
  templateIds: z.array(z.string()).optional(),
})

export async function applyRecurringTemplatesAction(input: z.infer<typeof applyRecurringSchema>) {
  const parsed = parseInput(applyRecurringSchema, input)
  if ('error' in parsed) return parsed
  const { monthKey, accountId, templateIds } = parsed.data
  const monthStart = getMonthStartFromKey(monthKey)

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
    console.error('applyRecurringTemplatesAction', err)
    return generalError('Unable to create recurring transactions')
  }

  revalidatePath('/')
  return success({ created: transactionsToCreate.length })
}

const categorySchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(TransactionType),
  color: z.string().optional().nullable(),
})

export async function createCategoryAction(input: z.infer<typeof categorySchema>) {
  const parsed = parseInput(categorySchema, input)
  if ('error' in parsed) return parsed

  try {
    await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color ?? null,
      },
    })
  } catch (err) {
    console.error('createCategoryAction', err)
    return generalError('Category already exists')
  }

  revalidatePath('/')
  return successVoid()
}

const archiveCategorySchema = z.object({
  id: z.string().min(1),
  isArchived: z.boolean(),
})

export async function archiveCategoryAction(input: z.infer<typeof archiveCategorySchema>) {
  const parsed = parseInput(archiveCategorySchema, input)
  if ('error' in parsed) return parsed

  try {
    await prisma.category.update({
      where: { id: parsed.data.id },
      data: { isArchived: parsed.data.isArchived },
    })
  } catch (err) {
    console.error('archiveCategoryAction', err)
    return generalError('Category not found')
  }

  revalidatePath('/')
  return successVoid()
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export async function loginAction(input: z.infer<typeof loginSchema>) {
  const parsed = parseInput(loginSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed
  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)

  const credentialsValid = await verifyCredentials({ email, password })
  if (!credentialsValid) {
    return failure({ credentials: ['Invalid username or password'] })
  }

  if (!authUser) {
    return failure({ credentials: ['Invalid username or password'] })
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

  const defaultAccount = accounts.find((account) => account.name === authUser.defaultAccountName) ?? accounts[0]

  await establishSession({ userEmail: authUser.email, accountId: defaultAccount.id })
  return success({ accountId: defaultAccount.id })
}

export async function logoutAction() {
  await clearSession()
  return successVoid()
}

const recoverySchema = z.object({
  email: z.string().email('Provide a valid email address'),
})

export async function requestPasswordResetAction(input: z.infer<typeof recoverySchema>) {
  const parsed = parseInput(recoverySchema, input)
  if ('error' in parsed) return parsed

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
  const parsed = parseInput(accountSelectionSchema, input)
  if ('error' in parsed) return parsed

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  const updateResult = await updateSessionAccount(access.account.id)
  if ('error' in updateResult) {
    return updateResult
  }

  return successVoid()
}

export async function refreshExchangeRatesAction() {
  try {
    await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  try {
    const result = await refreshExchangeRates()
    if ('error' in result) {
      return result
    }

    revalidatePath('/')
    return success({ updatedAt: result.updatedAt })
  } catch (err) {
    console.error('refreshExchangeRatesAction', err)
    return generalError('Unable to refresh exchange rates')
  }
}

// Holdings Actions

const holdingSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  symbol: z
    .string()
    .min(1)
    .max(5, 'Stock symbols are typically 1-5 characters')
    .regex(/^[A-Z]+$/, 'Symbol must be uppercase letters'),
  quantity: z.coerce.number().min(0.000001).max(999999999, 'Quantity out of range'),
  averageCost: z.coerce.number().min(0, 'Average cost cannot be negative'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  notes: z.string().max(240, 'Keep notes short').optional().nullable(),
})

type HoldingInput = z.infer<typeof holdingSchema>

export async function createHoldingAction(input: HoldingInput) {
  const parsed = parseInput(holdingSchema, {
    ...input,
    symbol: input.symbol.toUpperCase(),
  })
  if ('error' in parsed) return parsed
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
      return failure({ categoryId: ['Category not found'] })
    }

    if (!category.isHolding) {
      return failure({ categoryId: ['Category must be marked as a holding category'] })
    }
  } catch (err) {
    console.error('createHoldingAction.categoryCheck', err)
    return generalError('Unable to validate category')
  }

  // Test symbol validity with API call (counts toward daily limit)
  const { fetchStockQuote } = await import('@/lib/stock-api')
  try {
    await fetchStockQuote(data.symbol)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Invalid symbol'
    return failure({ symbol: [errorMessage] })
  }

  // Create holding
  try {
    await (prisma as any).holding.create({
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        symbol: data.symbol,
        quantity: new Prisma.Decimal(data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(toDecimalString(data.averageCost)),
        currency: data.currency,
        notes: data.notes ?? null,
      },
    })
  } catch (err) {
    console.error('createHoldingAction', err)
    return generalError('Unable to create holding. It may already exist.')
  }

  revalidatePath('/')
  return successVoid()
}

const updateHoldingSchema = z.object({
  id: z.string().min(1),
  quantity: z.coerce.number().min(0.000001).max(999999999),
  averageCost: z.coerce.number().min(0),
  notes: z.string().max(240).optional().nullable(),
})

export async function updateHoldingAction(input: z.infer<typeof updateHoldingSchema>) {
  const parsed = parseInput(updateHoldingSchema, input)
  if ('error' in parsed) return parsed

  try {
    const holding = await (prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    })

    if (!holding) {
      return generalError('Holding not found')
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await (prisma as any).holding.update({
      where: { id: parsed.data.id },
      data: {
        quantity: new Prisma.Decimal(parsed.data.quantity.toFixed(6)),
        averageCost: new Prisma.Decimal(toDecimalString(parsed.data.averageCost)),
        notes: parsed.data.notes ?? null,
      },
    })
  } catch (err) {
    console.error('updateHoldingAction', err)
    return generalError('Holding not found')
  }

  revalidatePath('/')
  return successVoid()
}

const deleteHoldingSchema = z.object({
  id: z.string().min(1),
})

export async function deleteHoldingAction(input: z.infer<typeof deleteHoldingSchema>) {
  const parsed = parseInput(deleteHoldingSchema, input)
  if ('error' in parsed) return parsed

  try {
    const holding = await (prisma as any).holding.findUnique({
      where: { id: parsed.data.id },
    })

    if (!holding) {
      return generalError('Holding not found')
    }

    const access = await ensureAccountAccess(holding.accountId)
    if ('error' in access) {
      return access
    }

    await (prisma as any).holding.delete({
      where: { id: parsed.data.id },
    })
  } catch (err) {
    console.error('deleteHoldingAction', err)
    return generalError('Holding not found')
  }

  revalidatePath('/')
  return successVoid()
}

const refreshHoldingPricesSchema = z.object({
  accountId: z.string().min(1),
})

export async function refreshHoldingPricesAction(input: z.infer<typeof refreshHoldingPricesSchema>) {
  const parsed = parseInput(refreshHoldingPricesSchema, input)
  if ('error' in parsed) return parsed

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    // Get all unique symbols for this account's holdings
    const holdings = await (prisma as any).holding.findMany({
      where: { accountId: parsed.data.accountId },
      select: { symbol: true },
    })

    const symbols: string[] = Array.from(new Set(holdings.map((h: any) => h.symbol as string)))

    if (symbols.length === 0) {
      return success({ updated: 0, skipped: 0, errors: [] as string[] })
    }

    const { refreshStockPrices } = await import('@/lib/stock-api')
    const result = await refreshStockPrices(symbols)

    revalidatePath('/')
    return success(result)
  } catch (err) {
    console.error('refreshHoldingPricesAction', err)
    return generalError('Unable to refresh stock prices')
  }
}

const setBalanceSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  targetBalance: z.coerce.number(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
})

export async function setBalanceAction(input: z.infer<typeof setBalanceSchema>) {
  const parsed = parseInput(setBalanceSchema, input)
  if ('error' in parsed) return parsed
  const { accountId, targetBalance, currency, monthKey } = parsed.data

  const access = await ensureAccountAccess(accountId)
  if ('error' in access) {
    return access
  }

  const monthStart = getMonthStartFromKey(monthKey)

  // Find or create "Balance Adjustment" category
  let adjustmentCategory = await prisma.category.findFirst({
    where: { name: 'Balance Adjustment' },
  })

  if (!adjustmentCategory) {
    adjustmentCategory = await prisma.category.create({
      data: {
        name: 'Balance Adjustment',
        type: TransactionType.INCOME,
      },
    })
  }

  // Calculate current net for this account in the current month
  const transactions = await (prisma as any).transaction.findMany({
    where: {
      accountId,
      month: monthStart,
    },
    select: {
      type: true,
      amount: true,
    },
  })

  let currentIncome = 0
  let currentExpense = 0

  for (const t of transactions) {
    const amount = typeof t.amount === 'object' ? Number(t.amount) : t.amount
    if (t.type === TransactionType.INCOME) {
      currentIncome += amount
    } else {
      currentExpense += amount
    }
  }

  const currentNet = currentIncome - currentExpense
  const adjustment = targetBalance - currentNet

  // If no adjustment needed, return early
  if (Math.abs(adjustment) < 0.01) {
    return success({ adjustment: 0 })
  }

  // Create adjustment transaction
  const transactionType = adjustment > 0 ? TransactionType.INCOME : TransactionType.EXPENSE
  const transactionAmount = Math.abs(adjustment)

  try {
    await (prisma as any).transaction.create({
      data: {
        accountId,
        categoryId: adjustmentCategory.id,
        type: transactionType,
        amount: new Prisma.Decimal(toDecimalString(transactionAmount)),
        currency,
        date: new Date(),
        month: monthStart,
        description: 'Balance adjustment',
        isRecurring: false,
      },
    })
  } catch (err) {
    console.error('setBalanceAction', err)
    return generalError('Unable to create balance adjustment')
  }

  revalidatePath('/')
  return success({ adjustment })
}
