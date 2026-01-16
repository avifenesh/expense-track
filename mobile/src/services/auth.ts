import { apiPost } from './api';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MessageResponse {
  message: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { email, password });
}

export async function register(
  email: string,
  password: string,
  displayName: string
): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/register', { email, password, displayName });
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/verify-email', { token });
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/resend-verification', { email });
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/request-reset', { email });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/reset-password', { token, newPassword });
}

export async function refreshTokens(refreshToken: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/refresh', { refreshToken });
}

export async function logout(refreshToken: string): Promise<MessageResponse> {
  return apiPost<MessageResponse>('/auth/logout', { refreshToken });
}
