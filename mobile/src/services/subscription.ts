import { apiGet } from './api'

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED'

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

export interface CheckoutInfo {
  priceId: string
  customData: Record<string, unknown>
  customerEmail: string
}

export interface PricingInfo {
  monthlyPriceCents: number
  trialDays: number
  currency: string
}

export interface SubscriptionStatusResponse {
  subscription: SubscriptionInfo
  checkout: CheckoutInfo | null
  pricing: PricingInfo
}

export async function getSubscriptionStatus(
  accessToken: string
): Promise<SubscriptionStatusResponse> {
  return apiGet<SubscriptionStatusResponse>('/subscriptions', accessToken)
}
