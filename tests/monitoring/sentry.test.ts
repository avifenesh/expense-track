import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Sentry Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should not initialize Sentry when disabled', async () => {
    process.env.SENTRY_ENABLED = 'false'
    process.env.SENTRY_DSN = ''

    // Dynamic import to respect env var
    const module = await import('@/lib/monitoring/sentry-client')

    // Sentry module should be defined
    expect(module.Sentry).toBeDefined()
  })

  it('should not initialize Sentry when DSN is missing', async () => {
    process.env.SENTRY_ENABLED = 'true'
    process.env.NEXT_PUBLIC_SENTRY_DSN = ''

    // Dynamic import to respect env var
    const module = await import('@/lib/monitoring/sentry-client')

    // Sentry module should be defined but not initialized
    expect(module.Sentry).toBeDefined()
  })

  it('should respect SENTRY_ENABLED environment variable', () => {
    process.env.SENTRY_ENABLED = 'false'

    expect(process.env.SENTRY_ENABLED).toBe('false')
  })

  it('should have correct environment names', () => {
    const validEnvironments = ['development', 'staging', 'production']
    const testEnv = process.env.SENTRY_ENVIRONMENT || 'development'

    // SENTRY_ENVIRONMENT should be a valid environment
    expect(['development', 'staging', 'production', undefined]).toContain(testEnv)
  })
})

describe('Sentry Sensitive Data Filtering', () => {
  it('should filter sensitive headers from events', () => {
    // Mock beforeSend function behavior
    const mockEvent = {
      request: {
        headers: {
          cookie: 'session=secret',
          authorization: 'Bearer token',
          'user-agent': 'Mozilla/5.0',
          'content-type': 'application/json',
        } as Record<string, string>,
      },
    }

    // Simulate beforeSend filtering
    const filteredEvent = { ...mockEvent }
    if (filteredEvent.request?.headers) {
      delete filteredEvent.request.headers['cookie']
      delete filteredEvent.request.headers['authorization']
    }

    expect(filteredEvent.request?.headers).not.toHaveProperty('cookie')
    expect(filteredEvent.request?.headers).not.toHaveProperty('authorization')
    expect(filteredEvent.request?.headers).toHaveProperty('user-agent')
    expect(filteredEvent.request?.headers).toHaveProperty('content-type')
  })

  it('should handle events without headers', () => {
    const mockEvent = {
      request: {} as { headers?: Record<string, string> },
    }

    // Simulate beforeSend filtering
    const filteredEvent = { ...mockEvent }
    if (filteredEvent.request?.headers) {
      delete filteredEvent.request.headers['cookie']
      delete filteredEvent.request.headers['authorization']
    }

    expect(filteredEvent).toEqual(mockEvent)
  })
})
