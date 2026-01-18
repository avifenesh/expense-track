import { renderHook, act } from '@testing-library/react-hooks';
import { useOnboardingStore } from '../../src/stores/onboardingStore';
import * as api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

jest.mock('../../src/services/api');
jest.mock('../../src/stores/authStore');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedAuthStore = useAuthStore as unknown as jest.Mock;

describe('onboardingStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('initial state', () => {
    it('has correct default values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      expect(result.current.selectedCurrency).toBe('USD');
      expect(result.current.selectedCategories).toEqual([]);
      expect(result.current.monthlyBudget).toBe(null);
      expect(result.current.wantsSampleData).toBe(false);
      expect(result.current.isCompleting).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('setCurrency', () => {
    it('updates selected currency', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrency('EUR');
      });

      expect(result.current.selectedCurrency).toBe('EUR');
    });
  });

  describe('toggleCategory', () => {
    it('adds category when not selected', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.toggleCategory('Groceries');
      });

      expect(result.current.selectedCategories).toEqual(['Groceries']);
    });

    it('removes category when already selected', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.toggleCategory('Groceries');
        result.current.toggleCategory('Transportation');
      });

      expect(result.current.selectedCategories).toEqual(['Groceries', 'Transportation']);

      act(() => {
        result.current.toggleCategory('Groceries');
      });

      expect(result.current.selectedCategories).toEqual(['Transportation']);
    });
  });

  describe('setBudget', () => {
    it('sets monthly budget amount', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setBudget(2000);
      });

      expect(result.current.monthlyBudget).toBe(2000);
    });

    it('clears budget when set to null', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setBudget(2000);
        result.current.setBudget(null);
      });

      expect(result.current.monthlyBudget).toBe(null);
    });
  });

  describe('setSampleData', () => {
    it('updates sample data preference', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setSampleData(true);
      });

      expect(result.current.wantsSampleData).toBe(true);

      act(() => {
        result.current.setSampleData(false);
      });

      expect(result.current.wantsSampleData).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    const mockAccessToken = 'test-token';
    const mockUpdateUser = jest.fn();

    beforeEach(() => {
      mockedAuthStore.mockReturnValue({
        accessToken: mockAccessToken,
        updateUser: mockUpdateUser,
      } as unknown as ReturnType<typeof useAuthStore>);

      global.fetch = jest.fn();
    });

    it('calls all APIs in sequence', async () => {
      mockedApi.apiPatch.mockResolvedValue({ currency: 'USD' });
      mockedApi.apiPost.mockResolvedValue({});
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { accounts: [{ id: 'acc-1', name: 'Main' }] },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { categories: [{ id: 'cat-1', name: 'Total' }] },
          }),
        });

      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrency('USD');
        result.current.toggleCategory('Groceries');
        result.current.setBudget(2000);
        result.current.setSampleData(true);
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      expect(mockedApi.apiPatch).toHaveBeenCalledWith(
        '/users/me/currency',
        { currency: 'USD' },
        mockAccessToken
      );

      expect(mockedApi.apiPost).toHaveBeenCalledWith(
        '/categories/bulk',
        expect.objectContaining({
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'Groceries' }),
          ]),
        }),
        mockAccessToken
      );

      expect(mockedApi.apiPost).toHaveBeenCalledWith(
        '/budgets/quick',
        expect.objectContaining({
          accountId: 'acc-1',
          categoryId: 'cat-1',
          planned: 2000,
          currency: 'USD',
        }),
        mockAccessToken
      );

      expect(mockedApi.apiPost).toHaveBeenCalledWith('/seed-data', {}, mockAccessToken);

      expect(mockedApi.apiPost).toHaveBeenCalledWith('/onboarding/complete', {}, mockAccessToken);

      expect(mockUpdateUser).toHaveBeenCalledWith({ hasCompletedOnboarding: true });
    });

    it('skips categories when none selected', async () => {
      mockedApi.apiPatch.mockResolvedValue({ currency: 'USD' });
      mockedApi.apiPost.mockResolvedValue({});

      const { result } = renderHook(() => useOnboardingStore());

      await act(async () => {
        await result.current.completeOnboarding();
      });

      expect(mockedApi.apiPost).not.toHaveBeenCalledWith(
        '/categories/bulk',
        expect.anything(),
        expect.anything()
      );
    });

    it('skips budget when not set', async () => {
      mockedApi.apiPatch.mockResolvedValue({ currency: 'USD' });
      mockedApi.apiPost.mockResolvedValue({});

      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setBudget(null);
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips sample data when not requested', async () => {
      mockedApi.apiPatch.mockResolvedValue({ currency: 'USD' });
      mockedApi.apiPost.mockResolvedValue({});

      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setSampleData(false);
      });

      await act(async () => {
        await result.current.completeOnboarding();
      });

      expect(mockedApi.apiPost).not.toHaveBeenCalledWith(
        '/seed-data',
        expect.anything(),
        expect.anything()
      );
    });

    it('sets error state on API failure', async () => {
      const errorMessage = 'Network error';
      mockedApi.apiPatch.mockRejectedValue(new api.ApiError(errorMessage, 'NETWORK_ERROR', 0));

      const { result } = renderHook(() => useOnboardingStore());

      await act(async () => {
        try {
          await result.current.completeOnboarding();
        } catch {
          // Expected error - handled by store
        }
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isCompleting).toBe(false);
    });

    it('sets isCompleting flag during execution', async () => {
      let resolvePatch: (value: unknown) => void;
      const patchPromise = new Promise((resolve) => {
        resolvePatch = resolve;
      });

      mockedApi.apiPatch.mockReturnValue(patchPromise as Promise<{ currency: string }>);
      mockedApi.apiPost.mockResolvedValue({});

      const { result } = renderHook(() => useOnboardingStore());

      const completionPromise = act(async () => {
        await result.current.completeOnboarding();
      });

      expect(result.current.isCompleting).toBe(true);

      resolvePatch!({ currency: 'USD' });
      await completionPromise;

      expect(result.current.isCompleting).toBe(false);
    });

    it('throws error when not authenticated', async () => {
      mockedAuthStore.mockReturnValue({
        accessToken: null,
        updateUser: jest.fn(),
      } as unknown as ReturnType<typeof useAuthStore>);

      const { result } = renderHook(() => useOnboardingStore());

      await act(async () => {
        try {
          await result.current.completeOnboarding();
        } catch {
          // Expected error - handled by store
        }
      });

      expect(result.current.error).toBe('Not authenticated');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.setCurrency('EUR');
        result.current.toggleCategory('Groceries');
        result.current.setBudget(2000);
        result.current.setSampleData(true);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.selectedCurrency).toBe('USD');
      expect(result.current.selectedCategories).toEqual([]);
      expect(result.current.monthlyBudget).toBe(null);
      expect(result.current.wantsSampleData).toBe(false);
      expect(result.current.isCompleting).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });
});
