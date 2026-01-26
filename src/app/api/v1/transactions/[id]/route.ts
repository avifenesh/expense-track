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
  checkSubscription,
} from '@/lib/api-helpers'
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { formatDateForApi } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'

/**
 * GET /api/v1/transactions/[id]
 *
 * Retrieves a single transaction by ID.
 *
 * @param id - The transaction ID (path parameter)
 *
 * @returns {Transaction} The transaction with all fields
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {404} Not found - Transaction does not exist
 * @throws {429} Rate limited - Too many requests
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Note: No subscription check for GET - users can always view their data

  // 2. Fetch transaction with ownership check
  try {
    const transaction = await getTransactionById(id, user.userId)
    if (!transaction) {
      return notFoundError('Transaction not found')
    }

    return successResponse({
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      date: formatDateForApi(transaction.date),
      month: formatDateForApi(transaction.month),
      description: transaction.description,
      isRecurring: transaction.isRecurring,
      category: transaction.category,
    })
  } catch (error) {
    serverLogger.error('Failed to fetch transaction', { action: 'GET /api/v1/transactions/[id]' }, error)
    return serverError('Unable to fetch transaction')
  }
}

/**
 * PUT /api/v1/transactions/[id]
 *
 * Updates an existing transaction.
 *
 * @param id - The transaction ID (path parameter)
 * @body accountId - Required. The account the transaction belongs to.
 * @body categoryId - Required. The category for the transaction.
 * @body type - Required. Transaction type (INCOME or EXPENSE).
 * @body amount - Required. Transaction amount (positive number).
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 * @body date - Required. Transaction date (YYYY-MM-DD or ISO format).
 * @body description - Optional. Transaction description.
 * @body isRecurring - Optional. Whether this is a recurring transaction.
 *
 * @returns {Transaction} The updated transaction with all fields
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the transaction or account
 * @throws {404} Not found - Transaction does not exist
 * @throws {429} Rate limited - Too many requests
 */
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

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

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
      return forbiddenError('Access denied')
    }
  }

  // 5. Execute update
  try {
    const updated = await updateTransaction(data)
    return successResponse({
      id: updated.id,
      accountId: updated.accountId,
      categoryId: updated.categoryId,
      type: updated.type,
      amount: updated.amount.toString(),
      currency: updated.currency,
      date: formatDateForApi(updated.date),
      month: formatDateForApi(updated.month),
      description: updated.description,
      isRecurring: updated.isRecurring,
    })
  } catch {
    return serverError('Unable to update transaction')
  }
}

/**
 * DELETE /api/v1/transactions/[id]
 *
 * Deletes an existing transaction.
 *
 * @param id - The transaction ID (path parameter)
 *
 * @returns {Object} { id: string } - The deleted transaction's ID
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {404} Not found - Transaction does not exist
 * @throws {429} Rate limited - Too many requests
 */
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

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 2. Check existing transaction (with userId filter via account)
  const existing = await getTransactionById(id, user.userId)
  if (!existing) {
    return notFoundError('Transaction not found')
  }

  // 3. Execute delete
  try {
    await deleteTransaction(id, user.userId)
    return successResponse({ id })
  } catch {
    return serverError('Unable to delete transaction')
  }
}
