import {
  login,
  register,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
} from '../../src/services/auth';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Auth Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('login', () => {
    it('returns tokens on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              accessToken: 'access-123',
              refreshToken: 'refresh-456',
              expiresIn: 900,
            },
          }),
      });

      const result = await login('test@example.com', 'Password123');

      expect(result).toEqual({
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 900,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'Password123' }),
        })
      );
    });
  });

  describe('register', () => {
    it('sends registration request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'If this email is not registered...' },
          }),
      });

      const result = await register('test@example.com', 'Password123', 'Test User');

      expect(result.message).toContain('email');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'Password123',
            displayName: 'Test User',
          }),
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('sends verification token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'Email verified successfully' },
          }),
      });

      const result = await verifyEmail('verification-token-123');

      expect(result.message).toContain('verified');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/verify-email'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'verification-token-123' }),
        })
      );
    });
  });

  describe('resendVerification', () => {
    it('sends resend request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'If an account exists...' },
          }),
      });

      await resendVerification('test@example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/resend-verification'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('sends reset request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'If an account exists...' },
          }),
      });

      await requestPasswordReset('test@example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/request-reset'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      );
    });
  });

  describe('resetPassword', () => {
    it('sends new password with token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'Password reset successfully' },
          }),
      });

      const result = await resetPassword('reset-token-123', 'NewPassword123');

      expect(result.message).toContain('reset');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'reset-token-123',
            newPassword: 'NewPassword123',
          }),
        })
      );
    });
  });
});
