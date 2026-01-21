import { by, element, expect, waitFor } from 'detox';
import { TEST_USERS } from './fixtures';


export async function loginAsPrimaryUser(): Promise<void> {
  await login(TEST_USERS.primary.email, TEST_USERS.primary.password);
}

export async function loginAsSecondaryUser(): Promise<void> {
  await login(TEST_USERS.secondary.email, TEST_USERS.secondary.password);
}

export async function login(email: string, password: string): Promise<void> {
  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(10000);

  await element(by.id('login.emailInput')).tap();
  await element(by.id('login.emailInput')).typeText(email);

  await element(by.id('login.passwordInput')).tap();
  await element(by.id('login.passwordInput')).typeText(password);

  await element(by.id('login.passwordInput')).tapReturnKey();

  await element(by.id('login.submitButton')).tap();

  try {
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(30000);
  } catch {
      try {
      await waitFor(element(by.id('onboarding.welcome.screen')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
              await waitFor(element(by.id('dashboard.screen')))
        .toBeVisible()
        .withTimeout(15000);
    }
  }
}

export async function logout(): Promise<void> {
  await element(by.id('tab.settings')).tap();

  await waitFor(element(by.id('settings.screen')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('settings.scrollView')).scroll(300, 'down');

  await element(by.id('settings.logoutButton')).tap();

  try {
    await waitFor(element(by.id('dialog.confirmButton')))
      .toBeVisible()
      .withTimeout(2000);
    await element(by.id('dialog.confirmButton')).tap();
  } catch {
    }

  await waitFor(element(by.id('login.screen')))
    .toBeVisible()
    .withTimeout(5000);
}

export async function registerUser(
  displayName: string,
  email: string,
  password: string
): Promise<void> {
  await element(by.id('login.registerLink')).tap();

  await waitFor(element(by.id('register.screen')))
    .toBeVisible()
    .withTimeout(5000);

  await element(by.id('register.displayNameInput')).tap();
  await element(by.id('register.displayNameInput')).typeText(displayName);

  await element(by.id('register.emailInput')).tap();
  await element(by.id('register.emailInput')).typeText(email);

  await element(by.id('register.passwordInput')).tap();
  await element(by.id('register.passwordInput')).typeText(password);
  await element(by.id('register.passwordInput')).tapReturnKey();

  await element(by.id('register.submitButton')).tap();

  try {
    await waitFor(element(by.id('verifyEmail.screen')))
      .toBeVisible()
      .withTimeout(15000);
  } catch {
    await waitFor(element(by.id('onboarding.welcome.screen')))
      .toBeVisible()
      .withTimeout(5000);
  }
}

export async function isLoggedIn(): Promise<boolean> {
  try {
    await expect(element(by.id('dashboard.screen'))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

export async function ensureLoggedOut(): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await logout();
  }
}

export async function completeOnboarding(): Promise<void> {
  await waitFor(element(by.id('onboarding.welcome.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.welcome.getStartedButton')).tap();

  await waitFor(element(by.id('onboarding.currency.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.currency.USD')).tap();
  await element(by.id('onboarding.currency.continueButton')).tap();

  await waitFor(element(by.id('onboarding.categories.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.categories.continueButton')).tap();

  await waitFor(element(by.id('onboarding.budget.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.budget.skipButton')).tap();

  await waitFor(element(by.id('onboarding.sampleData.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.sampleData.continueButton')).tap();

  await waitFor(element(by.id('onboarding.complete.screen')))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.id('onboarding.complete.startButton')).tap();

  try {
    await waitFor(element(by.id('onboarding.biometric.screen')))
      .toBeVisible()
      .withTimeout(3000);
    await element(by.id('onboarding.biometric.skipButton')).tap();
  } catch {
    }

  await waitFor(element(by.id('dashboard.screen')))
    .toBeVisible()
    .withTimeout(5000);
}
