import { apiGet } from './api'

/**
 * Subscription status enum matching backend Prisma enum
 */
export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'

/**
 * Subscription information from the backend
 */
export interface SubscriptionInfo {
  status: SubscriptionStatus
  isActive: boolean
  canAccessApp: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  daysRemaining: number | null
  paddleCustomerId: string | null
  paddleSubscriptionId: string | null
}

/**
 * Paddle checkout configuration for upgrade flow
 */
export interface CheckoutInfo {
  priceId: string
  customData: Record<string, unknown>
  customerEmail: string
}

/**
 * Pricing information for display
 */
export interface PricingInfo {
  monthlyPriceCents: number
  trialDays: number
  currency: string
}

/**
 * Full subscription status response from GET /api/v1/subscriptions
 */
export interface SubscriptionStatusResponse {
  subscription: SubscriptionInfo
  checkout: CheckoutInfo | null
  pricing: PricingInfo
}

/**
 * Fetch the current user's subscription status
 *
 * @param accessToken - JWT access token for authentication
 * @returns Subscription status, checkout settings, and pricing info
 */
export async function getSubscriptionStatus(
  accessToken: string
): Promise<SubscriptionStatusResponse> {
  return apiGet<SubscriptionStatusResponse>('/subscriptions', accessToken)
}
