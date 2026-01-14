'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma adapter requires any casts for some models */
import { Prisma, TransactionType, RequestStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getMonthStart } from '@/utils/date'
import { successVoid, generalError } from '@/lib/action-result'
import { parseInput, toDecimalString, requireAuthUser, ensureAccountAccess, requireCsrfToken } from './shared'
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

export async function createTransactionRequestAction(input: TransactionRequestInput) {
  const parsed = parseInput(transactionRequestSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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
    return generalError('Unable to create transaction request')
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
    return generalError('Unable to approve transaction request')
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

  if (!toAccount || !authUser.accountNames.includes(toAccount.name)) {
    return generalError('You do not have access to this transaction request')
  }

  try {
    await prisma.transactionRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.REJECTED },
    })
  } catch (err) {
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

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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
    return generalError('Unable to update transaction')
  }

  revalidatePath('/')
  return successVoid()
}

export async function deleteTransactionAction(input: z.infer<typeof deleteTransactionSchema>) {
  const parsed = parseInput(deleteTransactionSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

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
    return generalError('Transaction not found')
  }
  revalidatePath('/')
  return successVoid()
}
