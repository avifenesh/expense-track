import 'server-only'

import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

export interface TokenPayload {
  userId: string
  email: string
  type: 'access' | 'refresh'
  jti?: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

export function generateAccessToken(userId: string, email: string): string {
  const secret = getJwtSecret()
  return jwt.sign({ userId, email, type: 'access' }, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })
}

export function generateRefreshToken(
  userId: string,
  email: string,
): {
  token: string
  jti: string
  expiresAt: Date
} {
  const secret = getJwtSecret()
  const jti = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS)
  const token = jwt.sign({ userId, email, type: 'refresh', jti }, secret, {
    expiresIn: REFRESH_TOKEN_EXPIRY_MS / 1000,
  })
  return { token, jti, expiresAt }
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = getJwtSecret()
  const payload = jwt.verify(token, secret) as TokenPayload
  if (payload.type !== 'access') {
    throw new Error('Invalid token type')
  }
  return payload
}

export function verifyRefreshToken(token: string): TokenPayload {
  const secret = getJwtSecret()
  const payload = jwt.verify(token, secret) as TokenPayload
  if (payload.type !== 'refresh' || !payload.jti) {
    throw new Error('Invalid token type')
  }
  return payload
}
