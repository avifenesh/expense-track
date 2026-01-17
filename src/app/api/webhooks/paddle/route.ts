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
 * Paddle webhook endpoint
 * Handles subscription lifecycle events from Paddle Billing
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

    serverLogger.info('PADDLE_WEBHOOK_RECEIVED', {
      eventType: event.event_type,
      eventId: event.event_id,
      notificationId: event.notification_id,
    })

    await handlePaddleEvent(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    serverLogger.error('PADDLE_WEBHOOK_ERROR', {
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : String(error),
    })

    // Check if this is a transient error that Paddle should retry
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isTransientError =
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT') ||
      errorMessage.includes('database') ||
      errorMessage.includes('connection')

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
