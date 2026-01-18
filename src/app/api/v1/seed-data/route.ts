import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { successResponse, forbiddenError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/default-categories'
import { getMonthStart } from '@/utils/date'

/**
 * POST /api/v1/seed-data
 *
 * Seeds the user's account with sample data:
 * - Default expense and income categories
 * - Sample transactions (grocery expense, salary income)
 * - Sample budget for groceries
 *
 * @returns {Object} { categoriesCreated, transactionsCreated, budgetsCreated }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired or no account found
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // Get user's first account
      const account = await prisma.account.findFirst({
        where: { userId: user.userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
      if (!account) {
        return forbiddenError('No account found. Please create an account first.')
      }

      // Get user's preferred currency
      const userRecord = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { preferredCurrency: true },
      })
      const currency = userRecord?.preferredCurrency || 'USD'

      // Create default expense categories
      const expenseCategories = await Promise.all(
        DEFAULT_EXPENSE_CATEGORIES.map((cat) =>
          prisma.category.upsert({
            where: {
              userId_name_type: {
                userId: user.userId,
                name: cat.name,
                type: 'EXPENSE',
              },
            },
            create: {
              userId: user.userId,
              name: cat.name,
              type: 'EXPENSE',
              color: cat.color,
            },
            update: {
              isArchived: false,
            },
          }),
        ),
      )

      // Create default income categories
      const incomeCategories = await Promise.all(
        DEFAULT_INCOME_CATEGORIES.map((cat) =>
          prisma.category.upsert({
            where: {
              userId_name_type: {
                userId: user.userId,
                name: cat.name,
                type: 'INCOME',
              },
            },
            create: {
              userId: user.userId,
              name: cat.name,
              type: 'INCOME',
              color: cat.color,
            },
            update: {
              isArchived: false,
            },
          }),
        ),
      )

      const now = new Date()
      const month = getMonthStart(now)

      const groceriesCat = expenseCategories.find((c) => c.name === 'Groceries')
      const salaryCat = incomeCategories.find((c) => c.name === 'Salary')

      let transactionsCreated = 0

      if (groceriesCat) {
        await prisma.transaction.create({
          data: {
            accountId: account.id,
            categoryId: groceriesCat.id,
            type: 'EXPENSE',
            amount: 85.5,
            date: now,
            month,
            description: 'Weekly grocery shopping',
            currency,
          },
        })
        transactionsCreated++
      }

      if (salaryCat) {
        await prisma.transaction.create({
          data: {
            accountId: account.id,
            categoryId: salaryCat.id,
            type: 'INCOME',
            amount: 3500.0,
            date: new Date(now.getFullYear(), now.getMonth(), 1),
            month,
            description: 'Monthly salary',
            currency,
          },
        })
        transactionsCreated++
      }

      let budgetsCreated = 0
      if (groceriesCat) {
        await prisma.budget.upsert({
          where: {
            accountId_categoryId_month: {
              accountId: account.id,
              categoryId: groceriesCat.id,
              month,
            },
          },
          create: {
            accountId: account.id,
            categoryId: groceriesCat.id,
            month,
            planned: 400,
            currency,
          },
          update: {},
        })
        budgetsCreated = 1
      }

      return successResponse(
        {
          categoriesCreated: DEFAULT_EXPENSE_CATEGORIES.length + DEFAULT_INCOME_CATEGORIES.length,
          transactionsCreated,
          budgetsCreated,
        },
        201,
      )
    },
    { requireSubscription: true },
  )
}
