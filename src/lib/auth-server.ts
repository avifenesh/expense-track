import 'server-only'

import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { ACCOUNT_COOKIE, AUTH_USERS, SESSION_COOKIE, USER_COOKIE, type AuthSession, type AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const SESSION_SECRET = process.env.AUTH_SESSION_SECRET ?? 'balance-beacon-hardcoded-secret'

type MutableCookies = Awaited<ReturnType<typeof cookies>> & {
  set: (name: string, value: string, options?: Record<string, unknown>) => void
  delete: (name: string) => void
  get: (name: string) => { value: string } | undefined
}

async function getCookieStore(): Promise<MutableCookies> {
  const store = (await Promise.resolve(cookies())) as MutableCookies
  return store
}

function createSessionToken(username: string) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(username).digest('hex')
}

function isSessionTokenValid({ token, username }: { token?: string; username?: string }) {
  if (!token || !username) return false
  const expected = createSessionToken(username)
  if (expected.length !== token.length) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch (error) {
    console.error('session validation failed', error)
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
}) {
  const normalizedEmail = email.trim().toLowerCase()
  const authUser = AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)
  if (!authUser) {
    return false
  }

  try {
    const match = await bcrypt.compare(password, authUser.passwordHash)
    return match
  } catch (error) {
    console.error('verifyCredentials error', error)
    return false
  }
}

export async function establishSession({ userEmail, accountId }: { userEmail: string; accountId: string }) {
  const cookieStore = await getCookieStore()
  const token = createSessionToken(userEmail)
  cookieStore.set(USER_COOKIE, userEmail, baseCookieConfig)
  cookieStore.set(SESSION_COOKIE, token, baseCookieConfig)
  cookieStore.set(ACCOUNT_COOKIE, accountId, baseCookieConfig)
  return { token }
}

export async function updateSessionAccount(accountId: string) {
  const cookieStore = await getCookieStore()
  const session = await getSession()
  if (!session) {
    return { error: 'No active session' }
  }
  const authUser = getAuthUserFromSession(session)
  if (!authUser) {
    return { error: 'User record not found' }
  }

  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) {
    return { error: 'Account not found' }
  }

  if (!authUser.accountNames.includes(account.name)) {
    return { error: 'Account is not available for this user' }
  }

  cookieStore.set(ACCOUNT_COOKIE, accountId, baseCookieConfig)
  return { success: true }
}

export async function clearSession() {
  const cookieStore = await getCookieStore()
  cookieStore.delete(USER_COOKIE)
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(ACCOUNT_COOKIE)
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await getCookieStore()
  const userEmail = cookieStore.get(USER_COOKIE)?.value
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const accountId = cookieStore.get(ACCOUNT_COOKIE)?.value

  if (!isSessionTokenValid({ token, username: userEmail })) {
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
