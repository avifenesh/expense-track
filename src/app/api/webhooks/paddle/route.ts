import { NextRequest, NextResponse } from 'next/server'
import { serverLogger } from '@/lib/server-logger'
import {
  verifyWebhookSignature,
  parsePaddleEvent,
  extractUserIdFromEvent,
  isSubscriptionEvent,
  isTransactionEvent,
  type PaddleWebhookEvent,
  type PaddleSubscriptionData,
  type PaddleTransactionData,
} from '@/lib/paddle'
import {
  activateSubscription,
  cancelSubscription,
  markSubscriptionPastDue,
  linkPaddleSubscription,
  findSubscriptionByPaddleId,
  updateSubscriptionPeriod,
} from '@/lib/subscription'

/**
 * In-memory cache for processed webhook event IDs to prevent replay attacks.
 * Events are stored with their processing timestamp.
 *
 * Note: This is an in-memory implementation that resets on cold start.
 * For production with high reliability requirements, consider:
 * - Redis-backed deduplication
 * - Database table for processed events
 *
 * TTL: 24 hours (Paddle may retry within this window)
 */
const processedEventIds = new Map<string, number>()
const EVENT_ID_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHED_EVENTS = 10000 // Prevent unbounded memory growth

/**
 * Check if an event has already been processed (replay protection)
 * @returns true if this is a duplicate event that should be skipped
 */
function isDuplicateEvent(eventId: string): boolean {
  const now = Date.now()

  // Cleanup expired entries if cache is getting large
  if (processedEventIds.size > MAX_CACHED_EVENTS / 2) {
    const cutoff = now - EVENT_ID_TTL_MS
    for (const [id, timestamp] of processedEventIds) {
      if (timestamp < cutoff) {
        processedEventIds.delete(id)
      }
    }
  }

  // Check if event was already processed
  const processedAt = processedEventIds.get(eventId)
  if (processedAt !== undefined) {
    // Still within TTL window - this is a duplicate
    if (now - processedAt < EVENT_ID_TTL_MS) {
      return true
    }
    // Expired - allow reprocessing (shouldn't happen normally)
    processedEventIds.delete(eventId)
  }

  return false
}

/**
 * Mark an event as processed
 */
function markEventProcessed(eventId: string): void {
  processedEventIds.set(eventId, Date.now())
}

/**
 * Paddle webhook endpoint
 * Handles subscription lifecycle events from Paddle Billing
 *
 * Security:
 * - Verifies webhook signature using PADDLE_WEBHOOK_SECRET
 * - Implements event_id deduplication to prevent replay attacks
 *
 * Events handled:
 * - subscription.created: New subscription created → link Paddle IDs
 * - subscription.activated: Subscription activated → activate subscription
 * - subscription.updated: Subscription updated → update period dates
 * - subscription.canceled: User canceled → mark as canceled
 * - transaction.completed: Payment succeeded → extend subscription period
 * - transaction.payment_failed: Payment failed → mark as past due
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('paddle-signature')

    // Verify webhook signature
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
    if (!webhookSecret) {
      serverLogger.error('PADDLE_WEBHOOK_NO_SECRET', {
        message: 'PADDLE_WEBHOOK_SECRET not configured',
      })
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      serverLogger.warn('PADDLE_WEBHOOK_INVALID_SIGNATURE', {
        message: 'Invalid webhook signature',
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse and handle the event
    const event = parsePaddleEvent(rawBody)

    // Check for replay attack (duplicate event_id)
    if (isDuplicateEvent(event.event_id)) {
      serverLogger.info('PADDLE_WEBHOOK_DUPLICATE', {
        eventType: event.event_type,
        eventId: event.event_id,
        message: 'Duplicate event detected, skipping',
      })
      // Return 200 to acknowledge - Paddle doesn't need to retry
      return NextResponse.json({ received: true, duplicate: true })
    }

    serverLogger.info('PADDLE_WEBHOOK_RECEIVED', {
      eventType: event.event_type,
      eventId: event.event_id,
      notificationId: event.notification_id,
    })

    await handlePaddleEvent(event)

    // Mark event as processed after successful handling
    markEventProcessed(event.event_id)

    return NextResponse.json({ received: true })
  } catch (error) {
    serverLogger.error('PADDLE_WEBHOOK_ERROR', {
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : String(error),
    })

    // Check if this is a transient error that Paddle should retry
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    // Known transient error patterns from various sources (DB drivers, network, etc.)
    const transientPatterns = [
      'econnrefused',
      'etimedout',
      'econnreset',
      'epipe',
      'database',
      'connection',
      'timeout',
      'pool exhausted',
      'too many connections',
      'deadlock',
      'lock wait',
      'transaction',
      'network',
      'socket',
      'unavailable',
      'temporarily',
    ]
    const isTransientError = transientPatterns.some((pattern) => errorMessage.includes(pattern))

    if (isTransientError) {
      // Return 5xx so Paddle can retry on transient failures
      return NextResponse.json({ error: 'Processing error' }, { status: 500 })
    }

    // Return 200 for permanent errors to prevent infinite retries
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}

/**
 * Handle a Paddle webhook event
 */
