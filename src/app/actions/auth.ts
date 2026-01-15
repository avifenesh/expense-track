'use server'

import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import { clearSession, establishSession, updateSessionAccount, verifyCredentials } from '@/lib/auth-server'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, ensureAccountAccess, requireCsrfToken } from './shared'
import { rotateCsrfToken } from '@/lib/csrf'
import { loginSchema, recoverySchema, accountSelectionSchema, registrationSchema, verifyEmailSchema } from '@/schemas'
import { sendVerificationEmail } from '@/lib/email'

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
    return failure({ credentials: ['Invalid username or password'] })
  }

  // Handle legacy users (from AUTH_USERS env vars)
  if (credentialsResult.source === 'legacy') {
    const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)
    if (!authUser) {
      return failure({ credentials: ['Invalid username or password'] })
    }

    const accounts = await prisma.account.findMany({
      where: { name: { in: authUser.accountNames } },
      orderBy: { name: 'asc' },
    })

    if (accounts.length === 0) {
      return {
        error: {
          general: ['No accounts are provisioned for this user. Please contact support.'],
        },
      }
    }

    const defaultAccount = accounts.find((account) => account.name === authUser.defaultAccountName) ?? accounts[0]

    await establishSession({ userEmail: authUser.email, accountId: defaultAccount.id })
    await rotateCsrfToken()
    return success({ accountId: defaultAccount.id })
  }

  // Handle database users
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

  const recoveryContact = RECOVERY_CONTACTS.find(
    (contact) => contact.email.toLowerCase() === parsed.data.email.trim().toLowerCase(),
  )

  if (!recoveryContact) {
    return {
      error: {
        email: ['Email is not registered. Reach out to the finance team to restore access.'],
      },
    }
  }

  return {
    success: true,
    message: `A reset link was sent to ${recoveryContact.email}. Use the standard password after completing the guided reset.`,
  }
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

export async function registerAction(input: z.infer<typeof registrationSchema>) {
  const parsed = parseInput(registrationSchema, {
    ...input,
    email: input.email.trim().toLowerCase(),
  })
  if ('error' in parsed) return parsed

  const { email, password, displayName } = parsed.data

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return failure({ email: ['This email is already registered'] })
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
  } catch {
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
    message: 'Account created! Please check your email to verify your account.',
  })
}

export async function verifyEmailAction(input: z.infer<typeof verifyEmailSchema>) {
  const parsed = parseInput(verifyEmailSchema, input)
  if ('error' in parsed) return parsed

  const { token } = parsed.data

  // Find user by token
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: {
        gt: new Date(),
      },
    },
  })

  if (!user) {
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
  } catch {
    return generalError('Unable to verify email. Please try again.')
  }

  return success({
    message: 'Email verified successfully! You can now log in.',
  })
}
