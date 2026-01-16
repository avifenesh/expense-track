'use server'

import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { clearSession, establishSession, updateSessionAccount, verifyCredentials } from '@/lib/auth-server'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, ensureAccountAccess, requireCsrfToken, requireAuthUser } from './shared'
import { rotateCsrfToken } from '@/lib/csrf'
import {
  loginSchema,
  recoverySchema,
  accountSelectionSchema,
  registrationSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  deleteAccountSchema,
  exportUserDataSchema,
} from '@/schemas'
import { sendVerificationEmail } from '@/lib/email'
import { serverLogger } from '@/lib/server-logger'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { createTrialSubscription } from '@/lib/subscription'

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

  // Rate limit check (3/hour for abuse prevention)
  const rateLimit = checkRateLimitTyped(normalizedEmail, 'password_reset')
  if (!rateLimit.allowed) {
    return failure({ email: ['Too many password reset requests. Please try again later.'] })
  }
  incrementRateLimitTyped(normalizedEmail, 'password_reset')

  // For now, log the request and return an honest message about the feature status.
  // The DB query will be added when we actually send reset emails.
  serverLogger.warn('Password reset requested, but reset flow is not yet implemented (see issue #33).', {
    action: 'requestPasswordResetAction',
    input: { email: normalizedEmail },
  })

  return success({
    message:
      'Password reset via email is not yet available. Please contact support if you need assistance accessing your account.',
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

/** Delete user account and all associated data (GDPR compliance). */
export async function deleteAccountAction(input: z.infer<typeof deleteAccountSchema>) {
  const parsed = parseInput(deleteAccountSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Rate limit check (3/hour for abuse prevention)
  const rateLimit = checkRateLimitTyped(authUser.id, 'account_deletion')
  if (!rateLimit.allowed) {
    return failure({ general: ['Too many deletion attempts. Please try again later.'] })
  }
  incrementRateLimitTyped(authUser.id, 'account_deletion')

  // Verify email confirmation matches authenticated user
  if (parsed.data.confirmEmail.toLowerCase() !== authUser.email.toLowerCase()) {
    return {
      error: {
        confirmEmail: ['Email does not match your account'],
      },
    }
  }

  try {
    // Get all user's account IDs and category IDs for cascade deletion
    const userAccounts = await prisma.account.findMany({
      where: { userId: authUser.id },
      select: { id: true },
    })
    const accountIds = userAccounts.map((a) => a.id)

    const userCategories = await prisma.category.findMany({
      where: { userId: authUser.id },
      select: { id: true },
    })
    const categoryIds = userCategories.map((c) => c.id)

    // Build deletion operations, skipping empty array conditions to avoid SQL issues
    const deleteOps = []

    // 1. TransactionRequest - depends on Account, Category
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions = []
      if (accountIds.length > 0) {
        orConditions.push({ fromId: { in: accountIds } }, { toId: { in: accountIds } })
      }
      if (categoryIds.length > 0) {
        orConditions.push({ categoryId: { in: categoryIds } })
      }
      deleteOps.push(prisma.transactionRequest.deleteMany({ where: { OR: orConditions } }))
    }

    // 2. Transaction - depends on Account, Category (includes cross-account refs)
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions = []
      if (accountIds.length > 0) orConditions.push({ accountId: { in: accountIds } })
      if (categoryIds.length > 0) orConditions.push({ categoryId: { in: categoryIds } })
      deleteOps.push(prisma.transaction.deleteMany({ where: { OR: orConditions } }))
    }

    // 3. Holding - depends on Account, Category
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions = []
      if (accountIds.length > 0) orConditions.push({ accountId: { in: accountIds } })
      if (categoryIds.length > 0) orConditions.push({ categoryId: { in: categoryIds } })
      deleteOps.push(prisma.holding.deleteMany({ where: { OR: orConditions } }))
    }

    // 4. Budget - depends on Account, Category
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions = []
      if (accountIds.length > 0) orConditions.push({ accountId: { in: accountIds } })
      if (categoryIds.length > 0) orConditions.push({ categoryId: { in: categoryIds } })
      deleteOps.push(prisma.budget.deleteMany({ where: { OR: orConditions } }))
    }

    // 5. RecurringTemplate - depends on Account, Category
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions = []
      if (accountIds.length > 0) orConditions.push({ accountId: { in: accountIds } })
      if (categoryIds.length > 0) orConditions.push({ categoryId: { in: categoryIds } })
      deleteOps.push(prisma.recurringTemplate.deleteMany({ where: { OR: orConditions } }))
    }

    // 6. DashboardCache - cleanup cached data for user's accounts
    if (accountIds.length > 0) {
      deleteOps.push(prisma.dashboardCache.deleteMany({ where: { accountId: { in: accountIds } } }))
    }

    // 7. User deletion - cascades: Account, Category, RefreshToken, Subscription
    deleteOps.push(prisma.user.delete({ where: { id: authUser.id } }))

    await prisma.$transaction(deleteOps)

    serverLogger.info('User account deleted (GDPR)', {
      action: 'deleteAccountAction',
      userId: authUser.id,
    })
  } catch (error) {
    serverLogger.error('Failed to delete user account', { action: 'deleteAccountAction', userId: authUser.id }, error)
    return generalError('Unable to delete account. Please try again or contact support.')
  }

  // Clear session after deletion
  await clearSession()

  return successVoid()
}

