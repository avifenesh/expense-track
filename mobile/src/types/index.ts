export type Currency = 'USD' | 'EUR' | 'ILS'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
