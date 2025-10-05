import { describe, expect, it } from 'vitest'
import { AUTH_USER, RECOVERY_CONTACTS } from '@/lib/auth'
import { verifyCredentials } from '@/lib/auth-server'
import { requestPasswordResetAction } from '@/app/actions'

describe('auth credential verification', () => {
  it('accepts the steward credentials', async () => {
    const result = await verifyCredentials({ username: AUTH_USER.username, password: 'Balance2025!' })
    expect(result).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const result = await verifyCredentials({ username: AUTH_USER.username, password: 'wrong-pass' })
    expect(result).toBe(false)
  })

  it('rejects an unexpected username', async () => {
    const result = await verifyCredentials({ username: 'unauthorized', password: 'Balance2025!' })
    expect(result).toBe(false)
  })
})

describe('password reset action', () => {
  it('returns a friendly confirmation for known inboxes', async () => {
    const target = RECOVERY_CONTACTS[0]
    const response = await requestPasswordResetAction({ email: target.email })
    expect(response).toEqual({
      success: true,
      message: expect.stringContaining(target.email),
    })
  })

  it('flags unknown inboxes', async () => {
    const response = await requestPasswordResetAction({ email: 'unknown@example.com' })
    expect(response).toEqual({
      error: {
        email: ['Email is not registered. Reach out to the finance team to restore access.'],
      },
    })
  })
})
