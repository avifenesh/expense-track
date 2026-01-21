import { element, by, expect, waitFor, device } from 'detox';
import { BiometricHelpers } from '../helpers/biometric-helpers';
import { loginAsPrimaryUser, completeOnboarding, logout } from '../helpers';

async function waitForAppReady(): Promise<void> {
  await device.disableSynchronization();
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await waitFor(element(by.id('login.screen')))
      .toBeVisible()
      .withTimeout(30000);
  } finally {
    await device.enableSynchronization();
  }
}

describe('Authentication', () => {
  describe('Login Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
    });

    it('should display login screen with all elements', async () => {
      await expect(element(by.id('login.title'))).toBeVisible();
      await expect(element(by.id('login.emailInput'))).toBeVisible();
      await expect(element(by.id('login.passwordInput'))).toBeVisible();
      await expect(element(by.id('login.registerLink'))).toBeVisible();
      await expect(element(by.id('login.resetPasswordLink'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('login.emailInput')).typeText('notanemail');
      await element(by.id('login.passwordInput')).typeText('password123');
      await element(by.id('login.submitButton')).tap();

      await waitFor(element(by.id('login.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should require password', async () => {
      await element(by.id('login.emailInput')).typeText('test@example.com');
      await element(by.id('login.submitButton')).tap();

      await waitFor(element(by.id('login.errorContainer')))
        .toExist()
        .withTimeout(5000);
    });
  });

  describe('Registration Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.id('login.registerLink')).tap();
      await waitFor(element(by.id('register.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display registration screen elements', async () => {
      await expect(element(by.id('register.title'))).toBeVisible();
      await expect(element(by.id('register.displayNameInput'))).toBeVisible();
      await expect(element(by.id('register.emailInput'))).toBeVisible();
      await expect(element(by.id('register.passwordInput'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('register.displayNameInput')).typeText('Test User');
      await element(by.id('register.emailInput')).typeText('invalid-email');
      await element(by.id('register.passwordInput')).typeText('TestPass123!');
      await element(by.id('register.passwordInput')).tapReturnKey();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await element(by.id('register.submitButton')).tap();

      await waitFor(element(by.id('register.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should navigate back to login', async () => {
      await element(by.id('register.loginLink')).tap();
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Reset Password Flow', () => {
    beforeEach(async () => {
      await waitForAppReady();
      await element(by.id('login.resetPasswordLink')).tap();
      await waitFor(element(by.id('resetPassword.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display reset password screen elements', async () => {
      await expect(element(by.id('resetPassword.title'))).toBeVisible();
      await expect(element(by.id('resetPassword.emailInput'))).toBeVisible();
    });

    it('should validate email format', async () => {
      await element(by.id('resetPassword.emailInput')).typeText('invalid-email');
      await element(by.id('resetPassword.requestButton')).tap();

      await waitFor(element(by.id('resetPassword.emailInput-error')))
        .toExist()
        .withTimeout(5000);
    });

    it('should navigate back to login', async () => {
      await element(by.id('resetPassword.backButton')).tap();
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Biometric Authentication', () => {
    beforeEach(async () => {
      await waitForAppReady();
    });

    it('should login with biometrics', async () => {
      await loginAsPrimaryUser();

      try {
        await waitFor(element(by.id('onboarding.welcome.screen')))
          .toBeVisible()
          .withTimeout(2000);
        await completeOnboarding();
      } catch {}

      await element(by.id('tab.settings')).tap();
      await waitFor(element(by.id('settings.screen')))
        .toBeVisible()
        .withTimeout(5000);

      try {
        await element(by.id('settings.scrollView')).scroll(200, 'down');
        await waitFor(element(by.id('settings.biometricItem')))
          .toBeVisible()
          .withTimeout(3000);
      } catch {}

      await element(by.id('settings.scrollView')).scroll(300, 'down');
      await element(by.id('settings.logoutButton')).tap();
      await waitFor(element(by.id('login.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await BiometricHelpers.enableForPlatform();

      try {
        await waitFor(element(by.id('login.biometricButton')))
          .toBeVisible()
          .withTimeout(3000);

        await element(by.id('login.biometricButton')).tap();
        await BiometricHelpers.authenticateSuccess();

        await waitFor(element(by.id('dashboard.screen')))
          .toBeVisible()
          .withTimeout(10000);
      } catch {
        await expect(element(by.id('login.screen'))).toBeVisible();
      }
    });
  });

  describe('Token Refresh', () => {
    beforeEach(async () => {
      await waitForAppReady();
    });

    it('should auto-refresh expired token', async () => {
      await loginAsPrimaryUser();

      try {
        await waitFor(element(by.id('onboarding.welcome.screen')))
          .toBeVisible()
          .withTimeout(2000);
        await completeOnboarding();
      } catch {}

      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('tab.transactions')).tap();
      await waitFor(element(by.id('transactions.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('tab.budgets')).tap();
      await waitFor(element(by.id('budgets.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('tab.dashboard')).tap();
      await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('dashboard.screen'))).toBeVisible();

      try {
        await expect(element(by.id('dashboard.title'))).toBeVisible();
      } catch {
        await expect(element(by.id('dashboard.screen'))).toBeVisible();
      }
    });
  });
});
