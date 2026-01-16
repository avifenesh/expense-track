import { apiRequest, apiPost, ApiError } from '../../src/services/api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('apiRequest', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('returns data on success response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: '123', name: 'Test' },
        }),
    });

    const result = await apiRequest<{ id: string; name: string }>('/test');

    expect(result).toEqual({ id: '123', name: 'Test' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('includes authorization header when token provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    await apiRequest('/test', {}, 'my-access-token');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-access-token',
        }),
      })
    );
  });

  it('throws ApiError on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    });

    try {
      await apiRequest('/auth/login');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.message).toBe('Invalid credentials');
      expect(apiError.code).toBe('UNAUTHORIZED');
      expect(apiError.status).toBe(401);
    }
  });

  it('throws ApiError with validation details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'Validation failed',
          fields: {
            email: ['Invalid email address'],
            password: ['Password too short'],
          },
        }),
    });

    try {
      await apiRequest('/auth/register');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('VALIDATION_ERROR');
      expect(apiError.details).toEqual({
        email: ['Invalid email address'],
        password: ['Password too short'],
      });
    }
  });

  it('handles rate limit errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
    });

    try {
      await apiRequest('/auth/login');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('RATE_LIMITED');
      expect(apiError.status).toBe(429);
    }
  });

  it('handles network errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    try {
      await apiRequest('/test');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('NETWORK_ERROR');
      expect(apiError.message).toContain('Network error');
    }
  });

  it('handles invalid JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    try {
      await apiRequest('/test');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe('INVALID_RESPONSE');
    }
  });
});

describe('apiPost', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('sends POST request with body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: '123' } }),
    });

    await apiPost('/auth/login', { email: 'test@example.com', password: 'pass' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'pass' }),
      })
    );
  });
});
