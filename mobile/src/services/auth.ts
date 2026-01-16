/**
 * Authentication service for mobile app.
 * Handles all auth-related API calls.
 */

import { apiPost } from './api';

/**
 * Response types for auth endpoints
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MessageResponse {
  message: string;
}

/**
 * Log in with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Access token, refresh token, and expiry time
 * @throws ApiError on failure
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { email, password });
}

/**
 * Register a new user account
 * @param email - User's email address
 * @param password - User's password (min 8 chars, uppercase, lowercase, number)
 * @param displayName - User's display name
 * @returns Success message (generic to prevent email enumeration)
 * @throws ApiError on validation failure
 */
export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/register', { email, password, displayName });
}

/**
 * Verify user's email with token
 * @param token - Email verification token from email link
 * @returns Success message
 * @throws ApiError on invalid/expired token
 */
export async function verifyEmail(token: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/verify-email', { token });
}

/**
 * Resend verification email
 * @param email - User's email address
 * @returns Success message (generic to prevent email enumeration)
 * @throws ApiError on validation failure or rate limit
 */
export async function resendVerification(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/resend-verification', { email });
}

/**
 * Request password reset email
 * @param email - User's email address
 * @returns Success message (generic to prevent email enumeration)
 * @throws ApiError on validation failure or rate limit
 */
export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/request-reset', { email });
}

/**
 * Reset password with token
 * @param token - Password reset token from email link
 * @param newPassword - New password (min 8 chars, uppercase, lowercase, number)
 * @returns Success message
 * @throws ApiError on invalid/expired token or validation failure
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/reset-password', { token, newPassword });
}

/**
 * Refresh access token using refresh token
 * @param refreshToken - Current refresh token
 * @returns New tokens
 * @throws ApiError on invalid/expired token
 */
export async function refreshTokens(refreshToken: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/refresh', { refreshToken });
}

/**
 * Log out (invalidate refresh token on server)
 * @param refreshToken - Current refresh token
 * @returns Success message
 */
export async function logout(refreshToken: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/logout', { refreshToken });
}
