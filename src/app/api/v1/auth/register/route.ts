import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'
import { rateLimitError, validationError, successResponse, serverError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be at most 100 characters')
    .regex(/^[a-zA-Z0-9\s\-']+$/, 'Display name contains invalid characters'),
})

export async function POST(request: NextRequest) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return validationError({ body: ['Invalid JSON'] })
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
    }

    const { email, password, displayName } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Rate limit registration attempts by email (3/min for spam prevention)
    const rateLimit = checkRateLimitTyped(normalizedEmail, 'registration')
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimitTyped(normalizedEmail, 'registration')

    // Check if user already exists - but don't reveal this in response
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // Return success to prevent email enumeration attacks
      // In a real scenario, we would send a different email saying "you already have an account"
      serverLogger.info('Registration attempt for existing email', { email: normalizedEmail })
      return successResponse({ message: 'If this email is not registered, you will receive a verification email shortly.' }, 201)
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12)

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user with unverified email
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        displayName: displayName.trim(),
        passwordHash,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    })

    // Log verification email (actual email sending is a separate task)
    serverLogger.info('Email verification required', {
      email: normalizedEmail,
      token: verificationToken,
      expires: verificationExpires.toISOString(),
      // In production, this would trigger an email send
    })

    // Return generic success message (email enumeration protection)
    return successResponse(
      { message: 'If this email is not registered, you will receive a verification email shortly.' },
      201,
    )
  } catch (error) {
    serverLogger.error('Registration failed', { error })
    return serverError('Registration failed')
  }
}
