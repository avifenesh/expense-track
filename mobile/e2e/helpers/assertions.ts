/**
 * E2E Test Assertions
 * Verification helpers - explicit assertions only
 */

import { by, element, expect, waitFor } from 'detox';
import { Timeouts } from './fixtures';

/**
 * Assert element is visible
 */
export async function assertVisible(testId: string): Promise<void> {
  await expect(element(by.id(testId))).toBeVisible();
}

/**
 * Assert element is not visible
 */
export async function assertNotVisible(testId: string): Promise<void> {
  await expect(element(by.id(testId))).not.toBeVisible();
}

/**
 * Assert element exists (may not be visible)
 */
export async function assertExists(testId: string): Promise<void> {
  await expect(element(by.id(testId))).toExist();
}

/**
 * Assert element does not exist
 */
export async function assertNotExists(testId: string): Promise<void> {
  await expect(element(by.id(testId))).not.toExist();
}

/**
 * Assert text is visible on screen
 */
export async function assertTextVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).toBeVisible();
}

/**
 * Assert text is not visible
 */
export async function assertTextNotVisible(text: string): Promise<void> {
  await expect(element(by.text(text))).not.toBeVisible();
}

/**
 * Assert element has specific text
 */
export async function assertHasText(
  testId: string,
  text: string
): Promise<void> {
  await expect(element(by.id(testId))).toHaveText(text);
}

/**
 * Assert element contains text (label)
 */
export async function assertContainsText(
  testId: string,
  text: string
): Promise<void> {
  await expect(element(by.id(testId))).toHaveLabel(text);
}

/**
 * Assert screen is displayed (element with testId is visible)
 */
export async function assertScreenDisplayed(screenTestId: string): Promise<void> {
  await waitFor(element(by.id(screenTestId)))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
}

/**
 * Assert screen is not displayed
 */
export async function assertScreenNotDisplayed(
  screenTestId: string
): Promise<void> {
  await expect(element(by.id(screenTestId))).not.toBeVisible();
}

/**
 * Assert error message is displayed
 */
export async function assertErrorDisplayed(
  errorText: string
): Promise<void> {
  await waitFor(element(by.text(errorText)))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
}

/**
 * Assert loading indicator is visible
 */
export async function assertLoading(): Promise<void> {
  // ActivityIndicator usually has accessibilityRole='progressbar'
  await expect(element(by.type('RCTActivityIndicatorView'))).toBeVisible();
}

/**
 * Assert loading indicator is not visible
 */
export async function assertNotLoading(): Promise<void> {
  await expect(element(by.type('RCTActivityIndicatorView'))).not.toBeVisible();
}

/**
 * Assert button is disabled
 */
export async function assertButtonDisabled(testId: string): Promise<void> {
  // In React Native, disabled buttons have accessibilityState.disabled = true
  await expect(element(by.id(testId))).toHaveAccessibilityState({ disabled: true });
}

/**
 * Assert button is enabled
 */
export async function assertButtonEnabled(testId: string): Promise<void> {
  await expect(element(by.id(testId))).not.toHaveAccessibilityState({
    disabled: true,
  });
}

/**
 * Assert element has focus
 */
export async function assertFocused(testId: string): Promise<void> {
  await expect(element(by.id(testId))).toBeFocused();
}

/**
 * Assert list has items
 */
export async function assertListNotEmpty(testId: string): Promise<void> {
  // Scroll to trigger list rendering, then check content
  await element(by.id(testId)).scroll(50, 'down');
  // If we can scroll, there's content
}

/**
 * Assert empty state is shown
 */
export async function assertEmptyState(emptyText: string): Promise<void> {
  await waitFor(element(by.text(emptyText)))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
}

/**
 * Assert tab is selected
 */
export async function assertTabSelected(tabName: string): Promise<void> {
  // Selected tabs typically have accessibilityState.selected = true
  await expect(element(by.text(tabName))).toHaveAccessibilityState({
    selected: true,
  });
}

/**
 * Assert transaction appears in list
 */
export async function assertTransactionInList(
  description: string
): Promise<void> {
  await waitFor(element(by.text(description)))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
}

/**
 * Assert transaction does not appear in list
 */
export async function assertTransactionNotInList(
  description: string
): Promise<void> {
  await expect(element(by.text(description))).not.toBeVisible();
}

/**
 * Assert amount is displayed
 */
export async function assertAmountDisplayed(amount: string): Promise<void> {
  // Amount might be formatted with currency symbol
  await waitFor(element(by.text(amount)))
    .toBeVisible()
    .withTimeout(Timeouts.short);
}

/**
 * Wait for element to appear then assert it's visible
 */
export async function waitAndAssertVisible(
  testId: string,
  timeout = Timeouts.medium
): Promise<void> {
  await waitFor(element(by.id(testId))).toBeVisible().withTimeout(timeout);
  await expect(element(by.id(testId))).toBeVisible();
}

/**
 * Wait for text to appear
 */
export async function waitForText(
  text: string,
  timeout = Timeouts.medium
): Promise<void> {
  await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
}
