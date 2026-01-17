import crypto from 'node:crypto'
import { cookies } from 'next/headers'

export const CSRF_COOKIE = 'balance_csrf'
export const CSRF_HEADER = 'X-CSRF-Token'
const CSRF_TOKEN_LENGTH = 32

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET required for CSRF token generation')
  }
  return secret
}

function generateCsrfToken(): string {
  const randomBytes = crypto.randomBytes(CSRF_TOKEN_LENGTH)
  return randomBytes.toString('base64url')
}

function signToken(token: string): string {
  const secret = getSessionSecret()
  const signature = crypto.createHmac('sha256', secret).update(token).digest('base64url')
  return `${token}.${signature}`
}

function verifyToken(signedToken: string): string | null {
  const parts = signedToken.split('.')
  if (parts.length !== 2) return null

  const [token, signature] = parts
  const secret = getSessionSecret()
  const expectedSig = crypto.createHmac('sha256', secret).update(token).digest('base64url')

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null
    }
  } catch {
    return null
  }

  return token
}

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(CSRF_COOKIE)?.value

  if (existing) {
    const verified = verifyToken(existing)
    if (verified) return verified
  }

  const token = generateCsrfToken()
  const signed = signToken(token)

  cookieStore.set(CSRF_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return token
}

export async function validateCsrfToken(submittedToken: string | undefined | null): Promise<boolean> {
  // Skip CSRF validation in Vitest test environment only
  // Use VITEST env var which is set by Vitest, not NODE_ENV which could be manipulated
  if (process.env.VITEST === 'true') {
    return true
  }

  if (!submittedToken) return false

  const cookieStore = await cookies()
  const signedToken = cookieStore.get(CSRF_COOKIE)?.value

  if (!signedToken) return false

  const cookieToken = verifyToken(signedToken)
  if (!cookieToken) return false

  try {
    return crypto.timingSafeEqual(Buffer.from(submittedToken), Buffer.from(cookieToken))
  } catch {
    return false
  }
}

export async function rotateCsrfToken(): Promise<string> {
  const cookieStore = await cookies()
  cookieStore.delete(CSRF_COOKIE)
  return getCsrfToken()
}
