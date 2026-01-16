'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { successVoid, generalError, success } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { getDbUserAsAuthUser, requireSession } from '@/lib/auth-server'
import { parseInput, requireCsrfToken, requireActiveSubscription } from './shared'
import {
  completeOnboardingSchema,
  skipOnboardingSchema,
  updatePreferredCurrencySchema,
  createInitialCategoriesSchema,
  createQuickBudgetSchema,
  seedSampleDataSchema,
} from '@/schemas'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '@/lib/default-categories'
import { getMonthStart } from '@/utils/date'
import type {
  CompleteOnboardingInput,
  SkipOnboardingInput,
  UpdatePreferredCurrencyInput,
  CreateInitialCategoriesInput,
  CreateQuickBudgetInput,
  SeedSampleDataInput,
} from '@/schemas'

/**
 * Mark onboarding as complete for the current user.
 */
export async function completeOnboardingAction(input: CompleteOnboardingInput) {
  const parsed = parseInput(completeOnboardingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  try {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { hasCompletedOnboarding: true },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'completeOnboarding',
      userId: authUser.id,
      input: {},
      fallbackMessage: 'Unable to complete onboarding',
    })
  }

  revalidatePath('/')
  return successVoid()
}

/**
 * Skip onboarding and mark as complete without any setup.
 */
export async function skipOnboardingAction(input: SkipOnboardingInput) {
  const parsed = parseInput(skipOnboardingSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  try {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { hasCompletedOnboarding: true },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'skipOnboarding',
      userId: authUser.id,
      input: {},
      fallbackMessage: 'Unable to skip onboarding',
    })
  }

  revalidatePath('/')
  return successVoid()
}

/**
 * Update the user's preferred currency during onboarding.
 */
export async function updatePreferredCurrencyAction(input: UpdatePreferredCurrencyInput) {
  const parsed = parseInput(updatePreferredCurrencySchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  try {
    await prisma.user.update({
      where: { id: authUser.id },
      data: { preferredCurrency: parsed.data.currency },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'updatePreferredCurrency',
      userId: authUser.id,
      input: parsed.data,
      fallbackMessage: 'Unable to update currency preference',
    })
  }

  revalidatePath('/')
  return successVoid()
}

/**
 * Create initial categories for the user during onboarding.
 */
export async function createInitialCategoriesAction(input: CreateInitialCategoriesInput) {
  const parsed = parseInput(createInitialCategoriesSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  try {
    // Create categories in a transaction to ensure atomicity
    await prisma.$transaction(
      parsed.data.categories.map((cat) =>
        prisma.category.upsert({
          where: {
            userId_name_type: {
              userId: authUser.id,
              name: cat.name,
              type: cat.type,
            },
          },
          create: {
            userId: authUser.id,
            name: cat.name,
            type: cat.type,
            color: cat.color ?? null,
          },
          update: {
            color: cat.color ?? undefined,
            isArchived: false,
          },
        }),
      ),
    )
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createInitialCategories',
      userId: authUser.id,
      input: parsed.data,
      fallbackMessage: 'Unable to create categories',
    })
  }

  revalidatePath('/')
  return success({ categoriesCreated: parsed.data.categories.length })
}

/**
 * Create a quick budget for a category during onboarding.
 */
export async function createQuickBudgetAction(input: CreateQuickBudgetInput) {
  const parsed = parseInput(createQuickBudgetSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  // Verify account belongs to user
  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: authUser.id },
  })
  if (!account) {
    return generalError('Account not found or access denied')
  }

  // Verify category belongs to user
  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, userId: authUser.id },
  })
  if (!category) {
    return generalError('Category not found or access denied')
  }

  // Parse month from monthKey (e.g., "2024-01" -> Date)
  const [year, monthNum] = parsed.data.monthKey.split('-').map(Number)
  const month = getMonthStart(new Date(year, monthNum - 1, 1))

  try {
    await prisma.budget.upsert({
      where: {
        accountId_categoryId_month: {
          accountId: parsed.data.accountId,
          categoryId: parsed.data.categoryId,
          month,
        },
      },
      create: {
        accountId: parsed.data.accountId,
        categoryId: parsed.data.categoryId,
        month,
        planned: parsed.data.planned,
        currency: parsed.data.currency,
      },
      update: {
        planned: parsed.data.planned,
        currency: parsed.data.currency,
      },
    })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'createQuickBudget',
      userId: authUser.id,
      input: parsed.data,
      fallbackMessage: 'Unable to create budget',
    })
  }

  revalidatePath('/')
  return successVoid()
}

/**
 * Seed sample data for the user during onboarding.
 * Creates default categories and a sample transaction.
 */
export async function seedSampleDataAction(input: SeedSampleDataInput) {
  const parsed = parseInput(seedSampleDataSchema, input)
  if ('error' in parsed) return parsed

  const csrfCheck = await requireCsrfToken(parsed.data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  let session
  try {
    session = await requireSession()
  } catch {
    return generalError('Your session expired. Please sign in again.')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    return generalError('User record not found')
  }

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  // Get user's first account
  const account = await prisma.account.findFirst({
    where: { userId: authUser.id },
    orderBy: { createdAt: 'asc' },
  })
  if (!account) {
    return generalError('No account found. Please create an account first.')
  }

  try {
    // Create default expense categories
    const expenseCategories = await Promise.all(
      DEFAULT_EXPENSE_CATEGORIES.map((cat) =>
        prisma.category.upsert({
          where: {
            userId_name_type: {
              userId: authUser.id,
              name: cat.name,
              type: 'EXPENSE',
            },
          },
          create: {
            userId: authUser.id,
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
              userId: authUser.id,
              name: cat.name,
              type: 'INCOME',
            },
          },
          create: {
            userId: authUser.id,
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

    // Create sample transactions for the current month
    const now = new Date()
    const month = getMonthStart(now)

    // Find groceries and salary categories
    const groceriesCat = expenseCategories.find((c) => c.name === 'Groceries')
    const salaryCat = incomeCategories.find((c) => c.name === 'Salary')

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
          currency: authUser.preferredCurrency,
        },
      })
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
          currency: authUser.preferredCurrency,
        },
      })
    }

    // Create a sample budget for groceries
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
          currency: authUser.preferredCurrency,
        },
        update: {},
      })
    }
  } catch (error) {
    return handlePrismaError(error, {
      action: 'seedSampleData',
      userId: authUser.id,
      input: {},
      fallbackMessage: 'Unable to create sample data',
    })
  }

  revalidatePath('/')
  return success({
    categoriesCreated: DEFAULT_EXPENSE_CATEGORIES.length + DEFAULT_INCOME_CATEGORIES.length,
    transactionsCreated: 2,
    budgetsCreated: 1,
  })
}
