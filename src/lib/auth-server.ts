import 'server-only'

import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import {
  ACCOUNT_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  SESSION_TS_COOKIE,
  USER_COOKIE,
  type AuthSession,
  type AuthUser,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET environment variable is required')
  }
  return secret
}

const SESSION_SECRET = getSessionSecret()

type MutableCookies = Awaited<ReturnType<typeof cookies>> & {
  set: (name: string, value: string, options?: Record<string, unknown>) => void
  delete: (name: string) => void
  get: (name: string) => { value: string } | undefined
}

async function getCookieStore(): Promise<MutableCookies> {
  const store = (await Promise.resolve(cookies())) as MutableCookies
  return store
}

function createSessionToken(username: string, timestamp: number) {
  // Include timestamp in HMAC to prevent token prediction
  const payload = `${username}:${timestamp}`
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
}

function isSessionTokenValid({
  token,
  username,
  timestamp,
}: {
  token?: string
  username?: string
  timestamp?: string
}) {
  if (!token || !username || !timestamp) return false

  // Parse and validate timestamp
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false

  // Check session expiry (expire at or past the max age boundary)
  const now = Date.now()
  if (now >= ts + SESSION_MAX_AGE_MS) {
    return false
  }

  const expected = createSessionToken(username, ts)
  if (expected.length !== token.length) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}

const baseCookieConfig = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

/**
 * Verify user credentials against the database.
 * Returns validation result with userId on success.
 */
export async function verifyCredentials({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<{ valid: false; reason?: 'email_not_verified' } | { valid: true; userId: string }> {
  const normalizedEmail = email.trim().toLowerCase()

  // Check database users
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true, emailVerified: true },
  })

  if (!dbUser) {
    return { valid: false }
  }

  // Check password first before revealing email verification status
  try {
    const match = await bcrypt.compare(password, dbUser.passwordHash)
    if (!match) {
      return { valid: false }
    }
  } catch {
    return { valid: false }
  }

  // Password is correct - now check email verification
  if (!dbUser.emailVerified) {
    return { valid: false, reason: 'email_not_verified' }
  }

  return { valid: true, userId: dbUser.id }
}

export async function establishSession({ userEmail, accountId }: { userEmail: string; accountId: string }) {
  const cookieStore = await getCookieStore()
  const timestamp = Date.now()
  const token = createSessionToken(userEmail, timestamp)
  cookieStore.set(USER_COOKIE, userEmail, baseCookieConfig)
  cookieStore.set(SESSION_COOKIE, token, baseCookieConfig)
  cookieStore.set(SESSION_TS_COOKIE, String(timestamp), baseCookieConfig)
  cookieStore.set(ACCOUNT_COOKIE, accountId, baseCookieConfig)
  return { token }
}

export async function updateSessionAccount(
  accountId: string,
): Promise<{ success: true } | { error: { general: string[] } }> {
  const cookieStore = await getCookieStore()
  const session = await getSession()
  if (!session) {
    return { error: { general: ['No active session'] } }
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) {
    return { error: { general: ['Account not found'] } }
  }

  // Check access for database users
  const dbUser = await prisma.user.findUnique({
    where: { email: session.userEmail.toLowerCase() },
    include: { accounts: { select: { id: true } } },
  })
  if (!dbUser) {
    return { error: { general: ['User record not found'] } }
  }
  const hasAccess = dbUser.accounts.some((acc) => acc.id === accountId)
  if (!hasAccess) {
    return { error: { general: ['Account is not available for this user'] } }
  }

  cookieStore.set(ACCOUNT_COOKIE, accountId, baseCookieConfig)
  return { success: true }
}

export async function clearSession() {
  const cookieStore = await getCookieStore()
  cookieStore.delete(USER_COOKIE)
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(SESSION_TS_COOKIE)
  cookieStore.delete(ACCOUNT_COOKIE)
}

/**
 * Validate session token from cookies without database lookup.
 * Use this for fast validation when you don't need user data.
 * Returns session data if token is cryptographically valid.
 *
 * Note: This does NOT verify the user still exists or has verified email.
 * For full security checks, use getSession() instead.
 */
export async function validateSessionToken(): Promise<AuthSession | null> {
  const cookieStore = await getCookieStore()
  const userEmail = cookieStore.get(USER_COOKIE)?.value
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const timestamp = cookieStore.get(SESSION_TS_COOKIE)?.value
  const accountId = cookieStore.get(ACCOUNT_COOKIE)?.value

  if (!isSessionTokenValid({ token, username: userEmail, timestamp })) {
    return null
  }

  return { userEmail: userEmail!, accountId }
}

/**
 * Get and validate session with database verification.
 * This is the recommended function for authenticated routes.
 *
 * Performs two checks:
 * 1. Token validation (cryptographic) - via validateSessionToken()
 * 2. User verification (database) - ensures user exists and email is verified
 *
 * Use validateSessionToken() instead if you only need token validation
 * and will separately verify the user via getDbUserAsAuthUser().
 */
export async function getSession(): Promise<AuthSession | null> {
  // Step 1: Validate token (no DB)
  const tokenSession = await validateSessionToken()
  if (!tokenSession) {
    return null
  }

  // Step 2: Verify user exists in database with verified email
  const dbUser = await prisma.user.findUnique({
    where: { email: tokenSession.userEmail.toLowerCase() },
    select: { id: true, emailVerified: true },
  })

  if (!dbUser || !dbUser.emailVerified) {
    return null
  }

  return tokenSession
}

/**
 * Require a valid session or throw.
 * Use this in server actions and API routes that require authentication.
 * @throws Error if no valid session
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthenticated')
  }
  return session
}

/**
 * Get database user with their accounts as an AuthUser-compatible object.
 * Returns undefined if user not found or has no accounts.
 *
 * Typical usage pattern:
 * 1. Call requireSession() to validate session
 * 2. Call getDbUserAsAuthUser(session.userEmail) to get full user data
 *
 * Note: This function fetches accounts which may not always be needed.
 * Consider getDbUserBasic() for lightweight user data without accounts.
 */
export async function getDbUserAsAuthUser(email: string): Promise<AuthUser | undefined> {
  const normalizedEmail = email.toLowerCase()
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { accounts: { orderBy: { name: 'asc' } } },
  })

  if (!dbUser || dbUser.accounts.length === 0) {
    return undefined
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    passwordHash: dbUser.passwordHash,
    accountNames: dbUser.accounts.map((a) => a.name),
    defaultAccountName: dbUser.accounts[0].name,
    preferredCurrency: dbUser.preferredCurrency,
    hasCompletedOnboarding: dbUser.hasCompletedOnboarding,
  }
}

/**
 * Get basic user info without accounts.
 * Use this when you only need user identity (id, email, displayName)
 * and don't need account names. More efficient than getDbUserAsAuthUser().
 */
export async function getDbUserBasic(
  email: string,
): Promise<{ id: string; email: string; displayName: string } | undefined> {
  const normalizedEmail = email.toLowerCase()
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, displayName: true },
  })

  if (!dbUser) {
    return undefined
  }

  return dbUser
}
