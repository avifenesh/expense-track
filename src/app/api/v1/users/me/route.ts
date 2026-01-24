import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { authError, successResponse, validationError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getSubscriptionState } from '@/lib/subscription'
import { z } from 'zod'

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length >= 1, { message: 'Display name is required' })
    .refine((val) => val.length <= 100, {
      message: 'Display name must be 100 characters or less',
    }),
})

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
    // Parallelize user query and subscription state fetch for better performance
    const [dbUser, subscription] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          preferredCurrency: true,
          createdAt: true,
          hasCompletedOnboarding: true,
        },
      }),
      getSubscriptionState(user.userId),
    ])

    if (!dbUser) {
      return authError('User not found')
    }

    return successResponse({
      ...dbUser,
      subscription,
    })
  })
}

/**
 * PATCH /api/v1/users/me
 *
 * Updates the authenticated user's profile (display name).
 *
 * @body displayName - Required. User's display name (1-100 characters).
 *
 * @returns {Object} Updated user profile fields
 * @throws {400} Validation error - Invalid display name
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 */
export async function PATCH(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    const body = await parseJsonBody(request)
    if (body === null) {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const data = parsed.data

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: { displayName: data.displayName },
      select: {
        id: true,
        email: true,
        displayName: true,
        preferredCurrency: true,
      },
    })

    return successResponse(updatedUser)
  })
}
