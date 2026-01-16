import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * API authorization helpers for verifying resource ownership.
 * These functions check if a resource belongs to a user before allowing access.
 */

export interface OwnershipResult {
  allowed: boolean
  reason?: string
}

/**
 * Verify that a category belongs to the specified user
 */
export async function ensureApiCategoryOwnership(categoryId: string, userId: string): Promise<OwnershipResult> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  })

  if (!category) {
    return { allowed: false, reason: 'Category not found or access denied' }
  }

  return { allowed: true }
}

/**
 * Verify that a holding belongs to the specified user (via account)
 */
export async function ensureApiHoldingOwnership(holdingId: string, userId: string): Promise<OwnershipResult> {
  const holding = await prisma.holding.findFirst({
    where: { id: holdingId, account: { userId } },
  })

  if (!holding) {
    return { allowed: false, reason: 'Holding not found or access denied' }
  }

  return { allowed: true }
}

/**
 * Verify that a recurring template belongs to the specified user (via account)
 */
export async function ensureApiRecurringOwnership(templateId: string, userId: string): Promise<OwnershipResult> {
  const template = await prisma.recurringTemplate.findFirst({
    where: { id: templateId, account: { userId } },
  })

  if (!template) {
    return { allowed: false, reason: 'Recurring template not found or access denied' }
  }

  return { allowed: true }
}

/**
 * Verify that a transaction belongs to the specified user (via account)
 */
export async function ensureApiTransactionOwnership(transactionId: string, userId: string): Promise<OwnershipResult> {
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { userId } },
  })

  if (!transaction) {
    return { allowed: false, reason: 'Transaction not found or access denied' }
  }

  return { allowed: true }
}

/**
 * Verify that an account belongs to the specified user
 */
export async function ensureApiAccountOwnership(accountId: string, userId: string): Promise<OwnershipResult> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  })

  if (!account) {
    return { allowed: false, reason: 'Account not found or access denied' }
  }

  return { allowed: true }
}
