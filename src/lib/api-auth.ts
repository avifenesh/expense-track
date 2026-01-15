import 'server-only'

import { NextRequest } from 'next/server'
import { verifyAccessToken } from './jwt'
import { prisma } from './prisma'
import type { AuthUser } from './auth'

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

/**
 * Get full auth user info from userId by querying the database
 * @throws Error if user not found
 */
export async function getUserAuthInfo(userId: string): Promise<AuthUser> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { accounts: { orderBy: { name: 'asc' } } },
  })

  if (!dbUser || dbUser.accounts.length === 0) {
    throw new Error('User not found')
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    passwordHash: dbUser.passwordHash,
    accountNames: dbUser.accounts.map((a) => a.name),
    defaultAccountName: dbUser.accounts[0].name,
    preferredCurrency: dbUser.preferredCurrency,
  }
}
