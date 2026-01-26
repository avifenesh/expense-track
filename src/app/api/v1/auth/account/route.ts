import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  validationError,
  authError,
  successResponse,
  serverError,
  rateLimitError,
} from '@/lib/api-helpers'
import {
  checkRateLimitTyped,
  incrementRateLimitTyped,
} from '@/lib/rate-limit'
import { cancelPaddleSubscription } from '@/lib/paddle'
import { serverLogger } from '@/lib/server-logger'
import { deleteAccountApiSchema } from '@/schemas/api'

/**
 * DELETE /api/v1/auth/account
 *
 * GDPR-compliant account deletion endpoint.
 * Soft-deletes the user account and anonymizes personal data.
 *
 * Rate limit: 3 requests per hour (account_deletion)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate via JWT
    let auth
    try {
      auth = requireJwtAuth(request)
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Token expired') {
          return authError('Token expired')
        }
        if (error.message === 'Missing authorization token') {
          return authError('Missing authorization token')
        }
      }
      return authError('Invalid token')
    }

    // Rate limit check (3/hour for account deletion)
    const rateLimit = checkRateLimitTyped(auth.userId, 'account_deletion')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimitTyped(auth.userId, 'account_deletion')

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = deleteAccountApiSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { confirmEmail } = parsed.data

    // Fetch user to verify they exist and aren't already deleted
    const user = await prisma.user.findUnique({
      where: { id: auth.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        subscription: {
          select: {
            paddleSubscriptionId: true,
          },
        },
      },
    })

    if (!user) {
      return authError('User not found')
    }

    // Verify email confirmation matches (case-insensitive)
    if (user.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      return validationError({
        confirmEmail: ['Email confirmation does not match your account email'],
      })
    }

    // Generate anonymized values
    const anonymizedEmail = `deleted-${crypto.randomUUID()}@deleted.local`
    const anonymizedName = 'Deleted User'
    const deletedAt = new Date()

    // Perform account deletion in a transaction
    await prisma.$transaction(async (tx) => {
      // Soft-delete user and anonymize personal data
      await tx.user.update({
        where: { id: user.id },
        data: {
          deletedAt,
          deletedBy: user.id, // Self-deletion
          email: anonymizedEmail,
          displayName: anonymizedName,
          passwordHash: '', // Clear password hash
          emailVerified: false,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      })

      // Delete all refresh tokens for this user
      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      })
    })

    // Cancel Paddle subscription if exists (outside transaction, non-blocking)
    if (user.subscription?.paddleSubscriptionId) {
      try {
        await cancelPaddleSubscription(user.subscription.paddleSubscriptionId)
        serverLogger.info('Paddle subscription canceled for deleted account', {
          userId: user.id,
          subscriptionId: user.subscription.paddleSubscriptionId,
        })
      } catch (paddleError) {
        // Log but don't fail - account is already deleted
        serverLogger.error('Failed to cancel Paddle subscription during account deletion', {
          userId: user.id,
          subscriptionId: user.subscription.paddleSubscriptionId,
          error: paddleError instanceof Error ? paddleError.message : String(paddleError),
        })
      }
    }

    serverLogger.info('User account deleted (GDPR)', {
      userId: user.id,
      originalEmail: user.email,
    })

    return successResponse({
      message: 'Account deleted successfully',
    })
  } catch (error) {
    serverLogger.error('Account deletion failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return serverError('Account deletion failed')
  }
}
