'use client'

import { useState, useCallback } from 'react'

export type Feedback = { type: 'success' | 'error'; message: string }

export function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const showSuccess = useCallback((message: string) => {
    setFeedback({ type: 'success', message })
  }, [])

  const showError = useCallback((message: string) => {
    setFeedback({ type: 'error', message })
  }, [])

  const clear = useCallback(() => {
    setFeedback(null)
  }, [])

  return { feedback, showSuccess, showError, clear }
}
