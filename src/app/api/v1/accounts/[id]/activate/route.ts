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
  } catch {
    return serverError('Unable to activate account')
  }
}
