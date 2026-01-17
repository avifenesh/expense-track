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

/** Result type for generic resource ownership check */
export type ResourceOwnershipResult<T> =
  | { allowed: true; resource: T }
  | { allowed: false; reason: string }

/**
 * Generic resource ownership verification.
 * Fetches a resource and verifies the user has access to it.
 *
 * @param fetchFn - Function that fetches the resource (should include userId filter)
 * @param resourceType - Human-readable resource type for error messages
 * @returns The resource if found and allowed, or an error result
 */
export async function ensureResourceOwnership<T>(
  fetchFn: () => Promise<T | null>,
  resourceType: string,
): Promise<ResourceOwnershipResult<T>> {
  const resource = await fetchFn()

  if (!resource) {
    return { allowed: false, reason: `${resourceType} not found or access denied` }
  }

  return { allowed: true, resource }
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
    where: { id: holdingId, account: { userId }, deletedAt: null },
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
    where: { id: templateId, account: { userId }, deletedAt: null },
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
    where: { id: transactionId, account: { userId }, deletedAt: null },
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
    where: { id: accountId, userId, deletedAt: null },
  })

  if (!account) {
    return { allowed: false, reason: 'Account not found or access denied' }
  }

  return { allowed: true }
}
