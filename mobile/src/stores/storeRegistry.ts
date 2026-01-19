// Store registry for managing store lifecycle without circular dependencies
// Stores register their reset functions here, and authStore calls resetAllStores() on logout

type ResetFunction = () => void;

const storeResetFunctions: ResetFunction[] = [];

/**
 * Register a store's reset function to be called on logout.
 * Call this when creating a store that needs cleanup on user logout.
 */
export function registerStoreReset(resetFn: ResetFunction): void {
  storeResetFunctions.push(resetFn);
}

/**
 * Reset all registered stores. Called by authStore on logout.
 * This breaks the circular dependency by avoiding direct store imports in authStore.
 */
export function resetAllStores(): void {
  storeResetFunctions.forEach((reset) => reset());
}
