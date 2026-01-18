import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { approveTransactionRequest, getTransactionRequestById } from '@/lib/services/transaction-service'
import {
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
  validationError,
  checkSubscription,
} from '@/lib/api-helpers'
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { NotFoundError, ValidationError, isServiceError } from '@/lib/services/errors'

/**
 * POST /api/v1/transactions/requests/[id]/approve
 *
 * Approves a pending transaction request. Only the recipient can approve.
 *
 * @param id - The transaction request ID (path parameter)
 *
 * @returns {Object} { id: string, status: 'APPROVED' }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User not authorized or request already processed
 * @throws {404} Not found - Transaction request does not exist
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to approve request
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // 2. Check request exists
  const transactionRequest = await getTransactionRequestById(id)
  if (!transactionRequest) {
    return notFoundError('Transaction request not found')
  }

  // 3. Authorize access to 'to' account by userId
  const accountOwnership = await ensureApiAccountOwnership(transactionRequest.toId, user.userId)
  if (!accountOwnership.allowed) {
    return forbiddenError('Access denied')
  }

  // 4. Approve request
  try {
    await approveTransactionRequest(id)
    return successResponse({ id, status: 'APPROVED' })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return notFoundError(error.message)
    }
    if (error instanceof ValidationError) {
      return validationError(error.fieldErrors)
    }
    if (isServiceError(error)) {
      return serverError(error.message)
    }
    return serverError('Unable to approve transaction request')
  }
}
