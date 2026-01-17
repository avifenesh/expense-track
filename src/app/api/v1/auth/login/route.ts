import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials } from '@/lib/auth-server'
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { rateLimitError, validationError, authError, serverError } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields with consistent error format
    const fieldErrors: Record<string, string[]> = {}
    if (!email) fieldErrors.email = ['Email is required']
    if (!password) fieldErrors.password = ['Password is required']
    if (Object.keys(fieldErrors).length > 0) {
      return validationError(fieldErrors)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit login attempts by normalized email (5/min for brute force protection)
    const rateLimit = checkRateLimitTyped(normalizedEmail, 'login')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    // Increment on every attempt (before validation) to count failed attempts
    incrementRateLimitTyped(normalizedEmail, 'login')

    const result = await verifyCredentials({ email, password })
    if (!result.valid) {
      // Return generic error for all auth failures to prevent email enumeration
      // (different messages for "not found" vs "wrong password" vs "unverified" would reveal email existence)
      return authError('Invalid email or password')
    }

    const userId = result.userId
    const accessToken = generateAccessToken(userId, normalizedEmail)
    const { token: refreshToken, jti, expiresAt } = generateRefreshToken(userId, normalizedEmail)

    await prisma.refreshToken.create({
      data: { jti, userId, email: normalizedEmail, expiresAt },
    })

    return NextResponse.json({
      success: true,
      data: { accessToken, refreshToken, expiresIn: 900 },
    })
  } catch {
    return serverError('Login failed')
  }
}
