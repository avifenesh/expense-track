import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serverLogger } from '@/lib/server-logger'

describe('serverLogger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('error logging', () => {
    it('logs error messages', () => {
      serverLogger.error('Test error', { action: 'testAction' })

      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('includes context in log output', () => {
      serverLogger.error('Test error', { action: 'testAction', userId: 'user-123' })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      expect(call[0]).toContain('Test error')
    })

    it('includes error details when provided', () => {
      const error = new Error('Something went wrong')
      serverLogger.error('Test error', { action: 'testAction' }, error)

      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('warn logging', () => {
    it('logs warning messages', () => {
      serverLogger.warn('Test warning', { action: 'testAction' })

      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('info logging', () => {
    it('logs info messages', () => {
      serverLogger.info('Test info', { action: 'testAction' })

      expect(consoleInfoSpy).toHaveBeenCalled()
    })
  })

  describe('input sanitization', () => {
    it('redacts password fields', () => {
      serverLogger.error('Test', {
        action: 'login',
        input: { email: 'test@example.com', password: 'secret123' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { password: string } }
      expect(logData.input.password).toBe('[REDACTED]')
    })

    it('redacts token fields', () => {
      serverLogger.error('Test', {
        action: 'auth',
        input: { accessToken: 'jwt-token-here' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { accessToken: string } }
      expect(logData.input.accessToken).toBe('[REDACTED]')
    })

    it('redacts csrfToken fields', () => {
      serverLogger.error('Test', {
        action: 'createTransaction',
        input: { amount: 100, csrfToken: 'csrf-secret' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { csrfToken: string; amount: number } }
      expect(logData.input.csrfToken).toBe('[REDACTED]')
      expect(logData.input.amount).toBe(100)
    })

    it('redacts secret fields', () => {
      serverLogger.error('Test', {
        action: 'config',
        input: { appSecret: 'my-secret-key' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { appSecret: string } }
      expect(logData.input.appSecret).toBe('[REDACTED]')
    })

    it('redacts apiKey fields', () => {
      serverLogger.error('Test', {
        action: 'apiCall',
        input: { apiKey: 'key-12345' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { apiKey: string } }
      expect(logData.input.apiKey).toBe('[REDACTED]')
    })

    it('redacts authorization fields', () => {
      serverLogger.error('Test', {
        action: 'request',
        input: { authorization: 'Bearer token123' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { authorization: string } }
      expect(logData.input.authorization).toBe('[REDACTED]')
    })

    it('handles nested objects with sensitive data', () => {
      serverLogger.error('Test', {
        action: 'nestedTest',
        input: {
          user: {
            email: 'test@example.com',
            password: 'secret123',
          },
        },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { user: { email: string; password: string } } }
      expect(logData.input.user.email).toBe('test@example.com')
      expect(logData.input.user.password).toBe('[REDACTED]')
    })

    it('preserves non-sensitive fields', () => {
      serverLogger.error('Test', {
        action: 'createTransaction',
        input: { amount: 100, description: 'Test transaction', currency: 'USD' },
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      const call = consoleErrorSpy.mock.calls[0]
      const logData = call[1] as { input: { amount: number; description: string; currency: string } }
      expect(logData.input.amount).toBe(100)
      expect(logData.input.description).toBe('Test transaction')
      expect(logData.input.currency).toBe('USD')
    })

    it('handles null input gracefully', () => {
      serverLogger.error('Test', {
        action: 'testAction',
        input: undefined,
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })
})
