import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  authError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // Security: Verify account ownership by including userId in WHERE clause
  // This prevents users from activating accounts they don't own
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.userId,
      deletedAt: null,
    },
  })

  if (!account) {
    return notFoundError('Account not found')
  }

  try {
    await prisma.user.update({
      where: { id: user.userId },
      data: { activeAccountId: accountId },
    })

    return successResponse({ activeAccountId: accountId })
  } catch (error) {
    serverLogger.error('Failed to update activeAccountId', {
      action: 'PATCH /api/v1/accounts/[id]/activate',
      userId: user.userId,
      accountId,
    }, error)
    return serverError('Unable to activate account')
  }
}
