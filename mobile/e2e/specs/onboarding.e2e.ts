import { element, by, expect, waitFor, device } from 'detox';
import { registerUser } from '../helpers';

/**
 * Onboarding Test Suite (P0)
 *
 * Tests for the onboarding flow that new users go through.
 * TestIDs added in PR #265.
 */

/**
 * Helper to register a new user and get to onboarding
 */
async function setupNewUserForOnboarding(): Promise<void> {
  // Wait for app to load
  await device.disableSynchronization();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(30000);
  await device.enableSynchronization();

  // Register new user - they should be redirected to onboarding
  const timestamp = Date.now();
  const email = `e2e-onboarding-${timestamp}@test.local`;
  await registerUser('Onboarding Test', email, 'OnboardingTest123!');
}

describe('Onboarding', () => {
  describe('P0: Onboarding Flows', () => {
    beforeEach(async () => {
      await device.launchApp({ newInstance: true });
    });

    it('should show welcome screen', async () => {
      await setupNewUserForOnboarding();

      // Verify welcome screen is displayed
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(10000);

      // Check all elements are visible
      await expect(element(by.id('onboarding.welcome.title'))).toBeVisible();
      await expect(element(by.id('onboarding.welcome.subtitle'))).toBeVisible();
      await expect(element(by.id('onboarding.welcome.getStartedButton'))).toBeVisible();
    });

    it('should select currency', async () => {
      await setupNewUserForOnboarding();

      // Wait for welcome screen and proceed
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Wait for currency screen
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify currency options are visible
      await expect(element(by.id('onboarding.currency.option.USD'))).toBeVisible();
      await expect(element(by.id('onboarding.currency.option.EUR'))).toBeVisible();
      await expect(element(by.id('onboarding.currency.option.ILS'))).toBeVisible();

      // Select EUR
      await element(by.id('onboarding.currency.option.EUR')).tap();

      // Verify EUR is selected (has active styling)
      // Continue to verify selection persists
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Should move to categories screen
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should set up categories', async () => {
      await setupNewUserForOnboarding();

      // Navigate to categories screen
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Now on categories screen
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify categories list is visible
      await expect(element(by.id('onboarding.categories.list'))).toBeVisible();

      // Toggle a category (Food & Dining - uses lowercase dash format)
      await element(by.id('onboarding.categories.item.food-&-dining')).tap();

      // Continue
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Should move to budget screen
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should complete full onboarding', async () => {
      await setupNewUserForOnboarding();

      // Welcome screen
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Currency screen - select USD
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.currency.option.USD')).tap();
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Categories screen - keep defaults
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Budget screen - skip
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.budget.skipButton')).tap();

      // Sample data screen - select no
      await waitFor(element(by.id('onboarding.sampleData.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.sampleData.option.no')).tap();
      await element(by.id('onboarding.sampleData.continueButton')).tap();

      // Biometric screen (if shown) - skip
      try {
        await waitFor(element(by.id('skip-button')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('skip-button')).tap();
      } catch {
        // Biometric screen not shown, continue
      }

      // Complete screen
      await waitFor(element(by.id('continue-button')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('continue-button')).tap();

      // Verify we reach dashboard
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(10000);

      // Verify dashboard elements
      await expect(element(by.id('dashboard.title'))).toBeVisible();
    });
  });
});
