import { NextRequest, NextResponse } from 'next/server'
import { processExpiredSubscriptions } from '@/lib/subscription'
import { serverLogger } from '@/lib/server-logger'

/**
 * Cron endpoint to expire subscriptions.
 * Can be called by Railway cron service or any scheduler.
 *
 * Alternative: Run `npx tsx scripts/expire-subscriptions.ts` directly.
 *
 * Security: Requires CRON_SECRET authorization header to prevent unauthorized access.
 * Set CRON_SECRET env var and pass as Bearer token.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Verify cron secret (required in production)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    serverLogger.warn('Cron subscription expiration: unauthorized access attempt', {
      action: 'cron.subscriptions',
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
