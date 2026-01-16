import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/cron/subscriptions/route'

// Mock the subscription module
vi.mock('@/lib/subscription', () => ({
  processExpiredSubscriptions: vi.fn(),
}))

// Mock the server logger
vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { processExpiredSubscriptions } from '@/lib/subscription'
import { serverLogger } from '@/lib/server-logger'

const mockProcessExpiredSubscriptions = processExpiredSubscriptions as ReturnType<typeof vi.fn>
const mockServerLogger = serverLogger as {
  info: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function createRequest(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('authorization', authHeader)
  }
  return new NextRequest('http://localhost:3000/api/cron/subscriptions', {
    method: 'GET',
    headers,
  })
}

describe('GET /api/cron/subscriptions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Authorization', () => {
    it('returns 401 when CRON_SECRET is set but authorization header is missing', async () => {
      process.env.CRON_SECRET = 'test-secret'
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
      expect(mockServerLogger.warn).toHaveBeenCalledWith('Cron subscription expiration: unauthorized access attempt', {
        action: 'cron.subscriptions',
      })
    })

    it('returns 401 when CRON_SECRET is set but authorization header is wrong', async () => {
      process.env.CRON_SECRET = 'test-secret'
      const request = createRequest('Bearer wrong-secret')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('allows access when CRON_SECRET matches authorization header', async () => {
      process.env.CRON_SECRET = 'test-secret'
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(0)
      const request = createRequest('Bearer test-secret')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('allows access when CRON_SECRET is not set (development mode)', async () => {
      delete process.env.CRON_SECRET
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(0)
      const request = createRequest()

      const response = await GET(request)

      expect(response.status).toBe(200)
    })
  })

  describe('Success path', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET // Allow unauthenticated access for tests
    })

    it('returns 200 with success response when no subscriptions expired', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(0)
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.expiredCount).toBe(0)
      expect(data.timestamp).toBeDefined()
    })

    it('returns 200 with expired count when subscriptions are expired', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(5)
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.expiredCount).toBe(5)
    })

    it('logs success with expired count', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(3)
      const request = createRequest()

      await GET(request)

      expect(mockServerLogger.info).toHaveBeenCalledWith('Cron subscription expiration completed', {
        action: 'cron.subscriptions',
        expiredCount: 3,
      })
    })

    it('timestamp is valid ISO 8601 format', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(0)
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      const timestamp = new Date(data.timestamp)
      expect(timestamp.toISOString()).toBe(data.timestamp)
      expect(timestamp.getTime()).not.toBeNaN()
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET
    })

    it('returns 500 when processExpiredSubscriptions throws', async () => {
      mockProcessExpiredSubscriptions.mockRejectedValueOnce(new Error('Database error'))
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to process expired subscriptions')
    })

    it('logs error when processing fails', async () => {
      const testError = new Error('Database connection failed')
      mockProcessExpiredSubscriptions.mockRejectedValueOnce(testError)
      const request = createRequest()

      await GET(request)

      expect(mockServerLogger.error).toHaveBeenCalledWith(
        'Cron subscription expiration failed',
        { action: 'cron.subscriptions' },
        testError,
      )
    })

    it('does not expose internal error details in response', async () => {
      mockProcessExpiredSubscriptions.mockRejectedValueOnce(
        new Error('FATAL: password authentication failed for user "postgres"'),
      )
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(data.error).toBe('Failed to process expired subscriptions')
      expect(data.error).not.toContain('password')
      expect(data.error).not.toContain('postgres')
    })
  })

  describe('Integration with processExpiredSubscriptions', () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET
    })

    it('calls processExpiredSubscriptions exactly once', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(0)
      const request = createRequest()

      await GET(request)

      expect(mockProcessExpiredSubscriptions).toHaveBeenCalledTimes(1)
    })

    it('handles large number of expired subscriptions', async () => {
      mockProcessExpiredSubscriptions.mockResolvedValueOnce(10000)
      const request = createRequest()

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.expiredCount).toBe(10000)
    })
  })
})
