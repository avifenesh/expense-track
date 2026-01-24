import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { rateLimitError, validationError, successResponse, serverError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'
import { sendVerificationEmail } from '@/lib/email'
import { registerUser } from '@/lib/services/registration-service'

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be at most 100 characters')
    // Must start and end with alphanumeric, can contain spaces, hyphens, apostrophes in middle
    .regex(/^[a-zA-Z0-9]([a-zA-Z0-9\s\-']*[a-zA-Z0-9])?$/, 'Display name must start and end with a letter or number'),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { email, password, displayName } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    const rateLimit = checkRateLimitTyped(normalizedEmail, 'registration')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimitTyped(normalizedEmail, 'registration')

    // Auto-verify test emails in test environment or E2E testing
    const isE2ETest = process.env.E2E_TEST === 'true'
    const isTestEnv = process.env.NODE_ENV === 'test'
    const isTestEmail = (isTestEnv || isE2ETest) && normalizedEmail.endsWith('@test.local')

    const registerResult = await registerUser({
      email: normalizedEmail,
      password,
      displayName,
      autoVerify: isTestEmail,
    })

    if (!registerResult.success) {
      if (registerResult.reason === 'exists') {
        serverLogger.info('Registration attempt for existing email', { email: normalizedEmail })
        return successResponse(
          { message: 'If this email is not registered, you will receive a verification email shortly.' },
          201,
        )
      }
      return serverError('Registration failed')
    }

    if (!registerResult.emailVerified && registerResult.verificationToken) {
      const emailResult = await sendVerificationEmail(normalizedEmail, registerResult.verificationToken)
      if (!emailResult.success) {
        serverLogger.warn('Verification email failed to send', {
          action: 'POST /api/v1/auth/register',
          email: normalizedEmail,
        })
      }
    }

    if (process.env.NODE_ENV === 'development' && !isTestEmail && registerResult.verificationExpires) {
      // Log for development debugging, but never log the actual token
      serverLogger.info('Email verification required', {
        email: normalizedEmail,
        expires: registerResult.verificationExpires.toISOString(),
      })
    }

    return successResponse(
      {
        message: 'If this email is not registered, you will receive a verification email shortly.',
        emailVerified: registerResult.emailVerified,
      },
      201,
    )
  } catch (error) {
    serverLogger.error('Registration failed', { error })
    return serverError('Registration failed')
  }
}
