import { Prisma, TransactionType, RequestStatus, Currency } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMonthStart } from '@/utils/date'
import { toDecimalString } from '@/utils/decimal'
import { NotFoundError, ValidationError } from './errors'

export interface CreateTransactionInput {
  accountId: string
  categoryId: string
  type: TransactionType
  amount: number
  currency: Currency
  date: Date
  description?: string | null
  isRecurring?: boolean
  recurringTemplateId?: string | null
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string
}

export interface CreateTransactionRequestInput {
  fromId: string
  toId: string
  categoryId: string
  amount: number
  currency: Currency
  date: Date
  description?: string | null
}

/**
 * Create a new transaction
 */
export async function createTransaction(input: CreateTransactionInput) {
  const monthStart = getMonthStart(input.date)

  return await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: new Prisma.Decimal(toDecimalString(input.amount)),
      currency: input.currency,
      date: input.date,
      month: monthStart,
      description: input.description,
      isRecurring: input.isRecurring ?? false,
      recurringTemplateId: input.recurringTemplateId ?? null,
    },
  })
}

/**
 * Update an existing transaction
 */
export async function updateTransaction(input: UpdateTransactionInput) {
  const monthStart = getMonthStart(input.date)

  return await prisma.transaction.update({
    where: { id: input.id },
    data: {
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amount: new Prisma.Decimal(toDecimalString(input.amount)),
      currency: input.currency,
      date: input.date,
      month: monthStart,
      description: input.description,
      isRecurring: input.isRecurring ?? false,
    },
  })
}

/**
 * Delete a transaction by ID
 */
export async function deleteTransaction(id: string) {
  return await prisma.transaction.delete({ where: { id } })
}

/**
 * Get a transaction by ID
 * If userId is provided, only returns the transaction if it belongs to that user (via account)
 */
export async function getTransactionById(id: string, userId?: string) {
  if (userId) {
    return await prisma.transaction.findFirst({
      where: { id, account: { userId } },
      include: { account: true },
    })
  }
  return await prisma.transaction.findUnique({ where: { id } })
}

/**
 * Create a transaction request from one account to another
 */
export async function createTransactionRequest(input: CreateTransactionRequestInput) {
  return await prisma.transactionRequest.create({
    data: {
      fromId: input.fromId,
      toId: input.toId,
      categoryId: input.categoryId,
      amount: new Prisma.Decimal(toDecimalString(input.amount)),
      currency: input.currency,
      date: input.date,
      description: input.description,
      status: RequestStatus.PENDING,
    },
  })
}

/**
 * Get a transaction request by ID
 */
export async function getTransactionRequestById(id: string) {
  return await prisma.transactionRequest.findUnique({ where: { id } })
}

/**
 * Approve a transaction request and create the actual transaction
 */
export async function approveTransactionRequest(requestId: string) {
  const request = await getTransactionRequestById(requestId)

  if (!request) {
    throw new NotFoundError('TransactionRequest', requestId)
  }

  if (request.status !== RequestStatus.PENDING) {
    throw ValidationError.field('status', `Request is already ${request.status.toLowerCase()}`)
  }

  await prisma.$transaction([
    prisma.transactionRequest.update({
      where: { id: requestId },
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

  return request
}

/**
 * Reject a transaction request
 */
export async function rejectTransactionRequest(requestId: string) {
  const request = await getTransactionRequestById(requestId)

  if (!request) {
    throw new NotFoundError('TransactionRequest', requestId)
  }

  if (request.status !== RequestStatus.PENDING) {
    throw ValidationError.field('status', `Request is already ${request.status.toLowerCase()}`)
  }

  return await prisma.transactionRequest.update({
    where: { id: requestId },
    data: { status: RequestStatus.REJECTED },
  })
}
