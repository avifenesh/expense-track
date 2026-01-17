import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { SubscriptionStatus } from '@prisma/client'

// Mock dependencies BEFORE imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { serverLogger } from '@/lib/server-logger'
import {
  verifyWebhookSignature,
  parsePaddleEvent,
  extractUserIdFromEvent,
  isSubscriptionEvent,
  isTransactionEvent,
  getPaddleCheckoutSettings,
  type PaddleWebhookEvent,
} from '@/lib/paddle'

describe('paddle.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifyWebhookSignature()', () => {
    const webhookSecret = 'test-webhook-secret'

    function createValidSignature(rawBody: string, secret: string): string {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const signedPayload = `${timestamp}:${rawBody}`
      const hash = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
      return `ts=${timestamp};h1=${hash}`
    }

    it('should return true for valid signature', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      const signature = createValidSignature(rawBody, webhookSecret)

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(true)
    })

    it('should return false for invalid signature', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      // Use current timestamp but with wrong hash (same length as SHA-256 hex = 64 chars)
      const currentTimestamp = Math.floor(Date.now() / 1000).toString()
      const wrongHash = '0'.repeat(64) // Valid hex format but wrong value
      const signature = `ts=${currentTimestamp};h1=${wrongHash}`

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(false)
      expect(serverLogger.warn).toHaveBeenCalledWith(
        'PADDLE_WEBHOOK_SIGNATURE_MISMATCH',
        expect.any(Object),
      )
    })

    it('should return false for missing signature', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })

      const result = verifyWebhookSignature(rawBody, null, webhookSecret)

      expect(result).toBe(false)
      expect(serverLogger.warn).toHaveBeenCalledWith(
        'PADDLE_WEBHOOK_NO_SIGNATURE',
        expect.any(Object),
      )
    })

    it('should return false for malformed signature format', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      const signature = 'invalid-format'

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(false)
      expect(serverLogger.warn).toHaveBeenCalledWith(
        'PADDLE_WEBHOOK_INVALID_SIGNATURE_FORMAT',
        expect.any(Object),
      )
    })

    it('should return false for tampered body', () => {
      const originalBody = JSON.stringify({ event_type: 'subscription.created' })
      const signature = createValidSignature(originalBody, webhookSecret)

      const tamperedBody = JSON.stringify({ event_type: 'subscription.canceled' })
      const result = verifyWebhookSignature(tamperedBody, signature, webhookSecret)

      expect(result).toBe(false)
    })

    it('should return false for expired timestamp (replay attack prevention)', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      // Create signature with timestamp from 10 minutes ago (exceeds 5 minute limit)
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 600
      const signedPayload = `${expiredTimestamp}:${rawBody}`
      const hash = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')
      const signature = `ts=${expiredTimestamp};h1=${hash}`

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(false)
      expect(serverLogger.warn).toHaveBeenCalledWith(
        'PADDLE_WEBHOOK_TIMESTAMP_EXPIRED',
        expect.any(Object),
      )
    })

    it('should return false for future timestamp (too far ahead)', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      // Create signature with timestamp 5 minutes in the future (exceeds 60 second tolerance)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 300
      const signedPayload = `${futureTimestamp}:${rawBody}`
      const hash = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')
      const signature = `ts=${futureTimestamp};h1=${hash}`

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(false)
      expect(serverLogger.warn).toHaveBeenCalledWith(
        'PADDLE_WEBHOOK_TIMESTAMP_FUTURE',
        expect.any(Object),
      )
    })

    it('should allow timestamp slightly in the future (clock skew)', () => {
      const rawBody = JSON.stringify({ event_type: 'subscription.created' })
      // Create signature with timestamp 30 seconds in the future (within 60 second tolerance)
      const slightlyFutureTimestamp = Math.floor(Date.now() / 1000) + 30
      const signedPayload = `${slightlyFutureTimestamp}:${rawBody}`
      const hash = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')
      const signature = `ts=${slightlyFutureTimestamp};h1=${hash}`

      const result = verifyWebhookSignature(rawBody, signature, webhookSecret)

      expect(result).toBe(true)
    })
  })

  describe('parsePaddleEvent()', () => {
    it('should parse valid JSON event', () => {
      const rawBody = JSON.stringify({
        event_id: 'evt_123',
        event_type: 'subscription.created',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: {
          id: 'sub_123',
          status: 'active',
          customer_id: 'cus_123',
        },
      })

      const event = parsePaddleEvent(rawBody)

      expect(event.event_id).toBe('evt_123')
      expect(event.event_type).toBe('subscription.created')
      expect(event.data).toMatchObject({
        id: 'sub_123',
        status: 'active',
        customer_id: 'cus_123',
      })
    })

    it('should throw on invalid JSON', () => {
      const rawBody = 'not valid json'

      expect(() => parsePaddleEvent(rawBody)).toThrow()
    })
  })

  describe('extractUserIdFromEvent()', () => {
    it('should extract user_id from custom_data', () => {
      const event: PaddleWebhookEvent = {
        event_id: 'evt_123',
        event_type: 'subscription.created',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: {
          id: 'sub_123',
          status: 'active',
          customer_id: 'cus_123',
          custom_data: {
            user_id: 'user-abc-123',
          },
        },
      }

      const userId = extractUserIdFromEvent(event)

      expect(userId).toBe('user-abc-123')
    })

    it('should return null when custom_data is missing', () => {
      const event: PaddleWebhookEvent = {
        event_id: 'evt_123',
        event_type: 'subscription.created',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: {
          id: 'sub_123',
          status: 'active',
          customer_id: 'cus_123',
        },
      }

      const userId = extractUserIdFromEvent(event)

      expect(userId).toBeNull()
    })

    it('should return null when user_id is missing from custom_data', () => {
      const event: PaddleWebhookEvent = {
        event_id: 'evt_123',
        event_type: 'subscription.created',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: {
          id: 'sub_123',
          status: 'active',
          customer_id: 'cus_123',
          custom_data: {},
        },
      }

      const userId = extractUserIdFromEvent(event)

      expect(userId).toBeNull()
    })
  })

  describe('isSubscriptionEvent()', () => {
    it('should return true for subscription events', () => {
      const subscriptionEvents: PaddleWebhookEvent['event_type'][] = [
        'subscription.created',
        'subscription.updated',
        'subscription.canceled',
        'subscription.activated',
      ]

      for (const eventType of subscriptionEvents) {
        const event = {
          event_id: 'evt_123',
          event_type: eventType,
          occurred_at: '2024-01-15T10:00:00Z',
          notification_id: 'ntf_123',
          data: { id: 'sub_123', status: 'active', customer_id: 'cus_123' },
        } as PaddleWebhookEvent

        expect(isSubscriptionEvent(event)).toBe(true)
      }
    })

    it('should return false for transaction events', () => {
      const event: PaddleWebhookEvent = {
        event_id: 'evt_123',
        event_type: 'transaction.completed',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: { id: 'txn_123', customer_id: 'cus_123', status: 'completed' },
      }

      expect(isSubscriptionEvent(event)).toBe(false)
    })
  })

  describe('isTransactionEvent()', () => {
    it('should return true for transaction events', () => {
      const transactionEvents: PaddleWebhookEvent['event_type'][] = [
        'transaction.completed',
        'transaction.payment_failed',
      ]

      for (const eventType of transactionEvents) {
        const event = {
          event_id: 'evt_123',
          event_type: eventType,
          occurred_at: '2024-01-15T10:00:00Z',
          notification_id: 'ntf_123',
          data: { id: 'txn_123', customer_id: 'cus_123', status: 'completed' },
        } as PaddleWebhookEvent

        expect(isTransactionEvent(event)).toBe(true)
      }
    })

    it('should return false for subscription events', () => {
      const event: PaddleWebhookEvent = {
        event_id: 'evt_123',
        event_type: 'subscription.created',
        occurred_at: '2024-01-15T10:00:00Z',
        notification_id: 'ntf_123',
        data: { id: 'sub_123', status: 'active', customer_id: 'cus_123' },
      }

      expect(isTransactionEvent(event)).toBe(false)
    })
  })

  describe('getPaddleCheckoutSettings()', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        PADDLE_API_KEY: 'test-api-key',
        PADDLE_WEBHOOK_SECRET: 'test-webhook-secret',
        PADDLE_PRICE_ID: 'pri_test_123',
        NEXT_PUBLIC_PADDLE_ENVIRONMENT: 'sandbox',
      }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should return checkout settings with user data', () => {
      const settings = getPaddleCheckoutSettings('user-123', 'user@example.com')

      expect(settings).toMatchObject({
        priceId: 'pri_test_123',
        customData: {
          user_id: 'user-123',
        },
        customer: {
          email: 'user@example.com',
        },
      })
    })
  })
})

