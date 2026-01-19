import { by, element, expect, waitFor } from 'detox';

/**
 * Element Helpers for E2E Tests
 *
 * Custom element matchers and assertion utilities for common UI patterns.
 */

/**
 * Form validation helpers
 */
export const FormHelpers = {
  /**
   * Check if a form field has an error state
   */
  async hasError(fieldId: string): Promise<boolean> {
    try {
      await expect(element(by.id(`${fieldId}-error`))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get error message for a form field
   */
  async getErrorMessage(fieldId: string): Promise<string> {
    const attributes = await element(by.id(`${fieldId}-error`)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.text || '';
  },

  /**
   * Fill multiple form fields
   */
  async fillForm(fields: Record<string, string>): Promise<void> {
    for (const [fieldId, value] of Object.entries(fields)) {
      await element(by.id(fieldId)).tap();
      await element(by.id(fieldId)).clearText();
      await element(by.id(fieldId)).typeText(value);
    }
  },

  /**
   * Verify form field has specific value
   */
  async hasValue(fieldId: string, expectedValue: string): Promise<void> {
    await expect(element(by.id(fieldId))).toHaveText(expectedValue);
  },
};

/**
 * List/collection helpers
 */
export const ListHelpers = {
  /**
   * Get count of list items
   */
  async getItemCount(listId: string): Promise<number> {
    // Note: Detox doesn't have a direct way to count elements
    // This is a workaround using attributes
    const attributes = await element(by.id(listId)).getAttributes();
    // @ts-expect-error - implementation depends on RN version
    return attributes.elements?.length || 0;
  },

  /**
   * Check if list is empty (shows empty state)
   */
  async isEmpty(emptyStateId: string): Promise<boolean> {
    try {
      await expect(element(by.id(emptyStateId))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Tap the nth item in a list
   */
  async tapItem(listId: string, index: number): Promise<void> {
    await element(by.id(`${listId}.item.${index}`)).tap();
  },

  /**
   * Scroll to item in list
   */
  async scrollToItem(listId: string, index: number): Promise<void> {
    await waitFor(element(by.id(`${listId}.item.${index}`)))
      .toBeVisible()
      .whileElement(by.id(listId))
      .scroll(200, 'down');
  },
};

/**
 * Button/action helpers
 */
export const ButtonHelpers = {
  /**
   * Check if a button is enabled
   */
  async isEnabled(buttonId: string): Promise<boolean> {
    const attributes = await element(by.id(buttonId)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.enabled !== false;
  },

  /**
   * Check if a button shows loading state
   */
  async isLoading(buttonId: string): Promise<boolean> {
    try {
      await expect(element(by.id(`${buttonId}-loading`))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Tap button and wait for loading to finish
   */
  async tapAndWaitForComplete(buttonId: string, timeout = 10000): Promise<void> {
    await element(by.id(buttonId)).tap();

    // Wait for loading to appear then disappear
    try {
      await waitFor(element(by.id(`${buttonId}-loading`)))
        .toBeVisible()
        .withTimeout(1000);
      await waitFor(element(by.id(`${buttonId}-loading`)))
        .not.toBeVisible()
        .withTimeout(timeout);
    } catch {
      // Loading may have been too fast to catch
    }
  },
};

/**
 * Dialog/modal helpers
 */
export const DialogHelpers = {
  /**
   * Wait for dialog to appear
   */
  async waitForDialog(dialogId: string, timeout = 5000): Promise<void> {
    await waitFor(element(by.id(`${dialogId}.dialog`)))
      .toBeVisible()
      .withTimeout(timeout);
  },

  /**
   * Confirm a dialog
   */
  async confirm(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.confirmButton`)).tap();
  },

  /**
   * Cancel a dialog
   */
  async cancel(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.cancelButton`)).tap();
  },

  /**
   * Dismiss dialog by tapping outside
   */
  async dismiss(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.backdrop`)).tap();
  },
};

/**
 * Tab navigation helpers
 */
export const TabHelpers = {
  /**
   * Check which tab is active
   */
  async getActiveTab(): Promise<string> {
    const tabs = ['dashboard', 'transactions', 'budgets', 'sharing', 'settings'];

    for (const tab of tabs) {
      try {
        const attributes = await element(by.id(`tab.${tab}`)).getAttributes();
        // @ts-expect-error - platform specific
        if (attributes.selected || attributes.accessibilityState?.selected) {
          return tab;
        }
      } catch {
        // Tab not found or not accessible
      }
    }

    return 'unknown';
  },

  /**
   * Verify a specific tab is active
   */
  async isActive(tabName: string): Promise<boolean> {
    const activeTab = await this.getActiveTab();
    return activeTab === tabName;
  },
};

/**
 * Date/time picker helpers
 */
export const DatePickerHelpers = {
  /**
   * Open date picker
   */
  async open(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.trigger`)).tap();
    await waitFor(element(by.id(`${pickerId}.picker`)))
      .toBeVisible()
      .withTimeout(3000);
  },

  /**
   * Select today's date
   */
  async selectToday(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.todayButton`)).tap();
  },

  /**
   * Confirm date selection
   */
  async confirm(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.confirmButton`)).tap();
  },
};

/**
 * Currency/amount input helpers
 */
export const AmountHelpers = {
  /**
   * Enter an amount value
   */
  async enterAmount(fieldId: string, amount: string): Promise<void> {
    await element(by.id(fieldId)).tap();
    await element(by.id(fieldId)).clearText();
    await element(by.id(fieldId)).typeText(amount);
  },

  /**
   * Get formatted amount display
   */
  async getDisplayedAmount(fieldId: string): Promise<string> {
    const attributes = await element(by.id(fieldId)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.text || '';
  },
};
