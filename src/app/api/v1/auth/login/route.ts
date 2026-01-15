import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials } from '@/lib/auth-server'
import { AUTH_USERS } from '@/lib/auth'
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { rateLimitError } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit login attempts by normalized email
    const rateLimit = checkRateLimit(normalizedEmail)
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimit(normalizedEmail)

    const isValid = await verifyCredentials({ email, password })
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const authUser = AUTH_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const accessToken = generateAccessToken(authUser.id, normalizedEmail)
    const { token: refreshToken, jti, expiresAt } = generateRefreshToken(authUser.id, normalizedEmail)

    await prisma.refreshToken.create({
      data: { jti, userId: authUser.id, email: normalizedEmail, expiresAt },
    })

    return NextResponse.json({
      success: true,
      data: { accessToken, refreshToken, expiresIn: 900 },
    })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
