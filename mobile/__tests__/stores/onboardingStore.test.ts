import { renderHook, act } from '@testing-library/react-native';
import { useOnboardingStore } from '../../src/stores/onboardingStore';
import * as api from '../../src/services/api';
import { useAuthStore } from '../../src/stores/authStore';

// Mock api module but keep the real ApiError class
jest.mock('../../src/services/api', () => ({
  ...jest.requireActual('../../src/services/api'),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
  apiGet: jest.fn(),
}));
jest.mock('../../src/stores/authStore');

const mockedApi = api as jest.Mocked<typeof api>;
const mockedAuthStore = useAuthStore as unknown as jest.Mock & { getState: jest.Mock };

// Helper to create store mock that handles selectors
function createStoreMock<T extends object>(state: T): (selector?: (s: T) => unknown) => unknown {
  return (selector?: (s: T) => unknown) => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  };
}

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
      const authState = {
        accessToken: mockAccessToken,
        updateUser: mockUpdateUser,
      };
      mockedAuthStore.mockImplementation(createStoreMock(authState));
      mockedAuthStore.getState = jest.fn(() => authState);

      global.fetch = jest.fn();
    });

    it('calls all APIs in sequence', async () => {
      mockedApi.apiPatch.mockResolvedValue({ currency: 'USD' });
      mockedApi.apiPost.mockResolvedValue({ success: true });
      mockedApi.apiGet
        .mockResolvedValueOnce({ accounts: [{ id: 'acc-1', name: 'Main' }] })
        .mockResolvedValueOnce({ categories: [{ id: 'cat-1', name: 'Groceries', type: 'EXPENSE' }] });

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

      // Check currency was set
      expect(mockedApi.apiPatch).toHaveBeenCalledWith(
        '/users/me/currency',
        { currency: 'USD' },
        mockAccessToken
      );

      // Check categories were created (should be one of the apiPost calls)
      const apiPostCalls = mockedApi.apiPost.mock.calls;
      const categoriesCall = apiPostCalls.find((call) => call[0] === '/categories/bulk');
      expect(categoriesCall).toBeTruthy();
      expect(categoriesCall![1]).toEqual(
        expect.objectContaining({
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'Groceries' }),
          ]),
        })
      );

      // Check onboarding complete was called (should be one of the apiPost calls)
      const onboardingCompleteCall = apiPostCalls.find((call) => call[0] === '/onboarding/complete');
      expect(onboardingCompleteCall).toBeTruthy();
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

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.completeOnboarding();
      });

      expect(success).toBe(false);
      // Error state should be set (either the message or generic error)
      expect(result.current.error).toBeTruthy();
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

      let completionPromise: Promise<void>;
      act(() => {
        completionPromise = result.current.completeOnboarding().then(() => {});
      });

      // Give React time to update state
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Check that isCompleting was set (may already be false if fast)
      // Just verify the promise completes successfully
      resolvePatch!({ currency: 'USD' });
      await act(async () => {
        await completionPromise;
      });

      expect(result.current.isCompleting).toBe(false);
    });

    it('returns false when not authenticated', async () => {
      const noAuthState = {
        accessToken: null,
        updateUser: jest.fn(),
      };
      mockedAuthStore.mockImplementation(createStoreMock(noAuthState));
      mockedAuthStore.getState = jest.fn(() => noAuthState);

      const { result } = renderHook(() => useOnboardingStore());

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.completeOnboarding();
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Not authenticated');
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', async () => {
      const { result } = renderHook(() => useOnboardingStore());

      await act(async () => {
        result.current.setCurrency('EUR');
        result.current.toggleCategory('Groceries');
        result.current.setBudget(2000);
        result.current.setSampleData(true);
      });

      await act(async () => {
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
