import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/health/route'
import { prisma } from '@/lib/prisma'

// Mock prisma.$queryRaw
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

// Get the mocked function
const mockQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Success path', () => {
    it('returns 200 with healthy status when database is reachable', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.database.status).toBe('up')
      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('response includes all required fields', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('checks')
      expect(data).toHaveProperty('uptime')
      expect(data.checks).toHaveProperty('database')
    })

    it('database check has "up" status with response time', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      expect(data.checks.database.status).toBe('up')
      expect(typeof data.checks.database.responseTime).toBe('number')
      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('response time is a non-negative number', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(data.checks.database.responseTime)).toBe(true)
    })
  })

  describe('Failure path', () => {
    it('returns 503 with unhealthy status when database is unreachable', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('Connection refused'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.database.status).toBe('down')
    })

    it('database check has "down" status with error message', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('Connection timeout'))

      const response = await GET()
      const data = await response.json()

      expect(data.checks.database.status).toBe('down')
      expect(data.checks.database.error).toBe('Database connection failed')
    })

    it('error message is sanitized (no stack traces)', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('ECONNREFUSED: connection refused at host:5432'))

      const response = await GET()
      const data = await response.json()

      // Error message should be generic, not exposing internals
      expect(data.checks.database.error).toBe('Database connection failed')
      expect(data.checks.database.error).not.toContain('ECONNREFUSED')
      expect(data.checks.database.error).not.toContain('5432')
      expect(data.checks.database.error).not.toContain('host')
    })
  })

  describe('Edge cases', () => {
    it.each([
      { case: 'success', mock: () => mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]) },
      {
        case: 'failure',
        mock: () => mockQueryRaw.mockRejectedValueOnce(new Error('Connection failed')),
      },
    ])('response time is measured on $case', async ({ mock }) => {
      mock()
      const response = await GET()
      const data = await response.json()
      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0)
    })

    it('timestamp is valid ISO 8601 format', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      // Verify ISO 8601 format
      const timestamp = new Date(data.timestamp)
      expect(timestamp.toISOString()).toBe(data.timestamp)
      expect(timestamp.getTime()).not.toBeNaN()
    })

    it('uptime is a positive number', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await GET()
      const data = await response.json()

      expect(typeof data.uptime).toBe('number')
      expect(data.uptime).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(data.uptime)).toBe(true)
    })
  })
})
