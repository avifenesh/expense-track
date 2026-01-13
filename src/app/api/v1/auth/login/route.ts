import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials } from '@/lib/auth-server'
import { AUTH_USERS } from '@/lib/auth'
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const isValid = await verifyCredentials({ email, password })
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const authUser = AUTH_USERS.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const accessToken = generateAccessToken(authUser.id, email)
    const { token: refreshToken, jti, expiresAt } = generateRefreshToken(authUser.id, email)

    await prisma.refreshToken.create({
      data: { jti, userId: authUser.id, email, expiresAt },
    })

    return NextResponse.json({
      success: true,
      data: { accessToken, refreshToken, expiresIn: 900 },
    })
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
