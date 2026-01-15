import 'server-only'

import { SubscriptionStatus } from '@prisma/client'
import { prisma } from './prisma'
import { TRIAL_DURATION_DAYS, SUBSCRIPTION_PRICE_CENTS } from './subscription-constants'

export { TRIAL_DURATION_DAYS, SUBSCRIPTION_PRICE_CENTS }

export type SubscriptionState = {
  status: SubscriptionStatus
  isActive: boolean
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  daysRemaining: number | null
  canAccessApp: boolean
}

/**
 * Get the subscription state for a user
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })

  if (!subscription) {
    return {
      status: SubscriptionStatus.EXPIRED,
      isActive: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      daysRemaining: null,
      canAccessApp: false,
    }
  }

  const now = new Date()
  const { status, trialEndsAt, currentPeriodEnd } = subscription

  // ACTIVE subscriptions must have a valid currentPeriodEnd (defense-in-depth)
  const isActive = status === SubscriptionStatus.ACTIVE && !!currentPeriodEnd && currentPeriodEnd > now
  const isTrialing = status === SubscriptionStatus.TRIALING && !!trialEndsAt && trialEndsAt > now
  const isPastDue = status === SubscriptionStatus.PAST_DUE
  // CANCELED subscriptions retain access until their period ends (standard SaaS behavior)
  const isCanceledWithAccess = status === SubscriptionStatus.CANCELED && !!currentPeriodEnd && currentPeriodEnd > now

  const canAccessApp = isActive || isTrialing || isPastDue || isCanceledWithAccess

  let daysRemaining: number | null = null
  if (isTrialing && trialEndsAt) {
    daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  } else if (isActive && currentPeriodEnd) {
    daysRemaining = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  return {
    status,
    isActive: !!(isActive || isTrialing),
    trialEndsAt,
    currentPeriodEnd,
    daysRemaining,
    canAccessApp,
  }
}

/**
 * Create a trial subscription for a new user
 */
export async function createTrialSubscription(userId: string): Promise<void> {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

  await prisma.subscription.create({
    data: {
      userId,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt,
    },
  })
}

/**
 * Activate a subscription after payment
 */
export async function activateSubscription(userId: string, periodStart: Date, periodEnd: Date): Promise<void> {
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      status: SubscriptionStatus.ACTIVE,
      // For direct subscriptions (no trial), trialEndsAt marks when they converted to paid.
      // This maintains schema consistency where trialEndsAt is always set.
      trialEndsAt: new Date(),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      canceledAt: null,
    },
  })
}

/**
 * Mark subscription as past due (payment failed)
 */
export async function markSubscriptionPastDue(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: { status: SubscriptionStatus.PAST_DUE },
  })
}

/**
 * Cancel a subscription (will remain active until period end)
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: new Date(),
    },
  })
}

/**
 * Expire a subscription (no longer has access)
 */
export async function expireSubscription(userId: string): Promise<void> {
  await prisma.subscription.update({
    where: { userId },
    data: { status: SubscriptionStatus.EXPIRED },
  })
}

/**
 * Check if user has an active subscription or trial
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const state = await getSubscriptionState(userId)
  return state.canAccessApp
}

/**
 * Get all subscriptions that need to be expired (trial ended or period ended)
 */
export async function getExpiredSubscriptions(): Promise<string[]> {
  const now = new Date()

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: { lt: now },
    },
    select: { userId: true },
  })

  const expiredPeriods = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
      currentPeriodEnd: { lt: now },
    },
    select: { userId: true },
  })

  return [...expiredTrials, ...expiredPeriods].map((s) => s.userId)
}

/**
 * Process expired subscriptions (run periodically via cron)
 */
export async function processExpiredSubscriptions(): Promise<number> {
  const expiredUserIds = await getExpiredSubscriptions()

  if (expiredUserIds.length === 0) {
    return 0
  }

  await prisma.subscription.updateMany({
    where: { userId: { in: expiredUserIds } },
    data: { status: SubscriptionStatus.EXPIRED },
  })

  return expiredUserIds.length
}
