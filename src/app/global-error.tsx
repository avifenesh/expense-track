'use client'

import { useEffect } from 'react'
import { Sentry } from '@/lib/monitoring/sentry-client'

export default function GlobalError({
  error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Don't report server action mismatch errors - they're expected during deployments
    const isDeploymentError = error.message?.includes('Failed to find Server Action')

    if (!isDeploymentError) {
      Sentry.captureException(error)
    }
  }, [error])

  // Check if this is a deployment-related error
  const isDeploymentError = error.message?.includes('Failed to find Server Action')

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg">
            {isDeploymentError ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  App Updated
                </h2>
                <p className="text-sm text-gray-600">
                  A new version has been deployed. Please refresh to continue.
                </p>
              </>
            ) : (
              <>
                <h2 className="mb-2 text-lg font-semibold text-red-900">
                  Something went wrong
                </h2>
                <p className="text-sm text-red-700">
                  An unexpected error occurred. Our team has been notified.
                </p>
              </>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
