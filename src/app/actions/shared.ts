/**
 * Shared authentication and authorization utilities for server actions.
 *
 * ## Auth Pattern Guide
 *
 * Choose the appropriate function based on your action's requirements:
 *
 * 1. **requireAuthUser()** - For read-only actions or when you just need user identity
 *    Example: getMySharedExpensesAction(), getExpensesSharedWithMeAction()
 *
 * 2. **requireActiveSubscription()** - For mutating actions that don't have an accountId
 *    Returns authUser to avoid needing a separate requireAuthUser() call.
 *    Example: shareExpenseAction() (uses transactionId, not accountId directly)
 *
 * 3. **ensureAccountAccess()** - For read-only actions that need account ownership verification
 *    Example: viewing account-specific data without mutation
 *
 * 4. **ensureAccountAccessWithSubscription()** - For mutating actions with an accountId
 *    This is the preferred pattern for most mutations. Performs a single auth check.
 *    Example: createTransactionAction(), upsertBudgetAction()
 *
 * ## Avoid These Anti-Patterns
 *
 * - DON'T call requireAuthUser() after requireActiveSubscription()
 *   (requireActiveSubscription returns authUser, use it directly)
 *
 * - DON'T call both ensureAccountAccess() and requireActiveSubscription()
 *   (use ensureAccountAccessWithSubscription() instead)
 */

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { getDbUserAsAuthUser, requireSession } from '@/lib/auth-server'
import { validateCsrfToken } from '@/lib/csrf'
import { hasActiveSubscription, getSubscriptionState, type SubscriptionState } from '@/lib/subscription'

// Re-export from utils for backwards compatibility with actions
export { toDecimalString } from '@/utils/decimal'

export function parseInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
): { data: T } | { error: Record<string, string[]> } {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }
  return { data: parsed.data }
}

export async function requireCsrfToken(
  token: string | undefined | null,
): Promise<{ success: true } | { error: Record<string, string[]> }> {
  const valid = await validateCsrfToken(token)
  if (!valid) {
    return {
      error: {
        general: ['Security validation failed. Please refresh the page and try again.'],
      },
    }
  }
  return { success: true }
}

type AuthUserResult = { authUser: AuthUser } | { error: Record<string, string[]> }

export async function requireAuthUser(): Promise<AuthUserResult> {
  let session
  try {
    session = await requireSession()
  } catch {
    return { error: { general: ['Your session expired. Please sign in again.'] } }
  }

  // Get user from database
  const authUser = await getDbUserAsAuthUser(session.userEmail)

  if (!authUser) {
    return { error: { general: ['We could not resolve your user profile. Please sign in again.'] } }
  }

  return { authUser }
}

type AccountRecord = NonNullable<Awaited<ReturnType<typeof prisma.account.findUnique>>>

export type AccountAccessSuccess = {
  account: AccountRecord
  authUser: AuthUser
}

export type AccountAccessError = { error: Record<string, string[]> }

export async function ensureAccountAccess(accountId: string): Promise<AccountAccessSuccess | AccountAccessError> {
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  let account
  try {
    account = await prisma.account.findUnique({ where: { id: accountId } })
  } catch {
    return { error: { general: ['Unable to verify the selected account. Try again shortly.'] } }
  }

  if (!account) {
    return { error: { accountId: ['Account not found'] } }
  }

  if (account.userId !== authUser.id) {
    return { error: { accountId: ['You do not have access to this account'] } }
  }

  return { account, authUser }
}

/**
 * Require an active subscription (trial or paid) to proceed with mutating actions.
 * Returns error if subscription is expired/canceled.
 * Returns authUser to avoid callers needing to call requireAuthUser() again.
 */
export async function requireActiveSubscription(): Promise<
  { success: true; subscriptionState: SubscriptionState; authUser: AuthUser } | { error: Record<string, string[]> }
> {
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const isActive = await hasActiveSubscription(authUser.id)
  if (!isActive) {
    return {
      error: {
        subscription: ['Your subscription has expired. Please upgrade to continue using the app.'],
      },
    }
  }

  const subscriptionState = await getSubscriptionState(authUser.id)
  return { success: true, subscriptionState, authUser }
}

/**
 * Combined check for account access AND active subscription.
 * Use this for all mutating operations that require an account context.
 *
 * This function performs a single auth check to avoid N+1 query patterns.
 * It verifies: user authentication, account ownership, and subscription status.
 */
export async function ensureAccountAccessWithSubscription(
  accountId: string,
): Promise<(AccountAccessSuccess & { subscriptionState: SubscriptionState }) | AccountAccessError> {
  // Single auth check to get user info
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  // Verify account ownership
  let account
  try {
    account = await prisma.account.findUnique({ where: { id: accountId } })
  } catch {
    return { error: { general: ['Unable to verify the selected account. Try again shortly.'] } }
  }

  if (!account) {
    return { error: { accountId: ['Account not found'] } }
  }

  if (account.userId !== authUser.id) {
    return { error: { accountId: ['You do not have access to this account'] } }
  }

  // Check subscription status (single call - avoids redundant DB query)
  const subscriptionState = await getSubscriptionState(authUser.id)
  if (!subscriptionState.canAccessApp) {
    return {
      error: {
        subscription: ['Your subscription has expired. Please upgrade to continue using the app.'],
      },
    }
  }

  return { account, authUser, subscriptionState }
}
