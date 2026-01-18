import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SubscriptionStatus, Currency } from '@prisma/client'

// Mock dependencies before imports
vi.mock('@/lib/api-auth', () => ({
  requireJwtAuth: vi.fn(),
}))

vi.mock('@/lib/subscription', () => ({
  getSubscriptionState: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  incrementRateLimit: vi.fn(),
}))

vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

import { GET } from '@/app/api/v1/users/me/route'
import { requireJwtAuth } from '@/lib/api-auth'
import { getSubscriptionState } from '@/lib/subscription'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'

describe('GET /api/v1/users/me', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    preferredCurrency: Currency.USD,
    createdAt: new Date('2024-01-01'),
    hasCompletedOnboarding: true,
  }

  const mockSubscriptionState = {
    status: SubscriptionStatus.TRIALING,
    isActive: true,
    canAccessApp: true,
    trialEndsAt: new Date('2024-02-01'),
    currentPeriodEnd: null,
    daysRemaining: 14,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, resetAt: null })
  })

  describe('authentication', () => {
    it('should return 401 if not authenticated', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Unauthorized')
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
    })

    it('should return 401 with custom message when auth fails', async () => {
      vi.mocked(requireJwtAuth).mockImplementation(() => {
        throw new Error('Token expired')
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Token expired')
    })
  })

  describe('rate limiting', () => {
    it('should return 429 when rate limited', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      const resetAt = new Date(Date.now() + 60000)
      vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, resetAt })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(429)
    })
  })

  describe('user profile retrieval', () => {
    it('should return user profile with subscription for authenticated user', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue(mockSubscriptionState)

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        preferredCurrency: 'USD',
        hasCompletedOnboarding: true,
        subscription: {
          status: 'TRIALING',
          isActive: true,
          canAccessApp: true,
          daysRemaining: 14,
        },
      })
    })

    it('should return 401 when user not found in database', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('User not found')
    })
  })

  describe('subscription states', () => {
    it('should return user with TRIALING subscription', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue({
        status: SubscriptionStatus.TRIALING,
        isActive: true,
        canAccessApp: true,
        trialEndsAt: new Date('2024-02-01'),
        currentPeriodEnd: null,
        daysRemaining: 7,
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription.status).toBe('TRIALING')
      expect(body.data.subscription.isActive).toBe(true)
      expect(body.data.subscription.daysRemaining).toBe(7)
    })

    it('should return user with ACTIVE subscription', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue({
        status: SubscriptionStatus.ACTIVE,
        isActive: true,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: new Date('2024-03-01'),
        daysRemaining: 30,
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription.status).toBe('ACTIVE')
      expect(body.data.subscription.isActive).toBe(true)
      expect(body.data.subscription.currentPeriodEnd).toBeDefined()
    })

    it('should return user with EXPIRED subscription', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue({
        status: SubscriptionStatus.EXPIRED,
        isActive: false,
        canAccessApp: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysRemaining: null,
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription.status).toBe('EXPIRED')
      expect(body.data.subscription.isActive).toBe(false)
      expect(body.data.subscription.canAccessApp).toBe(false)
    })

    it('should return user with CANCELED subscription still having access', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue({
        status: SubscriptionStatus.CANCELED,
        isActive: true,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: new Date('2024-02-15'),
        daysRemaining: 10,
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription.status).toBe('CANCELED')
      expect(body.data.subscription.canAccessApp).toBe(true)
      expect(body.data.subscription.daysRemaining).toBe(10)
    })

    it('should return user with PAST_DUE subscription', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockResolvedValue({
        status: SubscriptionStatus.PAST_DUE,
        isActive: false,
        canAccessApp: true,
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysRemaining: null,
      })

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.subscription.status).toBe('PAST_DUE')
      expect(body.data.subscription.canAccessApp).toBe(true)
    })
  })

  describe('user data variations', () => {
    it('should return user with EUR currency', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        preferredCurrency: Currency.EUR,
      })
      vi.mocked(getSubscriptionState).mockResolvedValue(mockSubscriptionState)

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.preferredCurrency).toBe('EUR')
    })

    it('should return user with incomplete onboarding', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        hasCompletedOnboarding: false,
      })
      vi.mocked(getSubscriptionState).mockResolvedValue(mockSubscriptionState)

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.hasCompletedOnboarding).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should return 500 when database query fails', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Unable to fetch user profile')
    })

    it('should return 500 when subscription state fetch fails', async () => {
      vi.mocked(requireJwtAuth).mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(getSubscriptionState).mockRejectedValue(new Error('Subscription error'))

      const request = new NextRequest('http://localhost/api/v1/users/me')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.error).toBe('Unable to fetch user profile')
    })
  })
})
