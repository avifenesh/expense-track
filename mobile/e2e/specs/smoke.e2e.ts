/**
 * Smoke Tests
 * Basic app launch and screen rendering
 * Contracts: App launches, screens render correctly
 */

import { device } from 'detox';
import {
  TestIDs,
  waitForAppReady,
  assertScreenDisplayed,
} from '../helpers';

describe('Smoke Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  it('app launches and shows login screen', async () => {
    // Contract: App launch shows login screen for unauthenticated user
    await waitForAppReady();
    await assertScreenDisplayed(TestIDs.login.screen);
  });

  it('login screen has required elements', async () => {
    // Contract: LoginScreen has email, password, submit, and navigation links
    await waitForAppReady();
    await assertScreenDisplayed(TestIDs.login.screen);
    await assertScreenDisplayed(TestIDs.login.emailInput);
    await assertScreenDisplayed(TestIDs.login.passwordInput);
    await assertScreenDisplayed(TestIDs.login.submitButton);
  });
});
