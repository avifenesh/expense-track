// Shared TypeScript type definitions
// Types will be added as features are implemented

export type Currency = 'USD' | 'EUR' | 'ILS'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
