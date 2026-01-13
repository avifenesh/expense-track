'use client'

import { useEffect, useState } from 'react'

/**
 * Client-side hook to fetch and manage CSRF token.
 * Fetches token from /api/csrf endpoint on mount.
 */
export function useCsrfToken(): string {
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    fetch('/api/csrf')
      .then((res) => res.json())
      .then((data) => setToken(data.token))
      .catch((err) => {
        // Silent fail - server actions will return validation error if token missing
        console.error('Failed to fetch CSRF token', err)
      })
  }, [])

  return token
}
