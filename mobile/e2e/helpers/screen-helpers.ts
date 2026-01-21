import { by, element, expect, waitFor, device } from 'detox';

/**
 * Screen Helpers for E2E Tests
 *
 * Common screen navigation and interaction utilities.
 */

/**
 * Wait for a screen to be visible
 */
export async function waitForScreen(screenId: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.id(`${screenId}.screen`)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Navigate to a tab in the bottom navigation
 */
export async function navigateToTab(
  tabName: 'dashboard' | 'transactions' | 'budgets' | 'sharing' | 'settings'
): Promise<void> {
  await element(by.id(`tab.${tabName}`)).tap();
  await waitForScreen(tabName);
}

/**
 * Pull to refresh on a screen
 * Uses scroll with valid numeric parameters (not NaN)
 */
export async function pullToRefresh(scrollViewId: string): Promise<void> {
  await element(by.id(scrollViewId)).scroll(100, 'down', 0.5, 0.5, 0.85);
}

/**
 * Scroll to a specific element
 */
export async function scrollToElement(
  scrollViewId: string,
  elementId: string,
  direction: 'up' | 'down' = 'down'
): Promise<void> {
  await waitFor(element(by.id(elementId)))
    .toBeVisible()
    .whileElement(by.id(scrollViewId))
    .scroll(200, direction);
}

/**
 * Tap an element and wait for a result
 */
export async function tapAndWait(
  tapElementId: string,
  waitElementId: string,
  timeout = 5000
): Promise<void> {
  await element(by.id(tapElementId)).tap();
  await waitFor(element(by.id(waitElementId)))
    .toBeVisible()
    .withTimeout(timeout);
}

/**
 * Type text into an input field
 */
export async function typeInField(fieldId: string, text: string): Promise<void> {
  await element(by.id(fieldId)).tap();
  await element(by.id(fieldId)).clearText();
  await element(by.id(fieldId)).typeText(text);
}

/**
 * Clear and retype text in a field
 */
export async function replaceText(fieldId: string, text: string): Promise<void> {
  await element(by.id(fieldId)).tap();
  await element(by.id(fieldId)).clearText();
  await element(by.id(fieldId)).typeText(text);
}

/**
 * Select an option from a picker/select component
 */
export async function selectOption(selectId: string, optionValue: string): Promise<void> {
  // Tap to open the select
  await element(by.id(`${selectId}.trigger`)).tap();

  // Wait for modal/dropdown
  await waitFor(element(by.id(`${selectId}.modal`)))
    .toBeVisible()
    .withTimeout(3000);

  // Select the option
  await element(by.id(`${selectId}.option.${optionValue}`)).tap();
}

/**
 * Check if an element exists on screen
 */
export async function elementExists(elementId: string): Promise<boolean> {
  try {
    await expect(element(by.id(elementId))).toExist();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an element is visible
 */
export async function elementIsVisible(elementId: string): Promise<boolean> {
  try {
    await expect(element(by.id(elementId))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for loading indicator to disappear
 */
export async function waitForLoadingToFinish(loadingId = 'loading.indicator'): Promise<void> {
  await waitFor(element(by.id(loadingId)))
    .not.toBeVisible()
    .withTimeout(10000);
}

/**
 * Dismiss keyboard if open
 * Note: device.pressBack() only works on Android
 */
export async function dismissKeyboard(): Promise<void> {
  if (device.getPlatform() === 'android') {
    await device.pressBack();
  }
  // On iOS, keyboard dismissal should be handled by the specific test
  // (e.g., tapping a background element or using tapReturnKey)
}

/**
 * Get element text (for assertions)
 */
export async function getElementText(elementId: string): Promise<string> {
  const attributes = await element(by.id(elementId)).getAttributes();
  // @ts-expect-error - Detox types don't include text property
  return attributes.text || attributes.label || '';
}

/**
 * Swipe to delete an item in a list
 */
export async function swipeToDelete(itemId: string): Promise<void> {
  await element(by.id(itemId)).swipe('left', 'fast');

  // Tap delete button if it appears
  try {
    await element(by.id(`${itemId}.deleteButton`)).tap();
  } catch {
    // Delete may happen automatically on swipe
  }
}

/**
 * Long press on an element
 */
export async function longPress(elementId: string, duration = 1000): Promise<void> {
  await element(by.id(elementId)).longPress(duration);
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

/**
 * Wait for element to have specific text
 */
export async function waitForText(
  elementId: string,
  expectedText: string,
  timeout = 5000
): Promise<void> {
  await waitFor(element(by.id(elementId)))
    .toHaveText(expectedText)
    .withTimeout(timeout);
}

/**
 * Verify toast message appears
 */
export async function expectToast(message: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.text(message)))
    .toBeVisible()
    .withTimeout(timeout);
}
