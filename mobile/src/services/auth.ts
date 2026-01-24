import { apiGet, apiPost, apiPatch } from './api'

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
    plan: string
    trialDaysRemaining: number | null
    cancelAtPeriodEnd: boolean
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
