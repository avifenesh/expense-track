import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { successResponse, validationError, notFoundError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

/**
 * Schema for email query parameter validation.
 * Validates email format and normalizes to lowercase.
 */
const emailQuerySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email is too long')
    .transform((email) => email.toLowerCase()),
})

/**
 * GET /api/v1/users/lookup
 *
 * Look up a user by email address.
 * Used by mobile app to find users when sharing expenses.
 *
 * Query Parameters:
 *   - email: string (required) - Email address to look up
 *
 * Response:
 *   - 200: { user: { id, email, displayName } }
 *   - 400: Validation error (invalid email format)
 *   - 404: User not found
 *   - 429: Rate limit exceeded (prevents email enumeration)
 *
 * Security:
 *   - Requires JWT authentication
 *   - Rate limited (sensitive) to prevent email enumeration attacks
 *   - Users cannot look up their own email
 */
export async function GET(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // 1. Extract and validate email query parameter
      const searchParams = request.nextUrl.searchParams
      const emailParam = searchParams.get('email')

      const parsed = emailQuerySchema.safeParse({ email: emailParam })
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const { email } = parsed.data

      // 2. Prevent looking up own email
      if (email === user.email.toLowerCase()) {
        return validationError({
          email: ['Cannot look up your own email address'],
        })
      }

      // 3. Look up user in database
      const foundUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      })

      if (!foundUser) {
        serverLogger.info('User lookup - not found', {
          action: 'GET /api/v1/users/lookup',
          requestingUserId: user.userId,
          lookupEmail: email,
        })
        return notFoundError('User not found')
      }

      serverLogger.info('User lookup - found', {
        action: 'GET /api/v1/users/lookup',
        requestingUserId: user.userId,
        foundUserId: foundUser.id,
      })

      // 4. Return user data
      return successResponse({
        user: {
          id: foundUser.id,
          email: foundUser.email,
          displayName: foundUser.displayName,
        },
      })
    },
    {
      // Use login rate limiting (5/min) to prevent email enumeration attacks
      rateLimitType: 'login',
      // Read-only endpoint, no subscription required
      requireSubscription: false,
    }
  )
}
