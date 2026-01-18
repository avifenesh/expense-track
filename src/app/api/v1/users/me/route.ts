import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { authError, successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getSubscriptionState } from '@/lib/subscription'

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
  return withApiAuth(request, async (user) => {
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
  })
}
