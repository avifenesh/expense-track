'use client'

import { AlertCircle, Clock, CreditCard, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'

export type SubscriptionBannerData = {
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'
  daysRemaining: number | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
}

type SubscriptionBannerProps = {
  subscription: SubscriptionBannerData
  onUpgrade?: () => void
}

export function SubscriptionBanner({ subscription, onUpgrade }: SubscriptionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const { status, daysRemaining } = subscription

  // Don't show banner for active subscriptions with plenty of time
  if (status === 'ACTIVE' && daysRemaining !== null && daysRemaining > 7) {
    return null
  }

  // Allow dismissing trial/active banners but not expired/past_due
  if (isDismissed && (status === 'TRIALING' || status === 'ACTIVE')) {
    return null
  }

  const bannerConfig = getBannerConfig(status, daysRemaining)
  if (!bannerConfig) return null

  const { icon: Icon, title, message, variant, dismissable, showUpgrade } = bannerConfig

  return (
    <div
      role="alert"
      className={cn(
        'relative flex items-start gap-3 rounded-lg border p-4',
        variant === 'warning' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
        variant === 'error' && 'border-rose-500/30 bg-rose-500/10 text-rose-100',
        variant === 'info' && 'border-blue-500/30 bg-blue-500/10 text-blue-100',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 mt-0.5',
          variant === 'warning' && 'text-amber-400',
          variant === 'error' && 'text-rose-400',
          variant === 'info' && 'text-blue-400',
        )}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{message}</p>
        {showUpgrade && onUpgrade && (
          <Button
            type="button"
            variant="secondary"
            className={cn(
              'mt-3 h-8 text-xs font-medium',
              variant === 'warning' && 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100',
              variant === 'error' && 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-100',
              variant === 'info' && 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-100',
            )}
            onClick={onUpgrade}
          >
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Upgrade to Pro
          </Button>
        )}
      </div>
      {dismissable && (
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className={cn(
            'shrink-0 rounded p-1 transition hover:bg-white/10',
            variant === 'warning' && 'text-amber-300',
            variant === 'error' && 'text-rose-300',
            variant === 'info' && 'text-blue-300',
          )}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

type BannerConfig = {
  icon: typeof AlertCircle
  title: string
  message: string
  variant: 'warning' | 'error' | 'info'
  dismissable: boolean
  showUpgrade: boolean
}

function getBannerConfig(status: SubscriptionBannerData['status'], daysRemaining: number | null): BannerConfig | null {
  switch (status) {
    case 'TRIALING': {
      if (daysRemaining === null) return null
      if (daysRemaining <= 3) {
        return {
          icon: AlertCircle,
          title: `Trial ending in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
          message: 'Upgrade now to keep tracking your expenses without interruption.',
          variant: 'warning',
          dismissable: true,
          showUpgrade: true,
        }
      }
      if (daysRemaining <= 7) {
        return {
          icon: Clock,
          title: `${daysRemaining} days left in your trial`,
          message: 'Enjoying the app? Upgrade to continue after your trial ends.',
          variant: 'info',
          dismissable: true,
          showUpgrade: true,
        }
      }
      return null
    }

    case 'PAST_DUE':
      return {
        icon: AlertCircle,
        title: 'Payment failed',
        message: 'Please update your payment method to continue using the app.',
        variant: 'error',
        dismissable: false,
        showUpgrade: true,
      }

    case 'CANCELED':
      return {
        icon: Clock,
        title: 'Subscription canceled',
        message:
          daysRemaining !== null && daysRemaining > 0
            ? `You have access until the end of your billing period (${daysRemaining} days remaining).`
            : 'Your subscription has ended. Upgrade to regain access.',
        variant: 'warning',
        dismissable: true,
        showUpgrade: true,
      }

    case 'EXPIRED':
      return {
        icon: AlertCircle,
        title: 'Subscription expired',
        message: 'Upgrade to continue tracking your expenses.',
        variant: 'error',
        dismissable: false,
        showUpgrade: true,
      }

    case 'ACTIVE': {
      // Only show if period ending soon
      if (daysRemaining !== null && daysRemaining <= 7) {
        return {
          icon: Clock,
          title: `Subscription renews in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
          message: 'Your subscription will automatically renew.',
          variant: 'info',
          dismissable: true,
          showUpgrade: false,
        }
      }
      return null
    }

    default:
      return null
  }
}
