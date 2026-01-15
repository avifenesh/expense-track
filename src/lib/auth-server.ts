import 'server-only'

import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import {
  ACCOUNT_COOKIE,
  AUTH_USERS,
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

  // Check session expiry
  const now = Date.now()
  if (now - ts > SESSION_MAX_AGE_MS) {
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

export async function verifyCredentials({
  email,
  password,
}: {
  email: string
  password: string
}): Promise<{ valid: false } | { valid: true; source: 'legacy' | 'database'; userId?: string }> {
  const normalizedEmail = email.trim().toLowerCase()

  // First, check legacy AUTH_USERS (for backwards compatibility with seeded users)
  const legacyUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)
  if (legacyUser) {
    try {
      const match = await bcrypt.compare(password, legacyUser.passwordHash)
      if (match) {
        return { valid: true, source: 'legacy' }
      }
    } catch {
      // Fall through to database check
    }
  }

  // Check database users
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true, emailVerified: true },
  })

  if (!dbUser) {
    return { valid: false }
  }

  // Check email verification for database users
  if (!dbUser.emailVerified) {
    return { valid: false }
  }

  try {
    const match = await bcrypt.compare(password, dbUser.passwordHash)
    if (match) {
      return { valid: true, source: 'database', userId: dbUser.id }
    }
  } catch {
    // Password comparison failed
  }

  return { valid: false }
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
  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return { error: { general: ['User record not found'] } }
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) {
    return { error: { general: ['Account not found'] } }
  }

  if (!authUser.accountNames.includes(account.name)) {
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

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await getCookieStore()
  const userEmail = cookieStore.get(USER_COOKIE)?.value
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const timestamp = cookieStore.get(SESSION_TS_COOKIE)?.value
  const accountId = cookieStore.get(ACCOUNT_COOKIE)?.value

  if (!isSessionTokenValid({ token, username: userEmail, timestamp })) {
    return null
  }
  const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === userEmail!.toLowerCase())
  if (!authUser) {
    return null
  }
  return { userEmail: userEmail!, accountId }
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthenticated')
  }
  return session
}

export function getAuthUserFromSession(session: AuthSession): AuthUser | undefined {
  const normalizedEmail = session.userEmail.toLowerCase()
  return AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)
}
