import { NextRequest, NextResponse } from 'next/server'
import { processExpiredSubscriptions } from '@/lib/subscription'
import { serverLogger } from '@/lib/server-logger'
import { checkCronRateLimit } from '@/lib/rate-limit'

/**
 * Cron endpoint to expire subscriptions.
 * Can be called by Railway cron service or any scheduler.
 *
 * Alternative: Run `npx tsx scripts/expire-subscriptions.ts` directly.
 *
 * Security:
 * - Requires CRON_SECRET authorization header to prevent unauthorized access
 * - Rate limited to 1 request per minute per IP to prevent abuse
 *
 * Set CRON_SECRET env var and pass as Bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // Verify cron secret - always required for security
  if (!cronSecret) {
    serverLogger.error('Cron subscription expiration: CRON_SECRET not configured', {
      action: 'cron.subscriptions',
    })
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    serverLogger.warn('Cron subscription expiration: unauthorized access attempt', {
      action: 'cron.subscriptions',
      clientIp,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by IP to prevent abuse (even with valid secret)
  const rateLimitKey = `cron:${clientIp}`
  if (!checkCronRateLimit(rateLimitKey)) {
    serverLogger.warn('Cron subscription expiration: rate limited', {
      action: 'cron.subscriptions',
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
    const expiredCount = await processExpiredSubscriptions()

    serverLogger.info('Cron subscription expiration completed', {
      action: 'cron.subscriptions',
      expiredCount,
    })

    return NextResponse.json({
      success: true,
      expiredCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    serverLogger.error('Cron subscription expiration failed', { action: 'cron.subscriptions' }, error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process expired subscriptions',
      },
      { status: 500 },
    )
  }
}
