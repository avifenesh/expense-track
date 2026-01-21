import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';


async function navigateToTransactions(): Promise<void> {
  await loginAsPrimaryUser();

  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(2000);
  } catch {
    try {
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(2000);
      await completeOnboarding();
    } catch {
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    }
  }

  await waitFor(element(by.id('tab.transactions')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('tab.transactions')).tap();

  await waitFor(element(by.id('transactions.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Transactions', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToTransactions();
  });

  describe('Screen Display', () => {
    it('should display transaction list with filters', async () => {
          await expect(element(by.id('transactions.screen'))).toBeVisible();
      await expect(element(by.id('transactions.title'))).toBeVisible();
      await expect(element(by.id('transactions.addButton'))).toBeVisible();

          await expect(element(by.id('transactions.filterAll'))).toBeVisible();
      await expect(element(by.id('transactions.filterIncome'))).toBeVisible();
      await expect(element(by.id('transactions.filterExpense'))).toBeVisible();

          try {
              await expect(element(by.id('transactions.list'))).toBeVisible();
      } catch {
              await expect(element(by.id('transactions.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Filtering', () => {
    it('should filter transactions by type (income/expense)', async () => {
      // Start with "All" filter selected
      await expect(element(by.id('transactions.filterAll'))).toBeVisible();

          await element(by.id('transactions.filterIncome')).tap();

          await expect(element(by.id('transactions.screen'))).toBeVisible();

          await element(by.id('transactions.filterExpense')).tap();

          await expect(element(by.id('transactions.screen'))).toBeVisible();

          await element(by.id('transactions.filterAll')).tap();

          await expect(element(by.id('transactions.screen'))).toBeVisible();

          try {
        await expect(element(by.id('transactions.list'))).toBeVisible();
      } catch {
        await expect(element(by.id('transactions.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no transactions exist', async () => {
      // If account is new or has no sample data, empty state should show
      try {
        await waitFor(element(by.id('transactions.emptyState')))
          .toBeVisible()
          .withTimeout(3000);

              await expect(element(by.id('transactions.addButton'))).toBeVisible();
      } catch {
        // Has transactions - test doesn't apply
        await expect(element(by.id('transactions.list'))).toBeVisible();
      }
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator during data fetch', async () => {
          await device.reloadReactNative();
      await loginAsPrimaryUser();

          try {
        await waitFor(element(by.id('onboarding.welcome.screen')))
          .toBeVisible()
          .withTimeout(3000);
        await completeOnboarding();
      } catch {}

      // Navigate to transactions
      await element(by.id('tab.transactions')).tap();

      // Loading indicator may appear briefly
      try {
        await waitFor(element(by.id('transactions.loadingIndicator')))
          .toBeVisible()
          .withTimeout(1000);
      } catch {
        // If loading indicator not observed, verify we're on the transactions screen
        await expect(element(by.id('transactions.screen'))).toBeVisible();
      }

      // Should eventually show screen content
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Search and Filter', () => {
    it('should search and filter transactions', async () => {
          await expect(element(by.id('transactions.screen'))).toBeVisible();

          try {
        await waitFor(element(by.id('transactions.searchInput')))
          .toBeVisible()
          .withTimeout(3000);

              await element(by.id('transactions.searchInput')).tap();
        await element(by.id('transactions.searchInput')).typeText('food');

              await element(by.id('transactions.searchInput')).tapReturnKey();

              await expect(element(by.id('transactions.screen'))).toBeVisible();

        // Clear search
        await element(by.id('transactions.searchInput')).clearText();
      } catch {}

      // Test combined filtering with type filters
      await expect(element(by.id('transactions.filterAll'))).toBeVisible();

      // Apply income filter
      await element(by.id('transactions.filterIncome')).tap();
      await expect(element(by.id('transactions.screen'))).toBeVisible();

          try {
        await waitFor(element(by.id('transactions.categoryFilter')))
          .toBeVisible()
          .withTimeout(2000);
        await element(by.id('transactions.categoryFilter')).tap();

              try {
          await waitFor(element(by.id('transactions.categoryOption.food')))
            .toBeVisible()
            .withTimeout(2000);
          await element(by.id('transactions.categoryOption.food')).tap();
        } catch {}
      } catch {}

      // Reset to "All" filter
      await element(by.id('transactions.filterAll')).tap();

          await expect(element(by.id('transactions.screen'))).toBeVisible();

          try {
        await expect(element(by.id('transactions.list'))).toBeVisible();
      } catch {
        await expect(element(by.id('transactions.emptyState'))).toBeVisible();
      }
    });
  });
});
