'use server'

import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { clearSession, establishSession, verifyCredentials } from '@/lib/auth-server'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput } from './shared'
import { rotateCsrfToken } from '@/lib/csrf'
import {
  loginSchema,
  recoverySchema,
  resetPasswordSchema,
  registrationSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '@/schemas'
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '@/lib/email'
import { serverLogger } from '@/lib/server-logger'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { createTrialSubscription } from '@/lib/subscription'

const BCRYPT_ROUNDS = 12
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1

export async function loginAction(input: z.infer<typeof loginSchema>) {
  const parsed = parseInput(loginSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed
  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const credentialsResult = await verifyCredentials({ email, password })
  if (!credentialsResult.valid) {
    if (credentialsResult.reason === 'email_not_verified') {
      return failure({
        credentials: ['Please verify your email before signing in. Check your inbox for the verification link.'],
      })
    }
    return failure({ credentials: ['Invalid username or password'] })
  }

  // Get user with their accounts from database
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { accounts: { orderBy: { name: 'asc' } } },
  })

  if (!dbUser || dbUser.accounts.length === 0) {
    return {
      error: {
        general: ['No accounts found. Please contact support.'],
      },
    }
  }

  const defaultAccount = dbUser.accounts[0]

  await establishSession({ userEmail: dbUser.email, accountId: defaultAccount.id })
  await rotateCsrfToken()
  return success({ accountId: defaultAccount.id })
}

export async function logoutAction() {
  await clearSession()
  return successVoid()
}

export async function requestPasswordResetAction(input: z.infer<typeof recoverySchema>) {
  const parsed = parseInput(recoverySchema, input)
  if ('error' in parsed) return parsed

  const normalizedEmail = parsed.data.email.trim().toLowerCase()

  // Rate limit check (3/hour for abuse prevention)
  const rateLimit = checkRateLimitTyped(normalizedEmail, 'password_reset')
  if (!rateLimit.allowed) {
    return failure({ email: ['Too many password reset requests. Please try again later.'] })
  }
  incrementRateLimitTyped(normalizedEmail, 'password_reset')

  // Check if user exists (but always return same message for security)
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, emailVerified: true },
  })

  // Only send email if user exists and email is verified
  if (user && user.emailVerified) {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    // Hash token before storing (security best practice - prevents token theft if DB is compromised)
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const expires = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    try {
      // Store hashed token in database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpires: expires,
        },
      })
    } catch (error) {
      serverLogger.error(
        'Failed to store password reset token',
        { action: 'requestPasswordResetAction', input: { email: normalizedEmail } },
        error,
      )
      // Still return success to prevent enumeration
      return success({
        message: 'If an account exists with this email, you will receive password reset instructions.',
      })
    }

    // Send reset email (separate try-catch for clearer error attribution)
    try {
      await sendPasswordResetEmail(normalizedEmail, token)
    } catch (emailError) {
      serverLogger.error(
        'Failed to send password reset email',
        { action: 'requestPasswordResetAction', input: { email: normalizedEmail } },
        emailError,
      )
      // Do not rethrow - return success to prevent email enumeration
    }
  }

  // Always return same message regardless of whether email exists (enumeration protection)
  return success({
    message: 'If an account exists with this email, you will receive password reset instructions.',
  })
}

export async function resetPasswordAction(input: z.infer<typeof resetPasswordSchema>) {
  const parsed = parseInput(resetPasswordSchema, input)
  if ('error' in parsed) return parsed

  const { token, newPassword } = parsed.data
  // Hash the incoming token to compare with stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  // Find user by hashed token
  const user = await prisma.user.findUnique({
    where: { passwordResetToken: hashedToken },
    select: { id: true, email: true, passwordResetExpires: true },
  })

  // Validate token and expiry
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return failure({ token: ['Invalid or expired reset token. Please request a new password reset.'] })
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

  try {
    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // Send notification email (fire-and-forget pattern).
    // This is intentionally not awaited because:
    // 1. The password reset is already complete - user can log in
    // 2. This is a non-critical notification, not a blocking operation
    // 3. Email delivery failures are logged but don't affect the reset success
    sendPasswordChangedEmail(user.email).catch((error) => {
      serverLogger.error(
        'Failed to send password changed notification',
        { action: 'resetPasswordAction', userId: user.id },
        error,
      )
    })

    serverLogger.info('Password reset completed', {
      action: 'resetPasswordAction',
      userId: user.id,
    })
  } catch (error) {
    serverLogger.error('Failed to reset password', { action: 'resetPasswordAction', userId: user.id }, error)
    return generalError('Unable to reset password. Please try again.')
  }

  return success({
    message: 'Your password has been reset successfully. You can now sign in with your new password.',
  })
}

