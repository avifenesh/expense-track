'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/useToast'

// Paddle.js type declarations
declare global {
  interface Window {
    Paddle?: {
      Environment: {
        set: (env: 'sandbox' | 'production') => void
      }
      Initialize: (config: { token: string }) => void
      Checkout: {
        open: (options: PaddleCheckoutOptions) => void
      }
    }
  }
}

interface PaddleCheckoutOptions {
  items: Array<{
    priceId: string
    quantity: number
  }>
  customData?: Record<string, string>
  customer?: {
    email: string
  }
  successUrl?: string
  settings?: {
    displayMode?: 'overlay' | 'inline'
    theme?: 'light' | 'dark'
    locale?: string
  }
}

interface UpgradeClientProps {
  userId: string
  userEmail: string
  priceId: string | null
  subscriptionState: {
    status: string
    isActive: boolean
    trialEndsAt: string | null
    daysRemaining: number | null
  }
}

export function UpgradeClient({ userId, userEmail, priceId, subscriptionState }: UpgradeClientProps) {
  const router = useRouter()
  const [isPaddleReady, setIsPaddleReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load Paddle.js
  useEffect(() => {
    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
    const environment = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'

    if (!clientToken) {
      // Paddle not configured - checkout not available
      return
    }

    // Check if already loaded
    if (window.Paddle) {
      window.Paddle.Environment.set(environment)
      window.Paddle.Initialize({ token: clientToken })
      setIsPaddleReady(true)
      return
    }

    // Load Paddle.js script
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    script.onload = () => {
      if (window.Paddle) {
        window.Paddle.Environment.set(environment)
        window.Paddle.Initialize({ token: clientToken })
        setIsPaddleReady(true)
      }
    }
    script.onerror = () => {
      toast.error('Failed to load payment system')
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]')
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [])

  const handleUpgrade = () => {
    if (!isPaddleReady || !window.Paddle) {
      toast.error('Payment system not ready. Please try again.')
      return
    }

    if (!priceId) {
      toast.error('Subscription not configured. Please contact support.')
      return
    }

    setIsLoading(true)

    try {
      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: {
          user_id: userId,
        },
        customer: {
          email: userEmail,
        },
        successUrl: `${window.location.origin}/upgrade/success`,
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          locale: 'en',
        },
      })
    } catch {
      toast.error('Failed to open checkout. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTrialEnd = (isoDate: string | null) => {
    if (!isoDate) return null
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Upgrade to Pro</h1>
          <p className="mt-2 text-slate-400">Unlock all features and keep tracking your finances</p>
        </div>

        {subscriptionState.status === 'TRIALING' && subscriptionState.daysRemaining !== null && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
            <p className="text-amber-300">
              {subscriptionState.daysRemaining > 0 ? (
                <>
                  Your trial ends in <strong>{subscriptionState.daysRemaining} days</strong>
                  {subscriptionState.trialEndsAt && (
                    <span className="block text-sm text-amber-400/80 mt-1">
                      ({formatTrialEnd(subscriptionState.trialEndsAt)})
                    </span>
                  )}
                </>
              ) : (
                <>Your trial has ended</>
              )}
            </p>
          </div>
        )}

        {subscriptionState.status === 'EXPIRED' && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4 text-center">
            <p className="text-rose-300">
              Your subscription has expired. Upgrade to continue using Balance Beacon.
            </p>
          </div>
        )}

        <Card className="border-white/15 bg-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-white">Pro Plan</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold text-white">$5</span>
              <span className="text-slate-400">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-center gap-2">
                <CheckIcon />
                Unlimited transactions
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                Budget tracking & alerts
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                Multi-currency support
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                Expense sharing
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                Investment tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon />
                Priority support
              </li>
            </ul>

            <Button
              onClick={handleUpgrade}
              disabled={!isPaddleReady || isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3"
              size="lg"
            >
              {isLoading ? 'Opening checkout...' : isPaddleReady ? 'Subscribe Now' : 'Loading...'}
            </Button>

            <p className="text-center text-xs text-slate-500">
              Cancel anytime. Secure payment via Paddle.
            </p>
          </CardContent>
        </Card>

        {subscriptionState.status !== 'EXPIRED' && (
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="w-full text-slate-400 hover:text-white"
          >
            Continue with trial
          </Button>
        )}
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 text-emerald-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
