import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serverLogger } from '@/lib/server-logger'

/**
 * In-memory rate limiter for cron endpoints
 * Limits to 1 request per minute per IP
 */
const cronRateLimit = new Map<string, number>()
const CRON_RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

function checkCronRateLimit(identifier: string): boolean {
  const now = Date.now()
  const lastRequest = cronRateLimit.get(identifier)

  // Cleanup old entries (older than 5 minutes)
  if (cronRateLimit.size > 100) {
    const cutoff = now - 5 * 60 * 1000
    for (const [key, timestamp] of cronRateLimit) {
      if (timestamp < cutoff) cronRateLimit.delete(key)
    }
  }

  if (lastRequest && now - lastRequest < CRON_RATE_LIMIT_WINDOW_MS) {
    return false // Rate limited
  }

  cronRateLimit.set(identifier, now)
  return true // Allowed
}

/**
 * Cron endpoint for database cleanup tasks.
 * Removes expired tokens and stale data.
 *
 * Tasks performed:
 * - Clean up expired password reset tokens (older than 24 hours)
 * - Clean up expired email verification tokens (older than 24 hours)
 * - Clean up expired refresh tokens
 *
 * Security:
 * - Requires CRON_SECRET authorization header
 * - Rate limited to 1 request per minute per IP
 *
 * Recommended schedule: Daily at off-peak hours
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Verify cron secret
  if (!cronSecret) {
    serverLogger.error('Cron cleanup: CRON_SECRET not configured', {
      action: 'cron.cleanup',
    })
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    serverLogger.warn('Cron cleanup: unauthorized access attempt', {
      action: 'cron.cleanup',
      clientIp,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit
  const rateLimitKey = `cron-cleanup:${clientIp}`
  if (!checkCronRateLimit(rateLimitKey)) {
    serverLogger.warn('Cron cleanup: rate limited', {
      action: 'cron.cleanup',
      clientIp,
    })
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      },
    )
  }

  try {
    const results = await performCleanup()

    serverLogger.info('Cron cleanup completed', {
      action: 'cron.cleanup',
      ...results,
    })

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    serverLogger.error('Cron cleanup failed', { action: 'cron.cleanup' }, error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform cleanup',
      },
      { status: 500 },
    )
  }
}

/**
 * Perform all cleanup tasks
 */
async function performCleanup(): Promise<{
  expiredPasswordResetTokens: number
  expiredEmailVerificationTokens: number
  expiredRefreshTokens: number
}> {
  const now = new Date()

  // Clean up expired password reset tokens
  // Tokens are valid for 1 hour, but we clean up tokens older than 24 hours
  // to allow for some buffer in case of timezone issues
  const passwordResetCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const passwordResetResult = await prisma.user.updateMany({
    where: {
      passwordResetToken: { not: null },
      passwordResetExpires: { lt: passwordResetCutoff },
    },
    data: {
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  })

  // Clean up expired email verification tokens
  // Tokens are valid for 24 hours, clean up tokens older than 48 hours
  const emailVerificationCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const emailVerificationResult = await prisma.user.updateMany({
    where: {
      emailVerificationToken: { not: null },
      emailVerificationExpires: { lt: emailVerificationCutoff },
    },
    data: {
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  })

  // Clean up expired refresh tokens
  const refreshTokenResult = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })

  return {
    expiredPasswordResetTokens: passwordResetResult.count,
    expiredEmailVerificationTokens: emailVerificationResult.count,
    expiredRefreshTokens: refreshTokenResult.count,
  }
}
