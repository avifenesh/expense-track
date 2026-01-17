import { redirect } from 'next/navigation'
import { getDbUserAsAuthUser, getSession } from '@/lib/auth-server'
import { getSubscriptionState } from '@/lib/subscription'
import { getPaddleCheckoutSettings } from '@/lib/paddle'
import { UpgradeClient } from './upgrade-client'

export const metadata = {
  title: 'Upgrade to Pro | Balance Beacon',
  description: 'Upgrade your Balance Beacon subscription to unlock all features.',
}

export default async function UpgradePage() {
  // Check authentication
  const session = await getSession()
  if (!session) {
    redirect('/login?redirect=/upgrade')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    redirect('/login?redirect=/upgrade')
  }

  // Get subscription state
  const subscriptionState = await getSubscriptionState(authUser.id)

  // If already active (not trialing), redirect to dashboard
  if (subscriptionState.status === 'ACTIVE') {
    redirect('/')
  }

  // Get Paddle checkout settings (server-side)
  let priceId: string | null = null
  try {
    const checkoutSettings = getPaddleCheckoutSettings(authUser.id, authUser.email)
    priceId = checkoutSettings.priceId
  } catch {
    // Paddle not configured - checkout will show error
  }

  return (
    <UpgradeClient
      userId={authUser.id}
      userEmail={authUser.email}
      priceId={priceId}
      subscriptionState={{
        status: subscriptionState.status,
        isActive: subscriptionState.isActive,
        trialEndsAt: subscriptionState.trialEndsAt?.toISOString() || null,
        daysRemaining: subscriptionState.daysRemaining,
      }}
    />
  )
}
