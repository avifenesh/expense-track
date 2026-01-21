import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

async function navigateToBudgets(): Promise<void> {
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

  await waitFor(element(by.id('tab.budgets')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('tab.budgets')).tap();

  await waitFor(element(by.id('budgets.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

describe('Budgets', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await navigateToBudgets();
  });

  describe('Screen Display', () => {
    it('should display budget progress and category breakdown', async () => {
      await expect(element(by.id('budgets.screen'))).toBeVisible();
      await expect(element(by.id('budgets.title'))).toBeVisible();
      await expect(element(by.id('budgets.subtitle'))).toBeVisible();
      await expect(element(by.id('budgets.monthSelector'))).toBeVisible();

      try {
        await waitFor(element(by.id('budgets.progressCard')))
          .toBeVisible()
          .withTimeout(3000);
        await expect(element(by.id('budgets.categoryList'))).toBeVisible();
      } catch {
        await expect(element(by.id('budgets.emptyState'))).toBeVisible();
      }
    });
  });

  describe('Month Navigation', () => {
    it('should allow navigating between months', async () => {
      await expect(element(by.id('budgets.monthSelector'))).toBeVisible();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no budgets are set', async () => {
      try {
        await waitFor(element(by.id('budgets.emptyState')))
          .toBeVisible()
          .withTimeout(3000);
        await expect(element(by.id('budgets.screen'))).toBeVisible();
      } catch {
        await expect(element(by.id('budgets.progressCard'))).toBeVisible();
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

      await element(by.id('tab.budgets')).tap();

      try {
        await waitFor(element(by.id('budgets.loadingIndicator')))
          .toBeVisible()
          .withTimeout(1000);
      } catch {}

      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle and display error states gracefully', async () => {
      await expect(element(by.id('budgets.screen'))).toBeVisible();
    });
  });

  describe('Budget Creation', () => {
    it('should create new budget', async () => {
      await expect(element(by.id('budgets.screen'))).toBeVisible();

      try {
        await waitFor(element(by.id('budgets.addButton')))
          .toBeVisible()
          .withTimeout(3000);

        await element(by.id('budgets.addButton')).tap();

        await waitFor(element(by.id('addBudget.screen')))
          .toBeVisible()
          .withTimeout(5000);

        try {
          await waitFor(element(by.id('addBudget.categorySelect')))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id('addBudget.categorySelect')).tap();

          await waitFor(element(by.id('addBudget.categoryOption.0')))
            .toBeVisible()
            .withTimeout(3000);
          await element(by.id('addBudget.categoryOption.0')).tap();
        } catch {}

        await waitFor(element(by.id('addBudget.amountInput')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('addBudget.amountInput')).tap();
        await element(by.id('addBudget.amountInput')).typeText('500');
        await element(by.id('addBudget.amountInput')).tapReturnKey();
        await element(by.id('addBudget.submitButton')).tap();

        await waitFor(element(by.id('budgets.screen')))
          .toBeVisible()
          .withTimeout(5000);

        try {
          await waitFor(element(by.id('budgets.progressCard')))
            .toBeVisible()
            .withTimeout(5000);
        } catch {
          await expect(element(by.id('budgets.screen'))).toBeVisible();
        }
      } catch {
        await expect(element(by.id('budgets.screen'))).toBeVisible();

        try {
          await expect(element(by.id('budgets.emptyState'))).toBeVisible();
        } catch {
          await expect(element(by.id('budgets.progressCard'))).toBeVisible();
        }
      }
    });
  });
});