async function handlePaddleEvent(event: PaddleWebhookEvent): Promise<void> {
  const eventType = event.event_type

  switch (eventType) {
    case 'subscription.created':
      await handleSubscriptionCreated(event)
      break

    case 'subscription.activated':
      await handleSubscriptionActivated(event)
      break

    case 'subscription.updated':
      await handleSubscriptionUpdated(event)
      break

    case 'subscription.canceled':
      await handleSubscriptionCanceled(event)
      break

    case 'transaction.completed':
      await handleTransactionCompleted(event)
      break

    case 'transaction.payment_failed':
      await handleTransactionFailed(event)
      break

    default:
      serverLogger.info('PADDLE_WEBHOOK_UNHANDLED', {
        eventType,
        eventId: event.event_id,
      })
  }
}

/**
 * Handle subscription.created event
 * Links the Paddle subscription ID to the user's subscription
 */
async function handleSubscriptionCreated(event: PaddleWebhookEvent): Promise<void> {
  if (!isSubscriptionEvent(event)) return

  const data = event.data as PaddleSubscriptionData
  const userId = extractUserIdFromEvent(event)

  if (!userId) {
    serverLogger.error('PADDLE_WEBHOOK_NO_USER_ID', {
      eventType: event.event_type,
      subscriptionId: data.id,
      message: 'No user_id in custom_data',
    })
    return
  }

  const priceId = data.items?.[0]?.price?.id || process.env.PADDLE_PRICE_ID || ''

  await linkPaddleSubscription(userId, data.customer_id, data.id, priceId)

  serverLogger.info('PADDLE_SUBSCRIPTION_LINKED', {
    userId,
    paddleSubscriptionId: data.id,
    paddleCustomerId: data.customer_id,
  })
}

/**
 * Handle subscription.activated event
 * Activates the user's subscription after payment succeeds
 */
async function handleSubscriptionActivated(event: PaddleWebhookEvent): Promise<void> {
  if (!isSubscriptionEvent(event)) return

  const data = event.data as PaddleSubscriptionData
  const userId = await resolveUserId(event, data.id)

  if (!userId) return

  const billingPeriod = data.current_billing_period
  if (!billingPeriod) {
    serverLogger.error('PADDLE_WEBHOOK_NO_BILLING_PERIOD', {
      eventType: event.event_type,
      subscriptionId: data.id,
    })
    return
  }

  const periodStart = new Date(billingPeriod.starts_at)
  const periodEnd = new Date(billingPeriod.ends_at)

  // Validate parsed dates
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    serverLogger.error('PADDLE_WEBHOOK_INVALID_BILLING_DATES', {
      eventType: event.event_type,
      subscriptionId: data.id,
      startsAt: billingPeriod.starts_at,
      endsAt: billingPeriod.ends_at,
    })
    return
  }

  await activateSubscription(userId, periodStart, periodEnd)

  serverLogger.info('PADDLE_SUBSCRIPTION_ACTIVATED', {
    userId,
    paddleSubscriptionId: data.id,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  })
}

/**
 * Handle subscription.updated event
 * Updates subscription period dates
 */
