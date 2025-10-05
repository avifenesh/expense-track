import { describe, expect, it } from 'vitest'
import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import { verifyCredentials } from '@/lib/auth-server'
import { requestPasswordResetAction } from '@/app/actions'

describe('auth credential verification', () => {
  it('accepts each household credential', async () => {
    await Promise.all(
      AUTH_USERS.map(async (user) => {
        const password = user.id === 'avi' ? 'Af!@#$56789' : 'A76v38i61_7'
        const result = await verifyCredentials({ email: user.email, password })
        expect(result).toBe(true)
      }),
    )
  })

  it('rejects a wrong password', async () => {
    const user = AUTH_USERS[0]
    const result = await verifyCredentials({ email: user.email, password: 'wrong-pass' })
    expect(result).toBe(false)
  })

  it('rejects an unexpected email', async () => {
    const result = await verifyCredentials({ email: 'unauthorized@example.com', password: 'Af!@#$56789' })
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