describe('paddle subscription functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('linkPaddleSubscription()', () => {
    it('should update subscription with Paddle IDs', async () => {
      const { linkPaddleSubscription } = await import('@/lib/subscription')

      vi.mocked(prisma.subscription.update).mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
        paddleCustomerId: 'cus_123',
        paddleSubscriptionId: 'sub_paddle_123',
        paddlePriceId: 'pri_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await linkPaddleSubscription('user-1', 'cus_123', 'sub_paddle_123', 'pri_123')

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          paddleCustomerId: 'cus_123',
          paddleSubscriptionId: 'sub_paddle_123',
          paddlePriceId: 'pri_123',
        },
      })
    })
  })

  describe('findSubscriptionByPaddleId()', () => {
    it('should find subscription by Paddle subscription ID', async () => {
      const { findSubscriptionByPaddleId } = await import('@/lib/subscription')

      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        canceledAt: null,
        paddleCustomerId: 'cus_123',
        paddleSubscriptionId: 'sub_paddle_123',
        paddlePriceId: 'pri_123',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'user-1', email: 'test@example.com' },
      }

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(mockSubscription)

      const result = await findSubscriptionByPaddleId('sub_paddle_123')

      expect(result).toEqual(mockSubscription)
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { paddleSubscriptionId: 'sub_paddle_123' },
        include: { user: { select: { id: true, email: true } } },
      })
    })

    it('should return null when not found', async () => {
      const { findSubscriptionByPaddleId } = await import('@/lib/subscription')

      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

      const result = await findSubscriptionByPaddleId('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateSubscriptionPeriod()', () => {
    it('should update subscription period dates', async () => {
      const { updateSubscriptionPeriod } = await import('@/lib/subscription')

      const periodStart = new Date('2024-01-01')
      const periodEnd = new Date('2024-02-01')

      vi.mocked(prisma.subscription.update).mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: new Date(),
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        paddlePriceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await updateSubscriptionPeriod('user-1', periodStart, periodEnd)

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      })
    })
  })
})
