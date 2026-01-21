import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { successResponse, validationError, notFoundError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

const emailQuerySchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email is too long')
    .transform((email) => email.toLowerCase()),
})

export async function GET(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      const searchParams = request.nextUrl.searchParams
      const emailParam = searchParams.get('email')

      const parsed = emailQuerySchema.safeParse({ email: emailParam })
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const { email } = parsed.data

      if (email === user.email.toLowerCase()) {
        return validationError({
          email: ['Cannot look up your own email address'],
        })
      }

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

      return successResponse({
        user: {
          id: foundUser.id,
          email: foundUser.email,
          displayName: foundUser.displayName,
        },
      })
    },
    {
      rateLimitType: 'login',
      requireSubscription: false,
    }
  )
}
