import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'

describe('Prisma Query Monitor', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should execute queries without monitoring when disabled', async () => {
    process.env.QUERY_MONITORING_ENABLED = 'false'
    const consoleWarnSpy = vi.spyOn(console, 'warn')

    // Execute a simple query
    await prisma.account.findMany()

    // Should not log anything
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('SLOW_QUERY')
    )

    consoleWarnSpy.mockRestore()
  })

  it('should log queries that exceed the threshold', async () => {
    process.env.QUERY_MONITORING_ENABLED = 'true'
    process.env.SLOW_QUERY_THRESHOLD_MS = '0' // All queries are slow
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Execute a query
    await prisma.account.findMany()

    // Should log slow query
    const calls = consoleWarnSpy.mock.calls
    const slowQueryCalls = calls.filter(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('SLOW_QUERY'))
    )

    expect(slowQueryCalls.length).toBeGreaterThan(0)

    consoleWarnSpy.mockRestore()
  })

  it('should not log queries under the threshold', async () => {
    process.env.QUERY_MONITORING_ENABLED = 'true'
    process.env.SLOW_QUERY_THRESHOLD_MS = '10000' // Very high threshold
    const consoleWarnSpy = vi.spyOn(console, 'warn')

    // Execute a simple query (should be fast)
    await prisma.account.findMany()

    // Should not log slow query
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('SLOW_QUERY')
    )

    consoleWarnSpy.mockRestore()
  })

  it('should log errors with query information', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Execute a query that will fail
    await expect(
      prisma.$queryRaw`SELECT * FROM nonexistent_table`
    ).rejects.toThrow()

    // Should log query error
    const calls = consoleErrorSpy.mock.calls
    const errorCalls = calls.filter(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('QUERY_ERROR'))
    )

    expect(errorCalls.length).toBeGreaterThan(0)

    consoleErrorSpy.mockRestore()
  })
})
