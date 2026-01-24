import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken, type TokenPayload } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { env } from '@/lib/env-schema'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { rateLimitError } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    let payload: TokenPayload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      try {
        payload = jwt.verify(refreshToken, env.jwtSecret, { ignoreExpiration: true }) as TokenPayload
      } catch {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 400 })
      }

      if (payload.type !== 'refresh' || !payload.jti) {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 400 })
      }
    }

    const { jti, userId } = payload

    // Rate limit check
    const rateLimit = checkRateLimit(userId)
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimit(userId)

    await prisma.refreshToken.deleteMany({
      where: { jti },
    })

    return NextResponse.json({
      success: true,
      data: { message: 'Logged out successfully' },
    })
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
