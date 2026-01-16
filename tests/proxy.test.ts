import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock modules BEFORE importing proxy
vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-token'),
}))

vi.mock('@/lib/nonce', () => ({
  generateNonce: vi.fn(() => 'mock-nonce-123'),
}))

import { proxy } from '@/proxy'
import { getCsrfToken } from '@/lib/csrf'
import { generateNonce } from '@/lib/nonce'

describe('Proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementation
    vi.mocked(generateNonce).mockReturnValue('mock-nonce-123')
  })

  it('sets X-Frame-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets X-Content-Type-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets Referrer-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets Permissions-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
  })

  it('sets Content-Security-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('CSP includes api.frankfurter.app in connect-src', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain('api.frankfurter.app')
  })

  it('generates a nonce for each request', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    await proxy(request)

    expect(generateNonce).toHaveBeenCalledTimes(1)
  })

  it('includes nonce in CSP script-src directive', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)
    const csp = response.headers.get('Content-Security-Policy')

    expect(csp).toContain("'nonce-mock-nonce-123'")
    expect(csp).toContain("'strict-dynamic'")
  })

  it('includes nonce in CSP style-src directive', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)
    const csp = response.headers.get('Content-Security-Policy')

    expect(csp).toContain("'nonce-mock-nonce-123'")
  })

  it('includes unsafe-eval in development mode only', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await proxy(request)
    const csp = response.headers.get('Content-Security-Policy')

    expect(csp).toContain("'unsafe-eval'")

    vi.unstubAllEnvs()
  })

  it('excludes unsafe-eval in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await proxy(request)
    const csp = response.headers.get('Content-Security-Policy')

    expect(csp).not.toContain("'unsafe-eval'")

    vi.unstubAllEnvs()
  })

  it('includes unsafe-inline for styles in dev, excludes in production', async () => {
    // Development mode
    vi.stubEnv('NODE_ENV', 'development')
    const devRequest = new NextRequest(new URL('http://localhost:3000/'))
    const devResponse = await proxy(devRequest)
    const devCsp = devResponse.headers.get('Content-Security-Policy')

    const devStyleMatch = devCsp?.match(/style-src[^;]+/)
    expect(devStyleMatch?.[0]).toContain("'unsafe-inline'")

    // Production mode
    vi.stubEnv('NODE_ENV', 'production')
    const prodRequest = new NextRequest(new URL('http://localhost:3000/'))
    const prodResponse = await proxy(prodRequest)
    const prodCsp = prodResponse.headers.get('Content-Security-Policy')

    const prodStyleMatch = prodCsp?.match(/style-src[^;]+/)
    expect(prodStyleMatch?.[0]).not.toContain("'unsafe-inline'")

    vi.unstubAllEnvs()
  })

  it('does not include unsafe-inline in script-src', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await proxy(request)
    const csp = response.headers.get('Content-Security-Policy')

    // Should not have unsafe-inline for scripts in any mode
    const scriptSrcMatch = csp?.match(/script-src[^;]+/)
    expect(scriptSrcMatch?.[0]).not.toContain("'unsafe-inline'")
  })

  it('ensures CSRF token exists', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    await proxy(request)

    expect(getCsrfToken).toHaveBeenCalled()
  })

  it('sets Strict-Transport-Security in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await proxy(request)

    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')

    vi.unstubAllEnvs()
  })

  it('does not set Strict-Transport-Security in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await proxy(request)

    expect(response.headers.get('Strict-Transport-Security')).toBeNull()

    vi.unstubAllEnvs()
  })

  it('returns NextResponse that allows request to continue', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response).toBeInstanceOf(NextResponse)
  })

  it('stores nonce in x-nonce response header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await proxy(request)

    expect(response.headers.get('x-nonce')).toBe('mock-nonce-123')
  })
})
