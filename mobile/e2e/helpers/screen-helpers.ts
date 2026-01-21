import { by, element, expect, waitFor, device } from 'detox';


export async function waitForScreen(screenId: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.id(`${screenId}.screen`)))
    .toBeVisible()
    .withTimeout(timeout);
}

export async function navigateToTab(
  tabName: 'dashboard' | 'transactions' | 'budgets' | 'sharing' | 'settings'
): Promise<void> {
  await element(by.id(`tab.${tabName}`)).tap();
  await waitForScreen(tabName);
}

export async function pullToRefresh(scrollViewId: string): Promise<void> {
  await element(by.id(scrollViewId)).scroll(100, 'down', 0.5, 0.5, 0.85);
}

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

export async function typeInField(fieldId: string, text: string): Promise<void> {
  await element(by.id(fieldId)).tap();
  await element(by.id(fieldId)).clearText();
  await element(by.id(fieldId)).typeText(text);
}

export async function replaceText(fieldId: string, text: string): Promise<void> {
  await element(by.id(fieldId)).tap();
  await element(by.id(fieldId)).clearText();
  await element(by.id(fieldId)).typeText(text);
}

export async function selectOption(selectId: string, optionValue: string): Promise<void> {
  await element(by.id(`${selectId}.trigger`)).tap();

  await waitFor(element(by.id(`${selectId}.modal`)))
    .toBeVisible()
    .withTimeout(3000);

  await element(by.id(`${selectId}.option.${optionValue}`)).tap();
}

export async function elementExists(elementId: string): Promise<boolean> {
  try {
    await expect(element(by.id(elementId))).toExist();
    return true;
  } catch {
    return false;
  }
}

export async function elementIsVisible(elementId: string): Promise<boolean> {
  try {
    await expect(element(by.id(elementId))).toBeVisible();
    return true;
  } catch {
    return false;
  }
}

export async function waitForLoadingToFinish(loadingId = 'loading.indicator'): Promise<void> {
  await waitFor(element(by.id(loadingId)))
    .not.toBeVisible()
    .withTimeout(10000);
}

export async function dismissKeyboard(): Promise<void> {
  if (device.getPlatform() === 'android') {
    await device.pressBack();
  }
  // (e.g., tapping a background element or using tapReturnKey)
}

export async function getElementText(elementId: string): Promise<string> {
  const attributes = await element(by.id(elementId)).getAttributes();
  // @ts-expect-error - Detox types don't include text property
  return attributes.text || attributes.label || '';
}

export async function swipeToDelete(itemId: string): Promise<void> {
  await element(by.id(itemId)).swipe('left', 'fast');

  try {
    await element(by.id(`${itemId}.deleteButton`)).tap();
  } catch {
    }
}

export async function longPress(elementId: string, duration = 1000): Promise<void> {
  await element(by.id(elementId)).longPress(duration);
}

export async function takeScreenshot(name: string): Promise<void> {
  await device.takeScreenshot(name);
}

export async function waitForText(
  elementId: string,
  expectedText: string,
  timeout = 5000
): Promise<void> {
  await waitFor(element(by.id(elementId)))
    .toHaveText(expectedText)
    .withTimeout(timeout);
}

export async function expectToast(message: string, timeout = 5000): Promise<void> {
  await waitFor(element(by.text(message)))
    .toBeVisible()
    .withTimeout(timeout);
}
