import 'server-only'

import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { ACCOUNT_COOKIE, AUTH_USER, SESSION_COOKIE, USER_COOKIE, type AuthSession } from '@/lib/auth'

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
  username,
  password,
}: {
  username: string
  password: string
}) {
  if (username.trim().toLowerCase() !== AUTH_USER.username) {
    return false
  }

  try {
    const match = await bcrypt.compare(password, AUTH_USER.passwordHash)
    return match
  } catch (error) {
    console.error('verifyCredentials error', error)
    return false
  }
}

export async function establishSession({ username, accountId }: { username: string; accountId: string }) {
  const cookieStore = await getCookieStore()
  const token = createSessionToken(username)
  cookieStore.set(USER_COOKIE, username, baseCookieConfig)
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
  const username = cookieStore.get(USER_COOKIE)?.value
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const accountId = cookieStore.get(ACCOUNT_COOKIE)?.value

  if (!isSessionTokenValid({ token, username })) {
    return null
  }

  return { username: username!, accountId }
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthenticated')
  }
  return session
}
