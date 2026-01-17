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
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { NotFoundError, ValidationError, isServiceError } from '@/lib/services/errors'

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
  const toAccount = await prisma.account.findUnique({
    where: { id: transactionRequest.toId },
  })
  if (!toAccount || toAccount.userId !== user.userId) {
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
