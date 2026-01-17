import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { rejectTransactionRequest, getTransactionRequestById } from '@/lib/services/transaction-service'
import {
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/v1/transactions/requests/[id]/reject
 *
 * Rejects a pending transaction request. Only the recipient can reject.
 *
 * @param id - The transaction request ID (path parameter)
 *
 * @returns {Object} { id: string, status: 'REJECTED' }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User not authorized or request already processed
 * @throws {404} Not found - Transaction request does not exist
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to reject request
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

  // 4. Reject request
  try {
    await rejectTransactionRequest(id)
    return successResponse({ id, status: 'REJECTED' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('already')) {
      return forbiddenError(error.message)
    }
    return serverError('Unable to reject transaction request')
  }
}
