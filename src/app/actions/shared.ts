import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { getDbUserAsAuthUser, requireSession } from '@/lib/auth-server'
import { validateCsrfToken } from '@/lib/csrf'
import { hasActiveSubscription, getSubscriptionState, type SubscriptionState } from '@/lib/subscription'

// Currency precision: 2 decimal places (cents), scale factor 100
const DECIMAL_PRECISION = 2
const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)

export function toDecimalString(input: number) {
  return (Math.round(input * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
}

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
 */
export async function requireActiveSubscription(): Promise<
  { success: true; subscriptionState: SubscriptionState } | { error: Record<string, string[]> }
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
  return { success: true, subscriptionState }
}

/**
 * Combined check for account access AND active subscription.
 * Use this for all mutating operations.
 */
export async function ensureAccountAccessWithSubscription(
  accountId: string,
): Promise<(AccountAccessSuccess & { subscriptionState: SubscriptionState }) | AccountAccessError> {
  const accountAccess = await ensureAccountAccess(accountId)
  if ('error' in accountAccess) return accountAccess

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  return {
    ...accountAccess,
    subscriptionState: subscriptionCheck.subscriptionState,
  }
}
