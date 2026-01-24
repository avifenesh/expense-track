import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  authError,
  notFoundError,
  serverError,
  successResponse,
  validationError,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
})

/**
 * PUT /api/v1/accounts/[id]
 *
 * Updates an account's name.
 *
 * @param {Object} body - { name: string }
 * @returns {Object} { id, name, type, preferredCurrency, color, icon, description }
 * @throws {400} Validation error - Invalid input
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {404} Not found - Account not found or not owned by user
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to update account
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const parsed = updateAccountSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.userId,
      deletedAt: null,
    },
  })

  if (!account) {
    return notFoundError('Account not found')
  }

  const existingWithName = await prisma.account.findFirst({
    where: {
      userId: user.userId,
      name: parsed.data.name,
      deletedAt: null,
      id: { not: accountId },
    },
  })

  if (existingWithName) {
    return validationError({ name: ['An account with this name already exists'] })
  }

  try {
    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: { name: parsed.data.name },
      select: {
        id: true,
        name: true,
        type: true,
        preferredCurrency: true,
        color: true,
        icon: true,
        description: true,
      },
    })

    return successResponse(updatedAccount)
  } catch (error) {
    serverLogger.error('Failed to update account', {
      action: 'PUT /api/v1/accounts/[id]',
      userId: user.userId,
      accountId,
    }, error)
    return serverError('Unable to update account')
  }
}

/**
 * DELETE /api/v1/accounts/[id]
 *
 * Soft deletes an account. Cannot delete the only account or the active account.
 *
 * @returns {Object} { success: true }
 * @throws {400} Validation error - Cannot delete only/active account
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {404} Not found - Account not found or not owned by user
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to delete account
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.userId,
      deletedAt: null,
    },
  })

  if (!account) {
    return notFoundError('Account not found')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { activeAccountId: true },
  })

  if (dbUser?.activeAccountId === accountId) {
    return validationError({ id: ['Cannot delete the active account. Switch to another account first.'] })
  }

  const accountCount = await prisma.account.count({
    where: {
      userId: user.userId,
      deletedAt: null,
    },
  })

  if (accountCount <= 1) {
    return validationError({ id: ['Cannot delete your only account.'] })
  }

  try {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    return successResponse({ deleted: true })
  } catch (error) {
    serverLogger.error('Failed to delete account', {
      action: 'DELETE /api/v1/accounts/[id]',
      userId: user.userId,
      accountId,
    }, error)
    return serverError('Unable to delete account')
  }
}
