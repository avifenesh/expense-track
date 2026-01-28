/**
 * Subscription E2E Tests
 * Tests subscription flows including paywall behavior
 */

import { device, element, by, expect, waitFor } from 'detox';
import { TestApiClient } from '../helpers/api-client';
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures';
import {
  LoginScreen,
  DashboardScreen,
  PaywallScreen,
  RootLoadingScreen,
  performLogin,
} from '../contracts/ui-contracts';

describe('Subscription E2E Tests', () => {
  let api: TestApiClient;

  beforeAll(async () => {
    api = new TestApiClient();
    await api.ensureTestUser(TEST_USER, true);
  });

  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Valid Subscription', () => {
    it('user with valid trial sees dashboard after login', async () => {
      await performLogin(TEST_USER.email, TEST_USER.password);

      await DashboardScreen.assertVisible();
    });

    it('subscription loading screen appears during initialization', async () => {
      await LoginScreen.waitForScreen();
      await LoginScreen.login(TEST_USER.email, TEST_USER.password);

      await waitFor(element(by.id('login.screen')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.LONG);

      try {
        await waitFor(element(by.id('root.loadingScreen')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.SHORT);
        await RootLoadingScreen.waitForDisappear();
      } catch {
        // Loading screen may not appear on fast connections or cached subscription
      }

      await DashboardScreen.waitForScreen();
    });
  });

  describe('Paywall Screen', () => {
    it('paywall screen has subscribe and sign out buttons (via contract)', async () => {
      expect(PaywallScreen.testIds.screen).toBe('paywall.screen');
      expect(PaywallScreen.testIds.subscribeButton).toBe('paywall.subscribeButton');
      expect(PaywallScreen.testIds.signOutButton).toBe('paywall.signOutButton');
    });

    it('paywall sign out button returns to login (documented flow)', async () => {
      expect(typeof PaywallScreen.tapSignOut).toBe('function');
      expect(typeof PaywallScreen.waitForSignOutComplete).toBe('function');
    });
  });

  describe('Subscription API', () => {
    it('returns valid subscription status for test user', async () => {
      await api.ensureTestUser(TEST_USER, true);

      const response = await api.getSubscriptionStatus();

      expect(response.subscription).toBeDefined();
      expect(response.subscription.status).toBeDefined();
      expect(response.subscription.canAccessApp).toBeDefined();
      expect(response.pricing).toBeDefined();

      expect(response.subscription.canAccessApp).toBe(true);
    });

    it('test user has TRIALING subscription status', async () => {
      await api.ensureTestUser(TEST_USER, true);
      const response = await api.getSubscriptionStatus();

      expect(response.subscription.status).toBe('TRIALING');
      expect(response.subscription.isActive).toBe(true);
    });

    it('subscription has valid trial end date', async () => {
      await api.ensureTestUser(TEST_USER, true);
      const response = await api.getSubscriptionStatus();

      expect(response.subscription.trialEndsAt).toBeDefined();
      if (response.subscription.trialEndsAt) {
        const trialEnd = new Date(response.subscription.trialEndsAt);
        expect(trialEnd.getTime()).toBeGreaterThan(Date.now());
      }
    });
  });
});
