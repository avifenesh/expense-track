import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { updateTransaction, deleteTransaction, getTransactionById } from '@/lib/services/transaction-service'
import { transactionUpdateSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

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

  // 3. Check existing transaction (with userId filter via account)
  const existing = await getTransactionById(id, user.userId)
  if (!existing) {
    return notFoundError('Transaction not found')
  }

  // 4. If changing account, authorize new account
  if (existing.accountId !== data.accountId) {
    const newAccountOwnership = await ensureApiAccountOwnership(data.accountId, user.userId)
    if (!newAccountOwnership.allowed) {
      return forbiddenError('You do not have access to the new account')
    }
  }

  // 5. Execute update
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

  // 1.5 Rate limit check
  const rateLimitCheck = checkRateLimit(user.userId)
  if (!rateLimitCheck.allowed) {
    return rateLimitError(rateLimitCheck.resetAt)
  }
  incrementRateLimit(user.userId)

  // 2. Check existing transaction (with userId filter via account)
  const existing = await getTransactionById(id, user.userId)
  if (!existing) {
    return notFoundError('Transaction not found')
  }

  // 3. Execute delete
  try {
    await deleteTransaction(id)
    return successResponse({ id })
  } catch {
    return serverError('Unable to delete transaction')
  }
}
