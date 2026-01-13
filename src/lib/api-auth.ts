import 'server-only'

import { NextRequest } from 'next/server'
import { verifyAccessToken } from './jwt'

export interface AuthenticatedUser {
  userId: string
  email: string
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  return authHeader.substring(7)
}

export function requireJwtAuth(request: NextRequest): AuthenticatedUser {
  const token = extractBearerToken(request)

  if (!token) {
    throw new Error('Missing authorization token')
  }

  try {
    const payload = verifyAccessToken(token)
    return { userId: payload.userId, email: payload.email }
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new Error('Token expired')
    }
    throw new Error('Invalid token')
  }
}
