import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { successResponse } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/v1/onboarding/skip
 * Marks user's onboarding as complete.
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
    { requireSubscription: false }, // Used during onboarding before subscription
  )
}