async function handleSubscriptionUpdated(event: PaddleWebhookEvent): Promise<void> {
  if (!isSubscriptionEvent(event)) return

  const data = event.data as PaddleSubscriptionData
  const userId = await resolveUserId(event, data.id)

  if (!userId) return

  const billingPeriod = data.current_billing_period
  if (billingPeriod) {
    const periodStart = new Date(billingPeriod.starts_at)
    const periodEnd = new Date(billingPeriod.ends_at)

    // Validate parsed dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      serverLogger.error('PADDLE_WEBHOOK_INVALID_BILLING_DATES', {
        eventType: event.event_type,
        subscriptionId: data.id,
        startsAt: billingPeriod.starts_at,
        endsAt: billingPeriod.ends_at,
      })
      return
    }

    await updateSubscriptionPeriod(userId, periodStart, periodEnd)

    serverLogger.info('PADDLE_SUBSCRIPTION_UPDATED', {
      userId,
      paddleSubscriptionId: data.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  }
}

/**
 * Handle subscription.canceled event
 * Marks the subscription as canceled (access retained until period end)
 */
async function handleSubscriptionCanceled(event: PaddleWebhookEvent): Promise<void> {
  if (!isSubscriptionEvent(event)) return

  const data = event.data as PaddleSubscriptionData
  const userId = await resolveUserId(event, data.id)

  if (!userId) return

  await cancelSubscription(userId)

  serverLogger.info('PADDLE_SUBSCRIPTION_CANCELED', {
    userId,
    paddleSubscriptionId: data.id,
  })
}

/**
 * Handle transaction.completed event
 * Extends the subscription period after successful payment
 */
async function handleTransactionCompleted(event: PaddleWebhookEvent): Promise<void> {
  if (!isTransactionEvent(event)) return

  const data = event.data as PaddleTransactionData

  if (!data.subscription_id) {
    // One-time payment, not a subscription renewal
    return
  }

  const userId = await resolveUserId(event, data.subscription_id)

  if (!userId) return

  const billingPeriod = data.billing_period
  if (billingPeriod) {
    const periodStart = new Date(billingPeriod.starts_at)
    const periodEnd = new Date(billingPeriod.ends_at)

    // Validate parsed dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      serverLogger.error('PADDLE_WEBHOOK_INVALID_BILLING_DATES', {
        eventType: event.event_type,
        transactionId: data.id,
        startsAt: billingPeriod.starts_at,
        endsAt: billingPeriod.ends_at,
      })
      return
    }

    await activateSubscription(userId, periodStart, periodEnd)

    serverLogger.info('PADDLE_PAYMENT_COMPLETED', {
      userId,
      transactionId: data.id,
      paddleSubscriptionId: data.subscription_id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    })
  }
}

/**
 * Handle transaction.payment_failed event
 * Marks the subscription as past due
 */
async function handleTransactionFailed(event: PaddleWebhookEvent): Promise<void> {
  if (!isTransactionEvent(event)) return

  const data = event.data as PaddleTransactionData

  if (!data.subscription_id) {
    return
  }

  const userId = await resolveUserId(event, data.subscription_id)

  if (!userId) return

  await markSubscriptionPastDue(userId)

  serverLogger.info('PADDLE_PAYMENT_FAILED', {
    userId,
    transactionId: data.id,
    paddleSubscriptionId: data.subscription_id,
  })
}

/**
 * Resolve user ID from event custom_data or by looking up the Paddle subscription
 */
async function resolveUserId(
  event: PaddleWebhookEvent,
  paddleSubscriptionId: string,
): Promise<string | null> {
  // First try custom_data
  const userId = extractUserIdFromEvent(event)
  if (userId) return userId

  // Fall back to looking up by Paddle subscription ID
  const subscription = await findSubscriptionByPaddleId(paddleSubscriptionId)
  if (subscription) {
    return subscription.userId
  }

  serverLogger.error('PADDLE_WEBHOOK_USER_NOT_FOUND', {
    eventType: event.event_type,
    paddleSubscriptionId,
    message: 'Could not resolve user ID',
  })

  return null
}
