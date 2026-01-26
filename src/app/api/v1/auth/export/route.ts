import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  validationError,
  authError,
  successResponseWithRateLimit,
  serverError,
  rateLimitError,
} from '@/lib/api-helpers'
import {
  checkRateLimitTyped,
  incrementRateLimitTyped,
} from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'
import { exportUserDataApiSchema } from '@/schemas/api'

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

/**
 * GET /api/v1/auth/export
 *
 * GDPR-compliant data export endpoint (Article 20 - Right to data portability).
 * Returns all user data in JSON or CSV format.
 *
 * Rate limit: 3 requests per hour (data_export)
 */
export async function GET(request: NextRequest) {
  try {
    let auth
    try {
      auth = requireJwtAuth(request)
    } catch (error) {
      if (error instanceof Error) {
        return authError(error.message)
      }
      return authError('Invalid token')
    }

    const rateLimit = checkRateLimitTyped(auth.userId, 'data_export')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }

    const url = new URL(request.url)
    const formatParam = url.searchParams.get('format') ?? 'json'

    const parsed = exportUserDataApiSchema.safeParse({ format: formatParam })
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { format } = parsed.data

    const [user, accounts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId, deletedAt: null },
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
        where: { userId: auth.userId, deletedAt: null },
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
      return authError('User not found')
    }

    const accountIds = accounts.map((a) => a.id)

    const [subscription, categories, transactions, budgets, holdings, recurringTemplates] = await Promise.all([
      prisma.subscription.findUnique({
        where: { userId: auth.userId },
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
        where: { userId: auth.userId },
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
            where: { accountId: { in: accountIds }, deletedAt: null },
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
            where: { accountId: { in: accountIds }, deletedAt: null },
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
            where: { accountId: { in: accountIds }, deletedAt: null },
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
            where: { accountId: { in: accountIds }, deletedAt: null },
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

    incrementRateLimitTyped(auth.userId, 'data_export')

    serverLogger.info('User data exported (GDPR)', {
      userId: auth.userId,
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
      return successResponseWithRateLimit(exportData, auth.userId, 'data_export')
    }

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

    addCsvSection(
      csvSections,
      'USER',
      'id,email,displayName,preferredCurrency,emailVerified,hasCompletedOnboarding,createdAt',
      [exportData.user],
      (u) => [
        u.id,
        escapeCsv(u.email),
        escapeCsv(u.displayName),
        u.preferredCurrency,
        u.emailVerified,
        u.hasCompletedOnboarding,
        u.createdAt,
      ],
    )

    if (exportData.subscription) {
      addCsvSection(
        csvSections,
        'SUBSCRIPTION',
        'id,status,trialEndsAt,currentPeriodStart,currentPeriodEnd,createdAt',
        [exportData.subscription],
        (s) => [
          s.id,
          s.status,
          s.trialEndsAt ?? '',
          s.currentPeriodStart ?? '',
          s.currentPeriodEnd ?? '',
          s.createdAt,
        ],
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

    return successResponseWithRateLimit(
      { data: csvSections.join('\n'), format: 'csv' as const },
      auth.userId,
      'data_export',
    )
  } catch (error) {
    serverLogger.error('Data export failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return serverError('Data export failed')
  }
}
