import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { successResponse, authError, serverError } from '@/lib/api-helpers'
import { getSubscriptionState } from '@/lib/subscription'
import { getPaddleCheckoutSettings } from '@/lib/paddle'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/v1/subscriptions
 *
 * Get the current user's subscription state and Paddle checkout settings
 * Used by mobile app and frontend to display subscription status and enable upgrades
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user via JWT
    const auth = await requireJwtAuth(request)
    if ('error' in auth) {
      return authError(auth.error)
    }

    const { userId, email } = auth

    // Get subscription state
    const subscriptionState = await getSubscriptionState(userId)

    // Get user's subscription record for Paddle IDs
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        paddleCustomerId: true,
        paddleSubscriptionId: true,
        paddlePriceId: true,
      },
    })

    // Get Paddle checkout settings for upgrade flow
    let checkoutSettings = null
    try {
      checkoutSettings = getPaddleCheckoutSettings(userId, email)
    } catch {
      // Paddle not configured - checkout not available
      checkoutSettings = null
    }

    return successResponse({
      subscription: {
        status: subscriptionState.status,
        isActive: subscriptionState.isActive,
        canAccessApp: subscriptionState.canAccessApp,
        trialEndsAt: subscriptionState.trialEndsAt?.toISOString() || null,
        currentPeriodEnd: subscriptionState.currentPeriodEnd?.toISOString() || null,
        daysRemaining: subscriptionState.daysRemaining,
        // Paddle IDs (for customer portal)
        paddleCustomerId: subscription?.paddleCustomerId || null,
        paddleSubscriptionId: subscription?.paddleSubscriptionId || null,
      },
      checkout: checkoutSettings
        ? {
            priceId: checkoutSettings.priceId,
            customData: checkoutSettings.customData,
            customerEmail: checkoutSettings.customer.email,
          }
        : null,
      pricing: {
        monthlyPriceCents: 500,
        trialDays: 14,
        currency: 'USD',
      },
    })
  } catch (error) {
    console.error('GET /api/v1/subscriptions error:', error)
    return serverError('Failed to fetch subscription')
  }
}
