'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { clearSession, updateSessionAccount } from '@/lib/auth-server'
import { success, successVoid, failure, generalError } from '@/lib/action-result'
import { parseInput, ensureAccountAccess, requireCsrfToken, requireAuthUser } from './shared'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'
import {
  accountSelectionSchema,
  deleteAccountSchema,
  exportUserDataSchema,
} from '@/schemas'

/** Switch active account in session. */
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

    // 1. TransactionRequest - depends on Account, Category (special case: fromId/toId)
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

    // 2-5. Delete related records that depend on Account or Category
    // These models all share the same accountId/categoryId pattern
    if (accountIds.length > 0 || categoryIds.length > 0) {
      const orConditions: ({ accountId: { in: string[] } } | { categoryId: { in: string[] } })[] = []
      if (accountIds.length > 0) {
        orConditions.push({ accountId: { in: accountIds } })
      }
      if (categoryIds.length > 0) {
        orConditions.push({ categoryId: { in: categoryIds } })
      }
      const whereClause = { where: { OR: orConditions } }

      deleteOps.push(
        prisma.transaction.deleteMany(whereClause),
        prisma.holding.deleteMany(whereClause),
        prisma.budget.deleteMany(whereClause),
        prisma.recurringTemplate.deleteMany(whereClause),
      )
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

  const { format } = parsed.data

  try {
    // Stage 1: Fetch user and accounts in parallel (need accountIds for stage 2)
    const [user, accounts] = await Promise.all([
      prisma.user.findUnique({
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
      }),
      prisma.account.findMany({
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
      }),
    ])

    if (!user) {
      return generalError('User not found')
    }

    const accountIds = accounts.map((a) => a.id)

    // Stage 2: Fetch all remaining data in parallel
    const [subscription, categories, transactions, budgets, holdings, recurringTemplates] = await Promise.all([
      prisma.subscription.findUnique({
        where: { userId: authUser.id },
        select: {
          id: true,
          status: true,
          trialEndsAt: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          createdAt: true,
        },
      }),
      prisma.category.findMany({
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
      }),
      accountIds.length > 0
        ? prisma.transaction.findMany({
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
        : Promise.resolve([]),
      accountIds.length > 0
        ? prisma.budget.findMany({
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
        : Promise.resolve([]),
      accountIds.length > 0
        ? prisma.holding.findMany({
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
        : Promise.resolve([]),
      accountIds.length > 0
        ? prisma.recurringTemplate.findMany({
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
        : Promise.resolve([]),
    ])

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

    // Increment rate limit only after successful data fetch
    incrementRateLimitTyped(authUser.id, 'data_export')

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

    // CSV helpers
    type CsvValue = string | number | boolean | null | undefined
    const escapeCsv = (value: string | null | undefined): string =>
      `"${(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`

    const addCsvSection = <T>(
      sections: string[],
      title: string,
      headers: string,
      data: T[],
      rowMapper: (item: T) => CsvValue[],
    ): void => {
      if (sections.length > 0) sections.push('')
      sections.push(`=== ${title} ===`)
      sections.push(headers)
      data.forEach((item) =>
        sections.push(
          rowMapper(item)
            .map((v) => v ?? '')
            .join(','),
        ),
      )
    }

    const csvSections: string[] = []

    // User section (single row, handled separately)
    csvSections.push('=== USER ===')
    csvSections.push('id,email,displayName,preferredCurrency,emailVerified,hasCompletedOnboarding,createdAt')
    csvSections.push(
      [
        exportData.user.id,
        escapeCsv(exportData.user.email),
        escapeCsv(exportData.user.displayName),
        exportData.user.preferredCurrency,
        exportData.user.emailVerified,
        exportData.user.hasCompletedOnboarding,
        exportData.user.createdAt,
      ].join(','),
    )

    // Subscription section (single row, conditional)
    if (exportData.subscription) {
      const sub = exportData.subscription
      csvSections.push('')
      csvSections.push('=== SUBSCRIPTION ===')
      csvSections.push('id,status,trialEndsAt,currentPeriodStart,currentPeriodEnd,createdAt')
      csvSections.push(
        [
          sub.id,
          sub.status,
          sub.trialEndsAt ?? '',
          sub.currentPeriodStart ?? '',
          sub.currentPeriodEnd ?? '',
          sub.createdAt,
        ].join(','),
      )
    }

    addCsvSection(
      csvSections,
      'ACCOUNTS',
      'id,name,type,preferredCurrency,color,icon,description,createdAt',
      exportData.accounts,
      (a) => [
        a.id,
        escapeCsv(a.name),
        a.type,
        a.preferredCurrency,
        a.color,
        a.icon,
        escapeCsv(a.description),
        a.createdAt,
      ],
    )

    addCsvSection(
      csvSections,
      'CATEGORIES',
      'id,name,type,color,isHolding,isArchived,createdAt',
      exportData.categories,
      (c) => [c.id, escapeCsv(c.name), c.type, c.color, c.isHolding, c.isArchived, c.createdAt],
    )

    addCsvSection(
      csvSections,
      'TRANSACTIONS',
      'id,accountId,categoryId,type,amount,currency,date,month,description,isRecurring,isMutual,createdAt',
      exportData.transactions,
      (t) => [
        t.id,
        t.accountId,
        t.categoryId,
        t.type,
        t.amount,
        t.currency,
        t.date,
        t.month,
        escapeCsv(t.description),
        t.isRecurring,
        t.isMutual,
        t.createdAt,
      ],
    )

    addCsvSection(
      csvSections,
      'BUDGETS',
      'id,accountId,categoryId,month,planned,currency,notes,createdAt',
      exportData.budgets,
      (b) => [b.id, b.accountId, b.categoryId, b.month, b.planned, b.currency, escapeCsv(b.notes), b.createdAt],
    )

    addCsvSection(
      csvSections,
      'HOLDINGS',
      'id,accountId,categoryId,symbol,quantity,averageCost,currency,notes,createdAt',
      exportData.holdings,
      (h) => [
        h.id,
        h.accountId,
        h.categoryId,
        h.symbol,
        h.quantity,
        h.averageCost,
        h.currency,
        escapeCsv(h.notes),
        h.createdAt,
      ],
    )

    addCsvSection(
      csvSections,
      'RECURRING TEMPLATES',
      'id,accountId,categoryId,type,amount,currency,dayOfMonth,description,isActive,startMonth,endMonth,createdAt',
      exportData.recurringTemplates,
      (r) => [
        r.id,
        r.accountId,
        r.categoryId,
        r.type,
        r.amount,
        r.currency,
        r.dayOfMonth,
        escapeCsv(r.description),
        r.isActive,
        r.startMonth,
        r.endMonth,
        r.createdAt,
      ],
    )

    return success({ data: csvSections.join('\n'), format: 'csv' as const })
  } catch (error) {
    serverLogger.error('Failed to export user data', { action: 'exportUserDataAction', userId: authUser.id }, error)
    return generalError('Unable to export data. Please try again.')
  }
}
