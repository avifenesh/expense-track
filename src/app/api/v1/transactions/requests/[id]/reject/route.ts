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
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

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
