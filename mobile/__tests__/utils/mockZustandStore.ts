/**
 * Helper function to properly mock Zustand stores for testing.
 *
 * Zustand stores can be called with a selector function:
 *   const value = useStore((state) => state.someValue)
 *
 * Or without a selector to get the entire state:
 *   const state = useStore()
 *
 * This helper creates a mock that handles both cases correctly.
 */

type SelectorFn<T, R> = (state: T) => R;

export function createMockStore<T extends object>(state: T) {
  const mockFn = jest.fn(<R>(selector?: SelectorFn<T, R>): T | R => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  });

  // Add getState method that returns the current state
  (mockFn as jest.Mock & { getState: () => T }).getState = () => state;

  return mockFn as jest.Mock & { getState: () => T };
}

/**
 * Updates a mock store with new state values.
 * Useful when you need to change state between test assertions.
 */
export function updateMockStore<T extends object>(
  mockFn: jest.Mock,
  newState: T
) {
  mockFn.mockImplementation(<R>(selector?: SelectorFn<T, R>): T | R => {
    if (typeof selector === 'function') {
      return selector(newState);
    }
    return newState;
  });

  // Update getState as well
  (mockFn as jest.Mock & { getState: () => T }).getState = () => newState;
}

/**
 * Creates a mock implementation that can be used with mockImplementation.
 * This is useful when you want to define the mock inline.
 *
 * Example:
 *   mockUseStore.mockImplementation(createMockStoreImplementation({
 *     value: 'test',
 *     isLoading: false,
 *   }));
 */
export function createMockStoreImplementation<T extends object>(state: T) {
  return <R>(selector?: SelectorFn<T, R>): T | R => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  };
}
