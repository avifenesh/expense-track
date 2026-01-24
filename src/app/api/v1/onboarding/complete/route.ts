import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { createTrialSubscription } from '@/lib/subscription'

/**
 * POST /api/v1/onboarding/complete
 *
 * Marks the user's onboarding as complete.
 * For test users (@test.local), also ensures they have:
 * - A default "Personal" account (for backward compatibility with existing test users)
 * - A trial subscription
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

      // Ensure test users have account and subscription for E2E testing
      // This handles backward compatibility for users created before account-creation was added
      if (userRecord?.email.endsWith('@test.local')) {
        // Ensure default account exists
        const existingAccount = await prisma.account.findFirst({
          where: { userId: user.userId, deletedAt: null },
        })
        if (!existingAccount) {
          await prisma.account.create({
            data: {
              userId: user.userId,
              name: 'Personal',
              type: 'SELF',
            },
          })
        }

        // Ensure trial subscription exists
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
