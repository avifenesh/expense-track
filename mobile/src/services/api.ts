/**
 * Core API service for making HTTP requests to the backend.
 * Handles base URL configuration, error handling, and response parsing.
 */

// Use environment variable for API URL, fallback to localhost in development
// In production, this would be set to the actual API domain
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Custom error class for API errors with structured error data
 */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, code: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Response types from the API
 */
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success?: false;
  error: string;
  fields?: Record<string, string[]>;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Makes an authenticated API request
 * @param endpoint - API endpoint (e.g., '/auth/login')
 * @param options - Fetch options
 * @param accessToken - Optional JWT access token for authenticated requests
 * @returns Promise with the response data
 * @throws ApiError on failure
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  accessToken?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        'Invalid response from server',
        'INVALID_RESPONSE',
        response.status
      );
    }

    // Check for API error response
    if ('error' in data && data.error) {
      throw new ApiError(
        data.error,
        response.status === 401 ? 'UNAUTHORIZED' :
        response.status === 403 ? 'FORBIDDEN' :
        response.status === 429 ? 'RATE_LIMITED' :
        response.status === 400 ? 'VALIDATION_ERROR' : 'API_ERROR',
        response.status,
        data.fields
      );
    }

    // Success response
    if ('success' in data && data.success && 'data' in data) {
      return data.data;
    }

    // Unexpected response format
    throw new ApiError(
      'Unexpected response format',
      'INVALID_RESPONSE',
      response.status
    );
  } catch (error) {
    // Re-throw ApiError instances
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        'Network error. Please check your connection.',
        'NETWORK_ERROR',
        0
      );
    }

    // Handle other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      'UNKNOWN_ERROR',
      0
    );
  }
}

/**
 * Helper for GET requests
 */
export function apiGet<T>(endpoint: string, accessToken?: string | null): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET' }, accessToken);
}

/**
 * Helper for POST requests
 */
export function apiPost<T>(
  endpoint: string,
  body: unknown,
  accessToken?: string | null
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    accessToken
  );
}

/**
 * Helper for PUT requests
 */
export function apiPut<T>(
  endpoint: string,
  body: unknown,
  accessToken?: string | null
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    accessToken
  );
}

/**
 * Helper for PATCH requests
 */
export function apiPatch<T>(
  endpoint: string,
  body: unknown,
  accessToken?: string | null
): Promise<T> {
  return apiRequest<T>(
    endpoint,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    accessToken
  );
}

/**
 * Helper for DELETE requests
 */
export function apiDelete<T>(endpoint: string, accessToken?: string | null): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE' }, accessToken);
}