export async function registerAction(input: z.infer<typeof registrationSchema>) {
  const parsed = parseInput(registrationSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed

  const { email, password, displayName } = parsed.data

  // Rate limit check (3/min for spam prevention)
  const rateLimit = checkRateLimitTyped(email, 'registration')
  if (!rateLimit.allowed) {
    return failure({ email: ['Too many registration attempts. Please try again later.'] })
  }
  incrementRateLimitTyped(email, 'registration')

  // Check if email already exists - return same message to prevent email enumeration
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    // Return generic success message to prevent attackers from discovering registered emails
    return success({
      message: 'If this email is not already registered, you will receive a verification email shortly.',
    })
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  // Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex')
  const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  // Create user with a default "Personal" account and trial subscription
  try {
    const newUser = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        accounts: {
          create: {
            name: 'Personal',
            type: 'SELF',
          },
        },
      },
    })

    // Create 14-day trial subscription for new user
    await createTrialSubscription(newUser.id)
  } catch (error) {
    serverLogger.error('Failed to create user account', { action: 'registerAction', input: { email } }, error)
    return generalError('Unable to create account. Please try again.')
  }

  // Send verification email
  const emailResult = await sendVerificationEmail(email, verificationToken)
  if (!emailResult.success) {
    // User created but email failed - they can request resend later
    return success({
      message: 'Account created. Verification email could not be sent. Please contact support.',
    })
  }

  return success({
    message: 'If this email is not already registered, you will receive a verification email shortly.',
  })
}

export async function verifyEmailAction(input: z.infer<typeof verifyEmailSchema>) {
  const parsed = parseInput(verifyEmailSchema, input)
  if ('error' in parsed) return parsed

  const { token } = parsed.data

  // Find user by unique token
  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  })

  if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
    return failure({ token: ['Invalid or expired verification token'] })
  }

  // Update user as verified
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    })
  } catch (error) {
    serverLogger.error(
      'Failed to update email verification status',
      { action: 'verifyEmailAction', userId: user.id },
      error,
    )
    return generalError('Unable to verify email. Please try again.')
  }

  return success({
    message: 'Email verified successfully! You can now log in.',
  })
}

export async function resendVerificationEmailAction(input: z.infer<typeof resendVerificationSchema>) {
  const parsed = parseInput(resendVerificationSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed

  const { email } = parsed.data

  // Rate limit check (3/15min for spam prevention)
  const rateLimit = checkRateLimitTyped(email, 'resend_verification')
  if (!rateLimit.allowed) {
    return failure({ email: ['Too many requests. Please try again in 15 minutes.'] })
  }
  incrementRateLimitTyped(email, 'resend_verification')

  // Find user - return generic message regardless of result to prevent enumeration
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true, emailVerificationToken: true },
  })

  // If user doesn't exist or already verified, return generic success
  if (!user || user.emailVerified) {
    return success({
      message: 'If an unverified account exists with this email, a verification link will be sent.',
    })
  }

  // Generate new token
  const verificationToken = crypto.randomBytes(32).toString('hex')
  const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    })
  } catch (error) {
    serverLogger.error(
      'Failed to update verification token',
      { action: 'resendVerificationEmailAction', userId: user.id },
      error,
    )
    return generalError('Unable to send verification email. Please try again.')
  }

  // Send verification email
  const emailResult = await sendVerificationEmail(email, verificationToken)
  if (!emailResult.success) {
    serverLogger.error('Failed to send verification email', {
      action: 'resendVerificationEmailAction',
      input: { email },
    })
    return generalError('Unable to send verification email. Please try again.')
  }

  return success({
    message: 'If an unverified account exists with this email, a verification link will be sent.',
  })
}

// Re-export account actions for backward compatibility
export { persistActiveAccountAction, deleteAccountAction, exportUserDataAction } from './account'
