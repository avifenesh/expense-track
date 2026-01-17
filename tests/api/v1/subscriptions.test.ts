import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SubscriptionStatus } from '@prisma/client'

// Mock dependencies
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/subscription', () => ({
  getSubscriptionState: vi.fn(),
  SUBSCRIPTION_PRICE_CENTS: 500,
  TRIAL_DURATION_DAYS: 14,
}))

vi.mock('@/lib/paddle', () => ({
  getPaddleCheckoutSettings: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn(),
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

import { GET } from '@/app/api/v1/subscriptions/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { getSubscriptionState } from '@/lib/subscription'
import { getPaddleCheckoutSettings } from '@/lib/paddle'
import { prisma } from '@/lib/prisma'

describe('GET /api/v1/subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if not authenticated', async () => {
    vi.mocked(requireJwtAuth).mockImplementation(() => {
      throw new Error('Unauthorized')
    })

    const request = new NextRequest('http://localhost/api/v1/subscriptions')
    const response = await GET(request)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('should return subscription state for authenticated user', async () => {
    vi.mocked(requireJwtAuth).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
    })

    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: SubscriptionStatus.TRIALING,
      isActive: true,
      canAccessApp: true,
      trialEndsAt: new Date('2024-02-01'),
      daysRemaining: 14,
      currentPeriodEnd: null,
    })

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      userId: 'user-123',
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date('2024-02-01'),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      canceledAt: null,
      paddleCustomerId: null,
      paddleSubscriptionId: null,
      paddlePriceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(getPaddleCheckoutSettings).mockReturnValue({
      priceId: 'pri_test_123',
      customData: { user_id: 'user-123' },
      customer: { email: 'test@example.com' },
    })

    const request = new NextRequest('http://localhost/api/v1/subscriptions')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data).toMatchObject({
      subscription: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: expect.any(String),
        daysRemaining: 14,
      },
      pricing: {
        monthlyPriceCents: 500,
        trialDays: 14,
        currency: 'USD',
      },
      checkout: {
        priceId: 'pri_test_123',
      },
    })
  })

  it('should handle Paddle not configured', async () => {
    vi.mocked(requireJwtAuth).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
    })

    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: SubscriptionStatus.TRIALING,
      isActive: true,
      canAccessApp: true,
      trialEndsAt: new Date('2024-02-01'),
      daysRemaining: 14,
      currentPeriodEnd: null,
    })

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)

    vi.mocked(getPaddleCheckoutSettings).mockImplementation(() => {
      throw new Error('PADDLE_PRICE_ID not configured')
    })

    const request = new NextRequest('http://localhost/api/v1/subscriptions')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.checkout).toBeNull()
  })

  it('should include Paddle subscription IDs when available', async () => {
    vi.mocked(requireJwtAuth).mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
    })

    vi.mocked(getSubscriptionState).mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      isActive: true,
      canAccessApp: true,
      trialEndsAt: null,
      daysRemaining: null,
      currentPeriodEnd: new Date('2024-03-01'),
    })

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      id: 'sub-1',
      userId: 'user-123',
      status: SubscriptionStatus.ACTIVE,
      trialEndsAt: new Date('2024-01-15'), // Trial ended before activation
      currentPeriodStart: new Date('2024-02-01'),
      currentPeriodEnd: new Date('2024-03-01'),
      canceledAt: null,
      paddleCustomerId: 'ctm_123',
      paddleSubscriptionId: 'sub_456',
      paddlePriceId: 'pri_789',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    vi.mocked(getPaddleCheckoutSettings).mockReturnValue({
      priceId: 'pri_test_123',
      customData: { user_id: 'user-123' },
      customer: { email: 'test@example.com' },
    })

    const request = new NextRequest('http://localhost/api/v1/subscriptions')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.subscription.paddleCustomerId).toBe('ctm_123')
    expect(body.data.subscription.paddleSubscriptionId).toBe('sub_456')
  })
})
