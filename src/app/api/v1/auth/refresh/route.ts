import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { rateLimitError } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    let payload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })
    }

    // Rate limit check
    const rateLimit = checkRateLimit(payload.userId)
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimit(payload.userId)

    const storedToken = await prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    })

    if (!storedToken) {
      return NextResponse.json({ error: 'Refresh token has been revoked' }, { status: 401 })
    }

    await prisma.refreshToken.delete({
      where: { jti: payload.jti },
    })

    const newAccessToken = generateAccessToken(payload.userId, payload.email)
    const { token: newRefreshToken, jti, expiresAt } = generateRefreshToken(payload.userId, payload.email)

    await prisma.refreshToken.create({
      data: { jti, userId: payload.userId, email: payload.email, expiresAt },
    })

    return NextResponse.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 900 },
    })
  } catch {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
