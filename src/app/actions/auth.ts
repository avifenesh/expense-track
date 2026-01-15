'use server'

import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { clearSession, establishSession, updateSessionAccount, verifyCredentials } from '@/lib/auth-server'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, ensureAccountAccess, requireCsrfToken } from './shared'
import { rotateCsrfToken } from '@/lib/csrf'
import {
  loginSchema,
  recoverySchema,
  accountSelectionSchema,
  registrationSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '@/schemas'
import { sendVerificationEmail } from '@/lib/email'
import { serverLogger } from '@/lib/server-logger'

const BCRYPT_ROUNDS = 12
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24

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

  // Check if user exists in database
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  })

  if (!user) {
    // Return generic message to prevent email enumeration
    return success({
      message: 'If this email is registered, you will receive a password reset link shortly.',
    })
  }

  // TODO: Implement actual password reset email sending in #33
  // For now, return a success message indicating the feature is coming
  return success({
    message: 'If this email is registered, you will receive a password reset link shortly.',
  })
}

export async function persistActiveAccountAction(input: z.infer<typeof accountSelectionSchema>) {
  const parsed = parseInput(accountSelectionSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const access = await ensureAccountAccess(parsed.data.accountId)
  if ('error' in access) {
    return access
  }

  const updateResult = await updateSessionAccount(access.account.id)
  if ('error' in updateResult) {
    return updateResult
  }

  return successVoid()
}

// Simple in-memory rate limiting for registration (by IP would be better but requires headers)
const registrationRateLimits = new Map<string, { count: number; resetAt: number }>()
const REGISTRATION_RATE_LIMIT = 5 // max registrations per email pattern
const REGISTRATION_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRegistrationRateLimit(email: string): boolean {
  const now = Date.now()
  // Use domain as key to prevent spam attacks targeting one domain
  const domain = email.split('@')[1] || email
  const limit = registrationRateLimits.get(domain)

  if (!limit || now > limit.resetAt) {
    registrationRateLimits.set(domain, { count: 1, resetAt: now + REGISTRATION_RATE_WINDOW_MS })
    return true
  }

  if (limit.count >= REGISTRATION_RATE_LIMIT) {
    return false
  }

  limit.count++
  return true
}

export async function registerAction(input: z.infer<typeof registrationSchema>) {
  const parsed = parseInput(registrationSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed

  const { email, password, displayName } = parsed.data

  // Rate limit check
  if (!checkRegistrationRateLimit(email)) {
    return failure({ email: ['Too many registration attempts. Please try again later.'] })
  }

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

  // Create user with a default "Personal" account
  try {
    await prisma.user.create({
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

// Simple in-memory rate limiting for resend verification
const resendRateLimits = new Map<string, { count: number; resetAt: number }>()
const RESEND_RATE_LIMIT = 3 // max requests
const RESEND_RATE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkResendRateLimit(email: string): boolean {
  const now = Date.now()
  const key = email.toLowerCase()
  const limit = resendRateLimits.get(key)

  if (!limit || now > limit.resetAt) {
    resendRateLimits.set(key, { count: 1, resetAt: now + RESEND_RATE_WINDOW_MS })
    return true
  }

  if (limit.count >= RESEND_RATE_LIMIT) {
    return false
  }

  limit.count++
  return true
}

export async function resendVerificationEmailAction(input: z.infer<typeof resendVerificationSchema>) {
  const parsed = parseInput(resendVerificationSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed

  const { email } = parsed.data

  // Rate limit check
  if (!checkResendRateLimit(email)) {
    return failure({ email: ['Too many requests. Please try again in 15 minutes.'] })
  }

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
