import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createTrialSubscription } from '@/lib/subscription'

/**
 * POST /api/v1/onboarding/complete
 *
 * Marks the user's onboarding as complete.
 * For test users (@test.local), also ensures they have a trial subscription.
 *
 * @returns {Object} { hasCompletedOnboarding: true }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // Get user email to check if test user
      const userRecord = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { email: true },
      })

      // Ensure test users have a trial subscription for E2E testing
      if (userRecord?.email.endsWith('@test.local')) {
        const existingSubscription = await prisma.subscription.findUnique({
          where: { userId: user.userId },
        })
        if (!existingSubscription) {
          await createTrialSubscription(user.userId)
        }
      }

      await prisma.user.update({
        where: { id: user.userId },
        data: { hasCompletedOnboarding: true },
      })

      return successResponse({ hasCompletedOnboarding: true })
    },
    // Note: No subscription required - this is used during onboarding before user subscribes
  )
}
