import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/onboarding/complete
 *
 * Marks the user's onboarding as complete.
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
      await prisma.user.update({
        where: { id: user.userId },
        data: { hasCompletedOnboarding: true },
      })

      return successResponse({ hasCompletedOnboarding: true })
    },
    { requireSubscription: true },
  )
}
