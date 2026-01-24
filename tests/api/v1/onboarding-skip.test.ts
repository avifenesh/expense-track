import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as SkipOnboarding } from '@/app/api/v1/onboarding/skip/route'
import { generateAccessToken } from '@/lib/jwt'
import { resetEnvCache } from '@/lib/env-schema'
import { prisma } from '@/lib/prisma'
import { getApiTestUser, TEST_USER_ID } from './helpers'

describe('POST /api/v1/onboarding/skip', () => {
  let validToken: string

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing!'
    resetEnvCache()
    validToken = generateAccessToken(TEST_USER_ID, 'api-test@example.com')

    await getApiTestUser()

    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { hasCompletedOnboarding: false },
    })
  })

  afterEach(async () => {
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { hasCompletedOnboarding: false },
    })
  })

  it('marks onboarding as skipped with valid JWT', async () => {
    const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await SkipOnboarding(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.hasCompletedOnboarding).toBe(true)

    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { hasCompletedOnboarding: true },
    })

    expect(user?.hasCompletedOnboarding).toBe(true)
  })

  it('is idempotent - can be called multiple times', async () => {
    const request1 = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response1 = await SkipOnboarding(request1)
    expect(response1.status).toBe(200)

    const request2 = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response2 = await SkipOnboarding(request2)
    const data2 = await response2.json()

    expect(response2.status).toBe(200)
    expect(data2.data.hasCompletedOnboarding).toBe(true)

    const user = await prisma.user.findUnique({
      where: { id: TEST_USER_ID },
      select: { hasCompletedOnboarding: true },
    })

    expect(user?.hasCompletedOnboarding).toBe(true)
  })

  it('returns 401 with missing Authorization header', async () => {
    const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await SkipOnboarding(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
    })

    const response = await SkipOnboarding(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header', async () => {
    const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: 'InvalidFormat',
        'Content-Type': 'application/json',
      },
    })

    const response = await SkipOnboarding(request)
    expect(response.status).toBe(401)
  })

  it('works without active subscription (onboarding flow)', async () => {
    await prisma.subscription.update({
      where: { userId: TEST_USER_ID },
      data: { status: 'EXPIRED' },
    })

    try {
      const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validToken}`,
          'Content-Type': 'application/json',
        },
      })

      const response = await SkipOnboarding(request)
      expect(response.status).toBe(200)
    } finally {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      await prisma.subscription.update({
        where: { userId: TEST_USER_ID },
        data: { status: 'TRIALING', trialEndsAt },
      })
    }
  })

  it('does not require request body', async () => {
    const request = new NextRequest('http://localhost/api/v1/onboarding/skip', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
    })

    const response = await SkipOnboarding(request)
    expect(response.status).toBe(200)
  })
})
