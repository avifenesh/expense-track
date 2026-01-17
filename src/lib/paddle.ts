import 'server-only'

import crypto from 'crypto'
import { serverLogger } from './server-logger'

// Paddle API base URLs
const PADDLE_API_URL = {
  sandbox: 'https://sandbox-api.paddle.com',
  production: 'https://api.paddle.com',
}

// Maximum age for webhook timestamps (5 minutes in seconds)
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60

export type PaddleEnvironment = 'sandbox' | 'production'

/**
 * Get Paddle configuration from environment variables
 */
export function getPaddleConfig() {
  const apiKey = process.env.PADDLE_API_KEY
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET
  const priceId = process.env.PADDLE_PRICE_ID
  const environment = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox') as PaddleEnvironment

  if (!apiKey) {
    throw new Error('PADDLE_API_KEY environment variable is required')
  }

  if (!webhookSecret) {
    throw new Error('PADDLE_WEBHOOK_SECRET environment variable is required')
  }

  if (!priceId) {
    throw new Error('PADDLE_PRICE_ID environment variable is required')
  }

  return {
    apiKey,
    webhookSecret,
    priceId,
    environment,
    apiUrl: PADDLE_API_URL[environment],
  }
}

/**
 * Verify Paddle webhook signature (HMAC-SHA256)
 * Returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  webhookSecret: string,
): boolean {
  if (!signature) {
    serverLogger.warn('PADDLE_WEBHOOK_NO_SIGNATURE', {
      message: 'Missing Paddle-Signature header',
    })
    return false
  }

  try {
    // Paddle signature format: ts=<timestamp>;h1=<signature>
    const parts = signature.split(';')
    const tsMatch = parts.find((p) => p.startsWith('ts='))
    const h1Match = parts.find((p) => p.startsWith('h1='))

    if (!tsMatch || !h1Match) {
      serverLogger.warn('PADDLE_WEBHOOK_INVALID_SIGNATURE_FORMAT', {
        message: 'Invalid signature format',
        signature,
      })
      return false
    }

    const timestamp = tsMatch.replace('ts=', '')
    const providedHash = h1Match.replace('h1=', '')

    // Validate timestamp to prevent replay attacks
    const webhookTime = parseInt(timestamp, 10)
    const currentTime = Math.floor(Date.now() / 1000)
    if (isNaN(webhookTime) || currentTime - webhookTime > MAX_WEBHOOK_AGE_SECONDS) {
      serverLogger.warn('PADDLE_WEBHOOK_TIMESTAMP_EXPIRED', {
        message: 'Webhook timestamp is too old or invalid',
        webhookTime,
        currentTime,
        ageSeconds: currentTime - webhookTime,
      })
      return false
    }

    // Build signed payload: timestamp:rawBody
    const signedPayload = `${timestamp}:${rawBody}`

    // Compute expected signature
    const expectedHash = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')

    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(Buffer.from(providedHash, 'hex'), Buffer.from(expectedHash, 'hex'))

    if (!isValid) {
      serverLogger.warn('PADDLE_WEBHOOK_SIGNATURE_MISMATCH', {
        message: 'Webhook signature verification failed',
      })
    }

    return isValid
  } catch (error) {
    serverLogger.error('PADDLE_WEBHOOK_SIGNATURE_ERROR', {
      message: 'Error verifying webhook signature',
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

// Paddle webhook event types we handle
export type PaddleEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.activated'
  | 'transaction.completed'
  | 'transaction.payment_failed'

// Paddle subscription status values
export type PaddleSubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing'

// Paddle webhook event structure
export interface PaddleWebhookEvent {
  event_id: string
  event_type: PaddleEventType
  occurred_at: string
  notification_id: string
  data: PaddleSubscriptionData | PaddleTransactionData
}

export interface PaddleSubscriptionData {
  id: string // Paddle subscription ID
  status: PaddleSubscriptionStatus
  customer_id: string
  current_billing_period?: {
    starts_at: string
    ends_at: string
  }
  custom_data?: {
    user_id?: string
  }
  items?: Array<{
    price: {
      id: string
    }
  }>
}

export interface PaddleTransactionData {
  id: string // Paddle transaction ID
  subscription_id?: string
  customer_id: string
  status: 'completed' | 'failed' | 'past_due'
  billing_period?: {
    starts_at: string
    ends_at: string
  }
  custom_data?: {
    user_id?: string
  }
}

/**
 * Parse a Paddle webhook event from the raw request body
 */
export function parsePaddleEvent(rawBody: string): PaddleWebhookEvent {
  return JSON.parse(rawBody) as PaddleWebhookEvent
}

/**
 * Extract user ID from Paddle event custom data
 * We pass user_id in custom_data when creating the checkout
 */
export function extractUserIdFromEvent(
  event: PaddleWebhookEvent,
): string | null {
  const data = event.data as PaddleSubscriptionData | PaddleTransactionData
  return data.custom_data?.user_id || null
}

/**
 * Check if this is a subscription event
 */
export function isSubscriptionEvent(event: PaddleWebhookEvent): event is PaddleWebhookEvent & {
  data: PaddleSubscriptionData
} {
  return event.event_type.startsWith('subscription.')
}

/**
 * Check if this is a transaction event
 */
export function isTransactionEvent(event: PaddleWebhookEvent): event is PaddleWebhookEvent & {
  data: PaddleTransactionData
} {
  return event.event_type.startsWith('transaction.')
}

/**
 * Get the Paddle checkout URL for a user to subscribe
 * This is used when initializing Paddle.js on the frontend
 */
export function getPaddleCheckoutSettings(userId: string, userEmail: string) {
  const config = getPaddleConfig()

  return {
    priceId: config.priceId,
    customData: {
      user_id: userId,
    },
    customer: {
      email: userEmail,
    },
  }
}

/**
 * Make an authenticated request to the Paddle API
 */
export async function paddleApiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  const config = getPaddleConfig()

  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    serverLogger.error('PADDLE_API_ERROR', {
      endpoint,
      status: response.status,
      error,
    })
    throw new Error(`Paddle API error: ${response.status} ${error}`)
  }

  return response.json() as Promise<T>
}

/**
 * Get subscription details from Paddle API
 */
export async function getPaddleSubscription(subscriptionId: string) {
  return paddleApiRequest<{ data: PaddleSubscriptionData }>(`/subscriptions/${subscriptionId}`)
}

/**
 * Cancel a subscription via Paddle API
 */
export async function cancelPaddleSubscription(subscriptionId: string) {
  return paddleApiRequest<{ data: PaddleSubscriptionData }>(
    `/subscriptions/${subscriptionId}/cancel`,
    'POST',
  )
}