/** Export user data type for JSON format */
interface UserDataExport {
  exportedAt: string
  user: {
    id: string
    email: string
    displayName: string | null
    preferredCurrency: string
    emailVerified: boolean
    hasCompletedOnboarding: boolean
    createdAt: string
  }
  subscription: {
    id: string
    status: string
    trialEndsAt: string | null
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    createdAt: string
  } | null
  accounts: Array<{
    id: string
    name: string
    type: string
    preferredCurrency: string | null
    color: string | null
    icon: string | null
    description: string | null
    createdAt: string
  }>
  categories: Array<{
    id: string
    name: string
    type: string
    color: string | null
    isHolding: boolean
    isArchived: boolean
    createdAt: string
  }>
  transactions: Array<{
    id: string
    accountId: string
    categoryId: string
    type: string
    amount: number
    currency: string
    date: string
    month: string
    description: string | null
    isRecurring: boolean
    isMutual: boolean
    createdAt: string
  }>
  budgets: Array<{
    id: string
    accountId: string
    categoryId: string
    month: string
    planned: number
    currency: string
    notes: string | null
    createdAt: string
  }>
  holdings: Array<{
    id: string
    accountId: string
    categoryId: string
    symbol: string
    quantity: number
    averageCost: number
    currency: string
    notes: string | null
    createdAt: string
  }>
  recurringTemplates: Array<{
    id: string
    accountId: string
    categoryId: string
    type: string
    amount: number
    currency: string
    dayOfMonth: number
    description: string | null
    isActive: boolean
    startMonth: string
    endMonth: string | null
    createdAt: string
  }>
}

