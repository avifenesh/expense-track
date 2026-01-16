import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { rateLimitError, validationError, successResponse, serverError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = resendVerificationSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { email } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit: 3 per 15 minutes per email
    const rateLimit = checkRateLimitTyped(normalizedEmail, 'resend_verification')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimitTyped(normalizedEmail, 'resend_verification')

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // Always return success to prevent email enumeration
    // The actual verification email sending happens only if conditions are met
    if (!user) {
      serverLogger.info('Resend verification requested for non-existent email', { email: normalizedEmail })
      return successResponse({ message: 'If an account exists with this email and is not verified, a new verification email will be sent.' })
    }

    if (user.emailVerified) {
      serverLogger.info('Resend verification requested for already verified email', { email: normalizedEmail })
      return successResponse({ message: 'If an account exists with this email and is not verified, a new verification email will be sent.' })
    }

    // Generate new verification token
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    })

    // Log verification email (actual email sending is a separate task)
    serverLogger.info('Verification email resent', {
      email: normalizedEmail,
      token: verificationToken,
      expires: verificationExpires.toISOString(),
    })

    return successResponse({ message: 'If an account exists with this email and is not verified, a new verification email will be sent.' })
  } catch (error) {
    serverLogger.error('Resend verification failed', { error })
    return serverError('Failed to process request')
  }
}
