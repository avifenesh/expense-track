import { apiGet, apiPost, apiPatch, apiDeleteWithBody } from './api'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface MessageResponse {
  message: string
}

export interface RegisterResponse {
  message: string
  emailVerified: boolean
}

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  preferredCurrency: string
  hasCompletedOnboarding: boolean
  createdAt: string
  subscription: {
    status: string
    isActive: boolean
    trialEndsAt: string | null
    currentPeriodEnd: string | null
    daysRemaining: number | null
    canAccessApp: boolean
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { email, password })
}

export async function register(email: string, password: string, displayName: string): Promise<RegisterResponse> {
  return apiPost<RegisterResponse>('/auth/register', { email, password, displayName })
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/verify-email', { token })
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/resend-verification', { email })
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/request-reset', { email })
}

export async function resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/reset-password', { token, newPassword })
}

export async function refreshTokens(refreshToken: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/refresh', { refreshToken })
}

export async function logout(refreshToken: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/logout', { refreshToken })
}

export async function getProfile(accessToken: string): Promise<UserProfile> {
  return apiGet<UserProfile>('/users/me', accessToken)
}

export interface UpdateProfileRequest {
  displayName: string
}

export interface UpdateProfileResponse {
  id: string
  email: string
  displayName: string
  preferredCurrency: string
}

export async function updateProfile(data: UpdateProfileRequest, accessToken: string): Promise<UpdateProfileResponse> {
  return apiPatch<UpdateProfileResponse>('/users/me', data, accessToken)
}

export interface UpdateCurrencyResponse {
  currency: string
}

export async function updateCurrency(currency: string, accessToken: string): Promise<UpdateCurrencyResponse> {
  return apiPatch<UpdateCurrencyResponse>('/users/me/currency', { currency }, accessToken)
}

// Export data types
export interface ExportDataUser {
  id: string
  email: string
  displayName: string | null
  preferredCurrency: string
  emailVerified?: boolean
  hasCompletedOnboarding?: boolean
  createdAt: string
}

export interface ExportDataSubscription {
  id: string
  status: string
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  createdAt: string
}

export interface ExportDataAccount {
  id: string
  name: string
  preferredCurrency: string
  createdAt: string
}

export interface ExportDataCategory {
  id: string
  name: string
  icon: string
  color: string
  type: string
}

export interface ExportDataTransaction {
  id: string
  description: string | null
  amount: string
  type: string
  date: string
  categoryName: string
  accountName: string
}

export interface ExportDataBudget {
  id: string
  amount: string
  month: string
  categoryName: string
  accountName: string
}

export interface ExportDataRecurring {
  id: string
  description: string | null
  amount: string
  type: string
  frequency: string
  startDate: string
  categoryName: string
  accountName: string
}

export interface ExportDataHolding {
  id: string
  symbol: string
  quantity: string
  costBasis: string
  accountName: string
}

export interface ExportDataJsonResponse {
  exportedAt: string
  user: ExportDataUser
  subscription?: ExportDataSubscription
  accounts: ExportDataAccount[]
  categories: ExportDataCategory[]
  transactions: ExportDataTransaction[]
  budgets: ExportDataBudget[]
  recurringTemplates: ExportDataRecurring[]
  holdings: ExportDataHolding[]
}

export interface ExportDataCsvResponse {
  format: 'csv'
  data: string
}

export type ExportDataResponse = ExportDataJsonResponse | ExportDataCsvResponse

export interface DeleteAccountResponse {
  message: string
}

export async function exportUserData(
  format: 'json' | 'csv',
  accessToken: string
): Promise<ExportDataResponse> {
  return apiGet<ExportDataResponse>(`/auth/export?format=${format}`, accessToken)
}

export async function deleteAccount(
  confirmEmail: string,
  accessToken: string
): Promise<DeleteAccountResponse> {
  return apiDeleteWithBody<DeleteAccountResponse>(
    '/auth/account',
    { confirmEmail },
    accessToken
  )
}