/** Export all user data (GDPR Article 20 - Right to data portability). */
export async function exportUserDataAction(input: z.infer<typeof exportUserDataSchema>) {
  const parsed = parseInput(exportUserDataSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Rate limit check (3/hour)
  const rateLimit = checkRateLimitTyped(authUser.id, 'data_export')
  if (!rateLimit.allowed) {
    return failure({ general: ['Too many export requests. Please try again later.'] })
  }
  incrementRateLimitTyped(authUser.id, 'data_export')

  const { format } = parsed.data

  try {
    // Fetch user data (excluding sensitive fields like passwordHash)
    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        preferredCurrency: true,
        emailVerified: true,
        hasCompletedOnboarding: true,
        createdAt: true,
      },
    })

    if (!user) {
      return generalError('User not found')
    }

    // Fetch subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: authUser.id },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        createdAt: true,
      },
    })

    // Fetch accounts
    const accounts = await prisma.account.findMany({
      where: { userId: authUser.id },
      select: {
        id: true,
        name: true,
        type: true,
        preferredCurrency: true,
        color: true,
        icon: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    const accountIds = accounts.map((a) => a.id)

    // Fetch categories
    const categories = await prisma.category.findMany({
      where: { userId: authUser.id },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        isHolding: true,
        isArchived: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch transactions (only for user's accounts)
    const transactions =
      accountIds.length > 0
        ? await prisma.transaction.findMany({
            where: { accountId: { in: accountIds } },
            select: {
              id: true,
              accountId: true,
              categoryId: true,
              type: true,
              amount: true,
              currency: true,
              date: true,
              month: true,
              description: true,
              isRecurring: true,
              isMutual: true,
              createdAt: true,
            },
            orderBy: { date: 'desc' },
          })
        : []

    // Fetch budgets
    const budgets =
      accountIds.length > 0
        ? await prisma.budget.findMany({
            where: { accountId: { in: accountIds } },
            select: {
              id: true,
              accountId: true,
              categoryId: true,
              month: true,
              planned: true,
              currency: true,
              notes: true,
              createdAt: true,
            },
            orderBy: { month: 'desc' },
          })
        : []

    // Fetch holdings
    const holdings =
      accountIds.length > 0
        ? await prisma.holding.findMany({
            where: { accountId: { in: accountIds } },
            select: {
              id: true,
              accountId: true,
              categoryId: true,
              symbol: true,
              quantity: true,
              averageCost: true,
              currency: true,
              notes: true,
              createdAt: true,
            },
            orderBy: { symbol: 'asc' },
          })
        : []

    // Fetch recurring templates
    const recurringTemplates =
      accountIds.length > 0
        ? await prisma.recurringTemplate.findMany({
            where: { accountId: { in: accountIds } },
            select: {
              id: true,
              accountId: true,
              categoryId: true,
              type: true,
              amount: true,
              currency: true,
              dayOfMonth: true,
              description: true,
              isActive: true,
              startMonth: true,
              endMonth: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : []

    serverLogger.info('User data exported (GDPR)', {
      action: 'exportUserDataAction',
      userId: authUser.id,
      format,
      counts: {
        accounts: accounts.length,
        categories: categories.length,
        transactions: transactions.length,
        budgets: budgets.length,
        holdings: holdings.length,
        recurringTemplates: recurringTemplates.length,
      },
    })

    // Build export data with proper serialization
    const exportData: UserDataExport = {
      exportedAt: new Date().toISOString(),
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
      subscription: subscription
        ? {
            ...subscription,
            trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
            currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            createdAt: subscription.createdAt.toISOString(),
          }
        : null,
      accounts: accounts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
      categories: categories.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      transactions: transactions.map((t) => ({
        ...t,
        amount: t.amount.toNumber(),
        date: t.date.toISOString(),
        month: t.month.toISOString(),
        createdAt: t.createdAt.toISOString(),
      })),
      budgets: budgets.map((b) => ({
        ...b,
        planned: b.planned.toNumber(),
        month: b.month.toISOString(),
        createdAt: b.createdAt.toISOString(),
      })),
      holdings: holdings.map((h) => ({
        ...h,
        quantity: h.quantity.toNumber(),
        averageCost: h.averageCost.toNumber(),
        createdAt: h.createdAt.toISOString(),
      })),
      recurringTemplates: recurringTemplates.map((r) => ({
        ...r,
        amount: r.amount.toNumber(),
        startMonth: r.startMonth.toISOString(),
        endMonth: r.endMonth?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    }

    if (format === 'json') {
      return success({ data: exportData, format: 'json' as const })
    }

    // CSV format - create multiple sections
    const csvSections: string[] = []

    // User section
    csvSections.push('=== USER ===')
    csvSections.push('id,email,displayName,preferredCurrency,emailVerified,hasCompletedOnboarding,createdAt')
    csvSections.push(
      [
        exportData.user.id,
        `"${exportData.user.email}"`,
        `"${exportData.user.displayName ?? ''}"`,
        exportData.user.preferredCurrency,
        exportData.user.emailVerified,
        exportData.user.hasCompletedOnboarding,
        exportData.user.createdAt,
      ].join(','),
    )

    // Subscription section
    if (exportData.subscription) {
      csvSections.push('')
      csvSections.push('=== SUBSCRIPTION ===')
      csvSections.push('id,status,trialEndsAt,currentPeriodStart,currentPeriodEnd,createdAt')
      csvSections.push(
        [
          exportData.subscription.id,
          exportData.subscription.status,
          exportData.subscription.trialEndsAt ?? '',
          exportData.subscription.currentPeriodStart ?? '',
          exportData.subscription.currentPeriodEnd ?? '',
          exportData.subscription.createdAt,
        ].join(','),
      )
    }

    // Accounts section
    csvSections.push('')
    csvSections.push('=== ACCOUNTS ===')
    csvSections.push('id,name,type,preferredCurrency,color,icon,description,createdAt')
    exportData.accounts.forEach((a) => {
      csvSections.push(
        [
          a.id,
          `"${a.name}"`,
          a.type,
          a.preferredCurrency,
          a.color ?? '',
          a.icon ?? '',
          `"${(a.description ?? '').replace(/"/g, '""')}"`,
          a.createdAt,
        ].join(','),
      )
    })

    // Categories section
    csvSections.push('')
    csvSections.push('=== CATEGORIES ===')
    csvSections.push('id,name,type,color,isHolding,isArchived,createdAt')
    exportData.categories.forEach((c) => {
      csvSections.push([c.id, `"${c.name}"`, c.type, c.color ?? '', c.isHolding, c.isArchived, c.createdAt].join(','))
    })

    // Transactions section
    csvSections.push('')
    csvSections.push('=== TRANSACTIONS ===')
    csvSections.push('id,accountId,categoryId,type,amount,currency,date,month,description,isRecurring,isMutual,createdAt')
    exportData.transactions.forEach((t) => {
      csvSections.push(
        [
          t.id,
          t.accountId,
          t.categoryId,
          t.type,
          t.amount,
          t.currency,
          t.date,
          t.month,
          `"${(t.description ?? '').replace(/"/g, '""')}"`,
          t.isRecurring,
          t.isMutual,
          t.createdAt,
        ].join(','),
      )
    })

    // Budgets section
    csvSections.push('')
    csvSections.push('=== BUDGETS ===')
    csvSections.push('id,accountId,categoryId,month,planned,currency,notes,createdAt')
    exportData.budgets.forEach((b) => {
      csvSections.push(
        [
          b.id,
          b.accountId,
          b.categoryId,
          b.month,
          b.planned,
          b.currency,
          `"${(b.notes ?? '').replace(/"/g, '""')}"`,
          b.createdAt,
        ].join(','),
      )
    })

    // Holdings section
    csvSections.push('')
    csvSections.push('=== HOLDINGS ===')
    csvSections.push('id,accountId,categoryId,symbol,quantity,averageCost,currency,notes,createdAt')
    exportData.holdings.forEach((h) => {
      csvSections.push(
        [
          h.id,
          h.accountId,
          h.categoryId,
          h.symbol,
          h.quantity,
          h.averageCost,
          h.currency,
          `"${(h.notes ?? '').replace(/"/g, '""')}"`,
          h.createdAt,
        ].join(','),
      )
    })

    // Recurring templates section
    csvSections.push('')
    csvSections.push('=== RECURRING TEMPLATES ===')
    csvSections.push(
      'id,accountId,categoryId,type,amount,currency,dayOfMonth,description,isActive,startMonth,endMonth,createdAt',
    )
    exportData.recurringTemplates.forEach((r) => {
      csvSections.push(
        [
          r.id,
          r.accountId,
          r.categoryId,
          r.type,
          r.amount,
          r.currency,
          r.dayOfMonth,
          `"${(r.description ?? '').replace(/"/g, '""')}"`,
          r.isActive,
          r.startMonth,
          r.endMonth ?? '',
          r.createdAt,
        ].join(','),
      )
    })

    return success({ data: csvSections.join('\n'), format: 'csv' as const })
  } catch (error) {
    serverLogger.error('Failed to export user data', { action: 'exportUserDataAction', userId: authUser.id }, error)
    return generalError('Unable to export data. Please try again.')
  }
}
