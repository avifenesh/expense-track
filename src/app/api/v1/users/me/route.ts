import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import {
  authError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { getSubscriptionState } from '@/lib/subscription'
import { serverLogger } from '@/lib/server-logger'

/**
 * GET /api/v1/users/me
 *
 * Retrieves the current user's profile information including subscription status.
 *
 * @returns {Object} User profile with subscription state
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to fetch user profile
 */
export async function GET(request: NextRequest) {
  // 1. Authenticate with JWT
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 3. Fetch user profile
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        preferredCurrency: true,
        createdAt: true,
        hasCompletedOnboarding: true,
      },
    })

    if (!dbUser) {
      return authError('User not found')
    }

    // 4. Get subscription state
    const subscription = await getSubscriptionState(user.userId)

    return successResponse({
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      preferredCurrency: dbUser.preferredCurrency,
      createdAt: dbUser.createdAt,
      hasCompletedOnboarding: dbUser.hasCompletedOnboarding,
      subscription: {
        status: subscription.status,
        isActive: subscription.isActive,
        canAccessApp: subscription.canAccessApp,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
        daysRemaining: subscription.daysRemaining,
      },
    })
  } catch (error) {
    serverLogger.error('Failed to fetch user profile', { action: 'GET /api/v1/users/me' }, error)
    return serverError('Unable to fetch user profile')
  }
}
