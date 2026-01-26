import {
  login,
  register,
  verifyEmail,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  exportUserData,
  deleteAccount,
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

  describe('exportUserData', () => {
    it('exports data in JSON format', async () => {
      const mockExportData = {
        exportedAt: '2024-01-15T12:00:00.000Z',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          displayName: 'Test User',
          preferredCurrency: 'USD',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        accounts: [],
        categories: [],
        transactions: [],
        budgets: [],
        recurringTemplates: [],
        holdings: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockExportData,
          }),
      });

      const result = await exportUserData('json', 'access-token-123');

      expect(result).toEqual(mockExportData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/export?format=json'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token-123',
          }),
        })
      );
    });

    it('exports data in CSV format', async () => {
      const mockCsvData = {
        format: 'csv',
        data: 'id,description,amount\n1,Test,100.00',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockCsvData,
          }),
      });

      const result = await exportUserData('csv', 'access-token-123');

      expect(result).toEqual(mockCsvData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/export?format=csv'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('deleteAccount', () => {
    it('deletes account with email confirmation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { message: 'Account deleted successfully' },
          }),
      });

      const result = await deleteAccount('test@example.com', 'access-token-123');

      expect(result.message).toBe('Account deleted successfully');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/account'),
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ confirmEmail: 'test@example.com' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token-123',
          }),
        })
      );
    });
  });
});
