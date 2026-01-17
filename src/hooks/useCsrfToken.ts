'use client'

import { useEffect, useState } from 'react'
import { toast } from '@/hooks/useToast'

type CsrfTokenState = {
  token: string
  isLoading: boolean
  error: Error | null
}

/**
 * Client-side hook to fetch and manage CSRF token.
 * Fetches token from /api/csrf endpoint on mount.
 * Returns token string for backward compatibility, but also exposes loading/error state.
 */
export function useCsrfToken(): string {
  const [state, setState] = useState<CsrfTokenState>({
    token: '',
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    fetch('/api/csrf')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch CSRF token: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setState({ token: data.token, isLoading: false, error: null })
        }
      })
      .catch((err) => {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error('Failed to load security token')
          setState({ token: '', isLoading: false, error })
          toast.error('Failed to load security token. Please refresh the page.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return state.token
}

/**
 * Extended hook that returns full state including loading and error.
 * Use this when you need to show loading states or handle errors explicitly.
 */
export function useCsrfTokenWithState(): CsrfTokenState {
  const [state, setState] = useState<CsrfTokenState>({
    token: '',
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let isMounted = true

    fetch('/api/csrf')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch CSRF token: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (isMounted) {
          setState({ token: data.token, isLoading: false, error: null })
        }
      })
      .catch((err) => {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error('Failed to load security token')
          setState({ token: '', isLoading: false, error })
          toast.error('Failed to load security token. Please refresh the page.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  return state
}
