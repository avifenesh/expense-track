import { by, element, expect, waitFor } from 'detox';


export const FormHelpers = {
  async hasError(fieldId: string): Promise<boolean> {
    try {
      await expect(element(by.id(`${fieldId}-error`))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  async getErrorMessage(fieldId: string): Promise<string> {
    const attributes = await element(by.id(`${fieldId}-error`)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.text || '';
  },

  async fillForm(fields: Record<string, string>): Promise<void> {
    for (const [fieldId, value] of Object.entries(fields)) {
      await element(by.id(fieldId)).tap();
      await element(by.id(fieldId)).clearText();
      await element(by.id(fieldId)).typeText(value);
    }
  },

  async hasValue(fieldId: string, expectedValue: string): Promise<void> {
    await expect(element(by.id(fieldId))).toHaveText(expectedValue);
  },
};

export const ListHelpers = {
  async getItemCount(listId: string): Promise<number> {
        const attributes = await element(by.id(listId)).getAttributes();
    // @ts-expect-error - implementation depends on RN version
    return attributes.elements?.length || 0;
  },

  async isEmpty(emptyStateId: string): Promise<boolean> {
    try {
      await expect(element(by.id(emptyStateId))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  async tapItem(listId: string, index: number): Promise<void> {
    await element(by.id(`${listId}.item.${index}`)).tap();
  },

  async scrollToItem(listId: string, index: number): Promise<void> {
    await waitFor(element(by.id(`${listId}.item.${index}`)))
      .toBeVisible()
      .whileElement(by.id(listId))
      .scroll(200, 'down');
  },
};

export const ButtonHelpers = {
  async isEnabled(buttonId: string): Promise<boolean> {
    const attributes = await element(by.id(buttonId)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.enabled !== false;
  },

  async isLoading(buttonId: string): Promise<boolean> {
    try {
      await expect(element(by.id(`${buttonId}-loading`))).toBeVisible();
      return true;
    } catch {
      return false;
    }
  },

  async tapAndWaitForComplete(buttonId: string, timeout = 10000): Promise<void> {
    await element(by.id(buttonId)).tap();

      try {
      await waitFor(element(by.id(`${buttonId}-loading`)))
        .toBeVisible()
        .withTimeout(1000);
      await waitFor(element(by.id(`${buttonId}-loading`)))
        .not.toBeVisible()
        .withTimeout(timeout);
    } catch {
        }
  },
};

export const DialogHelpers = {
  async waitForDialog(dialogId: string, timeout = 5000): Promise<void> {
    await waitFor(element(by.id(`${dialogId}.dialog`)))
      .toBeVisible()
      .withTimeout(timeout);
  },

  async confirm(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.confirmButton`)).tap();
  },

  async cancel(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.cancelButton`)).tap();
  },

  async dismiss(dialogId: string): Promise<void> {
    await element(by.id(`${dialogId}.backdrop`)).tap();
  },
};

export const TabHelpers = {
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
            }
    }

    return 'unknown';
  },

  async isActive(tabName: string): Promise<boolean> {
    const activeTab = await this.getActiveTab();
    return activeTab === tabName;
  },
};

export const DatePickerHelpers = {
  async open(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.trigger`)).tap();
    await waitFor(element(by.id(`${pickerId}.picker`)))
      .toBeVisible()
      .withTimeout(3000);
  },

  async selectToday(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.todayButton`)).tap();
  },

  async confirm(pickerId: string): Promise<void> {
    await element(by.id(`${pickerId}.confirmButton`)).tap();
  },
};

export const AmountHelpers = {
  async enterAmount(fieldId: string, amount: string): Promise<void> {
    await element(by.id(fieldId)).tap();
    await element(by.id(fieldId)).clearText();
    await element(by.id(fieldId)).typeText(amount);
  },

  async getDisplayedAmount(fieldId: string): Promise<string> {
    const attributes = await element(by.id(fieldId)).getAttributes();
    // @ts-expect-error - Detox types
    return attributes.text || '';
  },
};
