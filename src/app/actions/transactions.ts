'use server'

import { Currency, Prisma, TransactionType, RequestStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getMonthStart, getMonthKey } from '@/utils/date'
import { successVoid, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import {
  parseInput,
  toDecimalString,
  requireAuthUser,
  ensureAccountAccess,
  ensureAccountAccessWithSubscription,
  requireCsrfToken,
  requireActiveSubscription,
} from './shared'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import {
  transactionSchema,
  transactionUpdateSchema,
  deleteTransactionSchema,
  transactionRequestSchema,
  idSchema,
  type TransactionInput,
  type TransactionUpdateInput,
  type TransactionRequestInput,
} from '@/schemas'
import { z } from 'zod'

async function createRecurringTemplateForTransaction(data: {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency: Currency
  date: Date
  description?: string | null
  monthStart: Date
}): Promise<string> {
  const dayOfMonth = data.date.getUTCDate()

  const template = await prisma.recurringTemplate.create({
    data: {
      accountId: data.accountId,
      categoryId: data.categoryId,
      type: data.type,
      amount: new Prisma.Decimal(toDecimalString(data.amount)),
      currency: data.currency,
      dayOfMonth,
      description: data.description ?? null,
      startMonth: data.monthStart,
      endMonth: null,
      isActive: true,
    },
  })
  return template.id
}

export async function createTransactionRequestAction(input: TransactionRequestInput) {
  const parsed = parseInput(transactionRequestSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // Check subscription before allowing transaction request creation
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Determine current user's account ID (the 'from' account)
  const fromAccount = await prisma.account.findFirst({
    where: { userId: authUser.id, type: 'SELF' },
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
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createTransactionRequest',
      userId: authUser.id,
      input: data,
      uniqueMessage: 'A similar transaction request already exists',
      foreignKeyMessage: 'The selected account or category no longer exists',
      fallbackMessage: 'Unable to create transaction request',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function approveTransactionRequestAction(input: z.infer<typeof idSchema>) {
  const parsed = parseInput(idSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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

  if (!toAccount || toAccount.userId !== authUser.id) {
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
      prisma.transaction.create({
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

    // Invalidate dashboard cache for affected month/account
    const monthKey = getMonthKey(request.date)
    await invalidateDashboardCache({
      monthKey,
      accountId: request.toId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'approveTransactionRequest',
      userId: authUser.id,
      input: { requestId: request.id },
      notFoundMessage: 'Transaction request not found',
      fallbackMessage: 'Unable to approve transaction request',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function rejectTransactionRequestAction(input: z.infer<typeof idSchema>) {
  const parsed = parseInput(idSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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

  if (!toAccount || toAccount.userId !== authUser.id) {
    return generalError('You do not have access to this transaction request')
  }

  try {
    await prisma.transactionRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.REJECTED },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'rejectTransactionRequest',
      userId: authUser.id,
      input: { requestId: request.id },
      notFoundMessage: 'Transaction request not found',
      fallbackMessage: 'Unable to reject transaction request',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function createTransactionAction(input: TransactionInput) {
  const parsed = parseInput(transactionSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccessWithSubscription(data.accountId)
  if ('error' in access) {
    return access
  }

  try {
    let recurringTemplateId: string | null = data.recurringTemplateId ?? null

    // Auto-create RecurringTemplate if isRecurring is checked and no existing template
    if (data.isRecurring && !data.recurringTemplateId) {
      recurringTemplateId = await createRecurringTemplateForTransaction({
        accountId: data.accountId,
        categoryId: data.categoryId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        date: data.date,
        description: data.description,
        monthStart,
      })
    }

    await prisma.transaction.create({
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
        recurringTemplateId,
      },
    })

    // Invalidate dashboard cache for affected month/account
    const monthKey = getMonthKey(data.date)
    await invalidateDashboardCache({
      monthKey,
      accountId: data.accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createTransaction',
      accountId: data.accountId,
      input: data,
      foreignKeyMessage: 'The selected account or category no longer exists',
      fallbackMessage: 'Unable to create transaction',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function updateTransactionAction(input: TransactionUpdateInput) {
  const parsed = parseInput(transactionUpdateSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data
  const monthStart = getMonthStart(data.date)

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  // Pre-flight checks outside the transaction to avoid holding locks during auth checks
  // 1. Check subscription status (user-level, independent of specific transaction)
  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  // 2. Check new account access if moving to a different account
  const newAccountAccess = await ensureAccountAccess(data.accountId)
  if ('error' in newAccountAccess) {
    return newAccountAccess
  }

  try {
    // Use atomic transaction to prevent race conditions between find and update
    const result = await prisma.$transaction(async (tx) => {
      // Find and lock the transaction within the same database transaction
      const existing = await tx.transaction.findUnique({
        where: { id: data.id },
        select: {
          accountId: true,
          month: true,
          recurringTemplateId: true,
        },
      })

      if (!existing) {
        return { error: 'not_found' as const }
      }

      // Check access to the existing account (subscription already verified above)
      const existingAccess = await ensureAccountAccess(existing.accountId)
      if ('error' in existingAccess) {
        return { error: 'access_denied' as const, details: existingAccess }
      }

      // Use provided template ID, fall back to existing, or auto-create if marking as recurring
      let recurringTemplateId: string | null = data.recurringTemplateId ?? existing.recurringTemplateId

      // Auto-create RecurringTemplate if transaction is being marked as recurring and has no template
      if (data.isRecurring && !recurringTemplateId) {
        recurringTemplateId = await createRecurringTemplateForTransaction({
          accountId: data.accountId,
          categoryId: data.categoryId,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          date: data.date,
          description: data.description,
          monthStart,
        })
      }

      await tx.transaction.update({
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
          recurringTemplateId,
        },
      })

      return { success: true as const, existing }
    })

    // Handle transaction result
    if ('error' in result) {
      if (result.error === 'not_found') {
        return generalError('Transaction not found')
      }
      if (result.error === 'access_denied' && result.details) {
        return result.details
      }
    }

    if (!('success' in result)) {
      return generalError('Unable to update transaction')
    }

    const { existing } = result

    // Invalidate dashboard cache for affected months/accounts
    const newMonthKey = getMonthKey(data.date)
    const oldMonthKey = getMonthKey(existing.month)

    // Invalidate old month/account if different
    if (oldMonthKey !== newMonthKey || existing.accountId !== data.accountId) {
      await invalidateDashboardCache({
        monthKey: oldMonthKey,
        accountId: existing.accountId,
      })
    }

    // Invalidate new month/account
    await invalidateDashboardCache({
      monthKey: newMonthKey,
      accountId: data.accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'updateTransaction',
      accountId: data.accountId,
      input: data,
      notFoundMessage: 'Transaction not found',
      foreignKeyMessage: 'The selected account or category no longer exists',
      fallbackMessage: 'Unable to update transaction',
    })
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteTransactionAction(input: z.infer<typeof deleteTransactionSchema>) {
  const parsed = parseInput(deleteTransactionSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let transaction
  try {
    transaction = await prisma.transaction.findUnique({
      where: { id: parsed.data.id },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteTransaction.findUnique',
      input: { id: parsed.data.id },
      fallbackMessage: 'Unable to delete transaction',
    })
  }

  if (!transaction) {
    return generalError('Transaction not found')
  }

  const access = await ensureAccountAccessWithSubscription(transaction.accountId)
  if ('error' in access) {
    return access
  }

  try {
    await prisma.transaction.delete({ where: { id: parsed.data.id } })

    // Invalidate dashboard cache for affected month/account
    const monthKey = getMonthKey(transaction.month)
    await invalidateDashboardCache({
      monthKey,
      accountId: transaction.accountId,
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'deleteTransaction',
      accountId: transaction.accountId,
      input: { id: parsed.data.id },
      notFoundMessage: 'Transaction not found',
      fallbackMessage: 'Unable to delete transaction',
    })
  }
  revalidatePath('/')
  return successVoid()
}
