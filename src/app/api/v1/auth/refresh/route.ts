import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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

    const rotationResult = await prisma.$transaction(async (tx) => {
      const { token: newRefreshToken, jti: newJti, expiresAt } = generateRefreshToken(payload.userId, payload.email)

      try {
        await tx.refreshToken.update({
          where: { jti: payload.jti },
          data: {
            jti: newJti,
            userId: payload.userId,
            email: payload.email,
            expiresAt,
          },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return null
        }
        throw error
      }

      const newAccessToken = generateAccessToken(payload.userId, payload.email)

      return {
        newAccessToken,
        newRefreshToken,
      }
    })

    if (!rotationResult) {
      return NextResponse.json({ error: 'Refresh token has been revoked' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      data: {
        accessToken: rotationResult.newAccessToken,
        refreshToken: rotationResult.newRefreshToken,
        expiresIn: 900,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
