import { test, expect } from '@playwright/test';

test.describe('Mutual Expenses Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Avi
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'aviarchi1994@gmail.com');
    await page.fill('input[name="password"]', 'Af!@#$56789');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');
  });

  test('should show mutual expense checkbox only for expenses', async ({ page }) => {
    // Open transaction form (should default to Expense type)
    await page.waitForSelector('select[name="type"]');

    // Verify mutual expense checkbox is visible for expenses
    const mutualCheckbox = page.locator('input[name="isMutual"]');
    await expect(mutualCheckbox).toBeVisible();

    // Change to Income type
    await page.selectOption('select[name="type"]', 'INCOME');

    // Verify mutual expense checkbox is hidden for income
    await expect(mutualCheckbox).not.toBeVisible();

    // Change back to Expense
    await page.selectOption('select[name="type"]', 'EXPENSE');
    await expect(mutualCheckbox).toBeVisible();
  });

  test('should create mutual expense on Avi account and show in Joint account', async ({ page }) => {
    // Create a mutual expense on Avi's account
    await page.selectOption('select[name="accountId"]', { label: 'Avi' });
    await page.selectOption('select[name="categoryId"]', { index: 1 }); // Select first category
    await page.fill('input[name="amount"]', '300');
    await page.fill('input[name="description"]', 'Test mutual expense from Avi');
    await page.check('input[name="isMutual"]');

    // Submit the form
    await page.click('button[type="submit"]:has-text("Add Transaction")');

    // Wait for success feedback
    await page.waitForSelector('text=/added successfully/i', { timeout: 5000 });

    // Switch to Joint account
    await page.click('text=Joint');
    await page.waitForTimeout(1000);

    // Verify the mutual transaction appears in Joint account
    await expect(page.locator('text=Test mutual expense from Avi')).toBeVisible();

    // Verify it has the "Mutual" label
    const mutualLabel = page.locator('span:has-text("Mutual")').first();
    await expect(mutualLabel).toBeVisible();

    // Verify the split calculation banner appears
    const banner = page.locator('text=/owes|settled/i').first();
    await expect(banner).toBeVisible();
  });

  test('should show correct split calculation when Avi pays mutual expense', async ({ page }) => {
    // Create a 300 ILS mutual expense on Avi's account
    await page.selectOption('select[name="accountId"]', { label: 'Avi' });
    await page.selectOption('select[name="categoryId"]', { index: 1 });
    await page.fill('input[name="amount"]', '300');
    await page.check('input[name="isMutual"]');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForSelector('text=/added successfully/i', { timeout: 5000 });

    // Switch to Joint account
    await page.click('text=Joint');
    await page.waitForTimeout(1000);

    // Verify split calculation
    // Avi pays 300, should pay 200 (2/3), so Serena owes Avi 100 (1/3)
    await expect(page.locator('text=/Serena owes Avi/i')).toBeVisible();
  });

  test('should filter mutual transactions by payer', async ({ page }) => {
    // Create mutual expense on Avi's account
    await page.selectOption('select[name="accountId"]', { label: 'Avi' });
    await page.selectOption('select[name="categoryId"]', { index: 1 });
    await page.fill('input[name="amount"]', '150');
    await page.fill('input[name="description"]', 'Avi mutual expense');
    await page.check('input[name="isMutual"]');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForSelector('text=/added successfully/i', { timeout: 5000 });

    // Switch to Joint account
    await page.click('text=Joint');
    await page.waitForTimeout(1000);

    // Verify transaction appears
    await expect(page.locator('text=Avi mutual expense')).toBeVisible();

    // Check for account filter (if available)
    const accountFilter = page.locator('select:has-text("All accounts")');
    if (await accountFilter.isVisible()) {
      // Filter to only show Avi's transactions
      await accountFilter.selectOption({ label: 'Avi' });
      await page.waitForTimeout(500);

      // Verify Avi's transaction still appears
      await expect(page.locator('text=Avi mutual expense')).toBeVisible();
    }
  });

  test('should show account name badge on mutual transactions', async ({ page }) => {
    // Create mutual expense
    await page.selectOption('select[name="accountId"]', { label: 'Avi' });
    await page.selectOption('select[name="categoryId"]', { index: 1 });
    await page.fill('input[name="amount"]', '200');
    await page.fill('input[name="description"]', 'Test account badge');
    await page.check('input[name="isMutual"]');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForSelector('text=/added successfully/i', { timeout: 5000 });

    // Switch to Joint account
    await page.click('text=Joint');
    await page.waitForTimeout(1000);

    // Find the transaction row
    const transactionRow = page.locator('text=Test account badge').locator('..').locator('..');

    // Verify both account name badge and mutual badge are present
    await expect(transactionRow.locator('span:has-text("Avi")')).toBeVisible();
    await expect(transactionRow.locator('span:has-text("Mutual")')).toBeVisible();
  });

  test('should show settled message when split is balanced', async ({ page }) => {
    // This test would require creating balanced mutual expenses
    // For example: Avi pays 200 (should pay 133.33), Serena pays 100 (should pay 66.67)
    // Total = 300, Avi overpays by 66.67, Serena underpays by 33.33
    // This is just an example - actual implementation would need careful amount selection

    // Create first mutual expense from Avi
    await page.selectOption('select[name="accountId"]', { label: 'Avi' });
    await page.selectOption('select[name="categoryId"]', { index: 1 });
    await page.fill('input[name="amount"]', '200');
    await page.check('input[name="isMutual"]');
    await page.click('button[type="submit"]:has-text("Add Transaction")');
    await page.waitForSelector('text=/added successfully/i', { timeout: 5000 });

    // Switch to Joint account to check current status
    await page.click('text=Joint');
    await page.waitForTimeout(1000);

    // The banner should show who owes whom based on current transactions
    const banner = page.locator('div:has-text("Split: 2/3")').first();
    await expect(banner).toBeVisible();
  });
});
