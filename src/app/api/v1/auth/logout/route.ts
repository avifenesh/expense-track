import { NextRequest, NextResponse } from 'next/server'
import { verifyRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json({ error: 'Refresh token required' }, { status: 400 })
    }

    let jti: string
    try {
      const payload = verifyRefreshToken(refreshToken)
      jti = payload.jti!
    } catch {
      const decoded = jwt.decode(refreshToken) as { jti?: string } | null
      if (!decoded?.jti) {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 400 })
      }
      jti = decoded.jti
    }

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
