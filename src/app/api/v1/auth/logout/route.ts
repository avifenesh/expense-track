import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { rateLimitError } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    let jti: string
    let userId: string
    try {
      const payload = verifyRefreshToken(refreshToken)
      jti = payload.jti!
      userId = payload.userId
    } catch {
      const decoded = jwt.decode(refreshToken) as { jti?: string; userId?: string } | null
      if (!decoded?.jti || !decoded?.userId) {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 400 })
      }
      jti = decoded.jti
      userId = decoded.userId
    }

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
