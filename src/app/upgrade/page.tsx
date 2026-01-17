import { redirect } from 'next/navigation'
import { getDbUserAsAuthUser, requireSession } from '@/lib/auth-server'
import { getSubscriptionState } from '@/lib/subscription'
import { UpgradeClient } from './upgrade-client'

export const metadata = {
  title: 'Upgrade to Pro | Balance Beacon',
  description: 'Upgrade your Balance Beacon subscription to unlock all features.',
}

export default async function UpgradePage() {
  // Check authentication
  const session = await requireSession()
  if (!session) {
    redirect('/login?redirect=/upgrade')
  }

  const authUser = await getDbUserAsAuthUser()
  if (!authUser) {
    redirect('/login?redirect=/upgrade')
  }

  // Get subscription state
  const subscriptionState = await getSubscriptionState(authUser.id)

  // If already active (not trialing), redirect to dashboard
  if (subscriptionState.status === 'ACTIVE') {
    redirect('/')
  }

  return (
    <UpgradeClient
      userId={authUser.id}
      userEmail={authUser.email}
      subscriptionState={{
        status: subscriptionState.status,
        isActive: subscriptionState.isActive,
        trialEndsAt: subscriptionState.trialEndsAt?.toISOString() || null,
        daysRemaining: subscriptionState.daysRemaining,
      }}
    />
  )
}
