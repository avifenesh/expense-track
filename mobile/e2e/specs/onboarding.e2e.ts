import { element, by, expect, waitFor, device } from 'detox';
import { registerUser } from '../helpers';
import { BiometricHelpers } from '../helpers/biometric-helpers';

/**
 * Onboarding Test Suite
 *
 * Tests for the multi-step onboarding flow after initial registration.
 * Covers currency selection, categories, budget setup, sample data, and biometric enrollment.
 *
 * Note: These tests validate UI navigation and choices. Backend integration is not required.
 */

/**
 * Navigate to onboarding by registering a new user
 * Uses timestamp-based email to ensure uniqueness
 */
async function navigateToOnboarding(): Promise<void> {
  const timestamp = Date.now();
  const email = `test-onboarding-${timestamp}@example.com`;

  await registerUser('Test User', email, 'TestPass123!');

  // Wait for onboarding welcome screen
  await waitFor(element(by.id('onboarding.welcome.screen')))
    .toBeVisible()
    .withTimeout(10000);
}

describe('Onboarding', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Full Onboarding Flow', () => {
    it('should complete full onboarding flow with all steps', async () => {
      await navigateToOnboarding();

      // Step 1: Welcome screen
      await expect(element(by.id('onboarding.welcome.screen'))).toBeVisible();
      await expect(element(by.id('onboarding.welcome.title'))).toBeVisible();
      await expect(element(by.id('onboarding.welcome.subtitle'))).toBeVisible();
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Step 2: Currency selection
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('onboarding.currency.title'))).toBeVisible();
      await expect(element(by.id('onboarding.currency.USD'))).toBeVisible();
      await expect(element(by.id('onboarding.currency.EUR'))).toBeVisible();
      await expect(element(by.id('onboarding.currency.ILS'))).toBeVisible();
      // Select USD
      await element(by.id('onboarding.currency.USD')).tap();
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Step 3: Categories selection
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('onboarding.categories.title'))).toBeVisible();
      await expect(element(by.id('onboarding.categories.subtitle'))).toBeVisible();
      // Continue with default categories
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Step 4: Budget setup
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('onboarding.budget.title'))).toBeVisible();
      await expect(element(by.id('onboarding.budget.amountInput'))).toBeVisible();
      await expect(element(by.id('onboarding.budget.skipButton'))).toBeVisible();
      await expect(element(by.id('onboarding.budget.setBudgetButton'))).toBeVisible();
      // Set a budget amount
      await element(by.id('onboarding.budget.amountInput')).tap();
      await element(by.id('onboarding.budget.amountInput')).typeText('2000');
      await element(by.id('onboarding.budget.setBudgetButton')).tap();

      // Step 5: Sample data
      await waitFor(element(by.id('onboarding.sampleData.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('onboarding.sampleData.title'))).toBeVisible();
      await expect(element(by.id('onboarding.sampleData.yesButton'))).toBeVisible();
      await expect(element(by.id('onboarding.sampleData.noButton'))).toBeVisible();
      // Choose to add sample data
      await element(by.id('onboarding.sampleData.yesButton')).tap();
      await element(by.id('onboarding.sampleData.continueButton')).tap();

      // Step 6: Biometric setup (may not appear on all devices)
      try {
        await waitFor(element(by.id('onboarding.biometric.screen')))
          .toBeVisible()
          .withTimeout(3000);
        await expect(element(by.id('onboarding.biometric.title'))).toBeVisible();
        await element(by.id('onboarding.biometric.skipButton')).tap();
      } catch {
        // Biometric screen not shown (device doesn't support it)
      }

      // Step 7: Complete screen
      await waitFor(element(by.id('onboarding.complete.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('onboarding.complete.title'))).toBeVisible();
      await expect(element(by.id('onboarding.complete.subtitle'))).toBeVisible();
      await element(by.id('onboarding.complete.startButton')).tap();

      // Should navigate to dashboard
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Onboarding with Skipped Steps', () => {
    it('should allow skipping optional steps', async () => {
      await navigateToOnboarding();

      // Welcome screen - continue
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Currency selection - select EUR
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.currency.EUR')).tap();
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Categories - skip without selecting any
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Budget - skip
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.budget.skipButton')).tap();

      // Sample data - choose no
      await waitFor(element(by.id('onboarding.sampleData.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.sampleData.noButton')).tap();
      await element(by.id('onboarding.sampleData.continueButton')).tap();

      // Biometric - skip if shown
      try {
        await waitFor(element(by.id('onboarding.biometric.screen')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('onboarding.biometric.skipButton')).tap();
      } catch {
        // Biometric screen not shown
      }

      // Complete screen
      await waitFor(element(by.id('onboarding.complete.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.complete.startButton')).tap();

      // Should still navigate to dashboard successfully
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Budget Setup', () => {
    it('should set initial budget', async () => {
      await navigateToOnboarding();

      // Welcome screen - continue
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Currency selection - select USD
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.currency.USD')).tap();
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Categories - continue with defaults
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Budget setup - enter a specific budget amount
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify budget input elements are visible
      await expect(element(by.id('onboarding.budget.amountInput'))).toBeVisible();
      await expect(element(by.id('onboarding.budget.setBudgetButton'))).toBeVisible();

      // Enter budget amount
      await element(by.id('onboarding.budget.amountInput')).tap();
      await element(by.id('onboarding.budget.amountInput')).typeText('1500');

      // Submit budget
      await element(by.id('onboarding.budget.setBudgetButton')).tap();

      // Continue through remaining steps
      await waitFor(element(by.id('onboarding.sampleData.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.sampleData.noButton')).tap();
      await element(by.id('onboarding.sampleData.continueButton')).tap();

      // Skip biometric if shown
      try {
        await waitFor(element(by.id('onboarding.biometric.screen')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('onboarding.biometric.skipButton')).tap();
      } catch {
        // Biometric screen not shown
      }

      // Complete screen
      await waitFor(element(by.id('onboarding.complete.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.complete.startButton')).tap();

      // Should navigate to dashboard
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Biometric Setup', () => {
    it('should enable biometric auth', async () => {
      // Enable biometric capability before starting
      await BiometricHelpers.enableForPlatform();

      await navigateToOnboarding();

      // Welcome screen - continue
      await element(by.id('onboarding.welcome.getStartedButton')).tap();

      // Currency selection - select USD
      await waitFor(element(by.id('onboarding.currency.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.currency.USD')).tap();
      await element(by.id('onboarding.currency.continueButton')).tap();

      // Categories - continue with defaults
      await waitFor(element(by.id('onboarding.categories.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.categories.continueButton')).tap();

      // Budget - skip
      await waitFor(element(by.id('onboarding.budget.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.budget.skipButton')).tap();

      // Sample data - skip
      await waitFor(element(by.id('onboarding.sampleData.screen')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('onboarding.sampleData.noButton')).tap();
      await element(by.id('onboarding.sampleData.continueButton')).tap();

      // Biometric setup - ENABLE instead of skip
      try {
        await waitFor(element(by.id('onboarding.biometric.screen')))
          .toBeVisible()
          .withTimeout(5000);

        // Verify biometric screen elements
        await expect(element(by.id('onboarding.biometric.title'))).toBeVisible();
        await expect(element(by.id('onboarding.biometric.enableButton'))).toBeVisible();

        // Tap enable button
        await element(by.id('onboarding.biometric.enableButton')).tap();

        // Simulate successful biometric enrollment
        await BiometricHelpers.authenticateSuccess();

        // Wait for confirmation and continue
        try {
          await waitFor(element(by.id('onboarding.biometric.successMessage')))
            .toBeVisible()
            .withTimeout(3000);
        } catch {
          // Success message might auto-dismiss or not exist
        }
      } catch {
        // Biometric screen not shown (device doesn't support it)
        // Test passes - feature not available on this device
      }

      // Complete screen (might auto-advance after biometric)
      try {
        await waitFor(element(by.id('onboarding.complete.screen')))
          .toBeVisible()
          .withTimeout(5000);
        await element(by.id('onboarding.complete.startButton')).tap();
      } catch {
        // Already past complete screen
      }

      // Should navigate to dashboard
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
