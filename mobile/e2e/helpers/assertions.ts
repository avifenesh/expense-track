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
 * Assert screen is displayed (element with testId is visible)
 */
export async function assertScreenDisplayed(
  screenTestId: string
): Promise<void> {
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
export async function assertErrorDisplayed(errorText: string): Promise<void> {
  await waitFor(element(by.text(errorText)))
    .toBeVisible()
    .withTimeout(Timeouts.medium);
}

/**
 * Assert element has focus
 */
export async function assertFocused(testId: string): Promise<void> {
  await expect(element(by.id(testId))).toBeFocused();
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
