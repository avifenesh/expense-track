import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getDbUserAsAuthUser, getSession } from '@/lib/auth-server'
import { getSubscriptionState } from '@/lib/subscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = {
  title: 'Subscription Activated | Balance Beacon',
  description: 'Your Balance Beacon subscription has been activated.',
}

export default async function UpgradeSuccessPage() {
  // Check authentication
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    redirect('/login')
  }

  // Get subscription state to confirm activation
  const subscriptionState = await getSubscriptionState(authUser.id)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-white/15 bg-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <svg
              className="h-8 w-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <CardTitle className="text-2xl text-white">
            {subscriptionState.status === 'ACTIVE' ? 'Welcome to Pro!' : 'Payment Processing'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          {subscriptionState.status === 'ACTIVE' ? (
            <>
              <p className="text-slate-300">
                Your subscription is now active. Thank you for supporting Balance Beacon!
              </p>
              {subscriptionState.currentPeriodEnd && (
                <div className="rounded-lg bg-white/5 p-4 text-sm text-slate-400">
                  <p>
                    Your subscription renews on{' '}
                    <strong className="text-white">
                      {subscriptionState.currentPeriodEnd.toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </strong>
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-300">
              Your payment is being processed. This usually takes a few seconds. If your subscription
              doesn&apos;t activate within a minute, please refresh this page or contact support.
            </p>
          )}

          <Link
            href="/"
            className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            Go to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
