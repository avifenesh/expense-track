import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { updateTransaction, deleteTransaction, getTransactionById } from '@/lib/services/transaction-service'
import { transactionUpdateSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const apiSchema = transactionUpdateSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check existing transaction
  const existing = await getTransactionById(id)
  if (!existing) {
    return notFoundError('Transaction not found')
  }

  // 4. Authorize access to existing account
  const existingAccount = await prisma.account.findUnique({
    where: { id: existing.accountId },
  })
  const authUser = getUserAuthInfo(user.userId)

  if (!existingAccount || !authUser.accountNames.includes(existingAccount.name)) {
    return forbiddenError('You do not have access to this transaction')
  }

  // 5. If changing account, authorize new account
  if (existing.accountId !== data.accountId) {
    const newAccount = await prisma.account.findUnique({
      where: { id: data.accountId },
    })
    if (!newAccount || !authUser.accountNames.includes(newAccount.name)) {
      return forbiddenError('You do not have access to the new account')
    }
  }

  // 6. Execute update
  try {
    await updateTransaction(data)
    return successResponse({ id })
  } catch {
    return serverError('Unable to update transaction')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Check existing transaction
  const existing = await getTransactionById(id)
  if (!existing) {
    return notFoundError('Transaction not found')
  }

  // 3. Authorize access
  const account = await prisma.account.findUnique({
    where: { id: existing.accountId },
  })
  const authUser = getUserAuthInfo(user.userId)

  if (!account || !authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this transaction')
  }

  // 4. Execute delete
  try {
    await deleteTransaction(id)
    return successResponse({ id })
  } catch {
    return serverError('Unable to delete transaction')
  }
}
