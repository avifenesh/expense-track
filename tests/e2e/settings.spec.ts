import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('settings menu access', () => {
    test('should open settings menu via Account button', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await expect(accountButton).toBeVisible()

      await accountButton.click()

      const settingsMenu = page.getByRole('menu', { name: /account settings/i })
      await expect(settingsMenu).toBeVisible()

      await expect(page.getByRole('menuitem', { name: /export my data/i })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /delete account/i })).toBeVisible()
    })

    test('should close settings menu on backdrop click', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()

      const settingsMenu = page.getByRole('menu', { name: /account settings/i })
      await expect(settingsMenu).toBeVisible()

      await page.click('body', { position: { x: 10, y: 10 } })

      await expect(settingsMenu).not.toBeVisible()
    })

    test('should close settings menu when selecting an option', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()

      const settingsMenu = page.getByRole('menu', { name: /account settings/i })
      await expect(settingsMenu).toBeVisible()

      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(settingsMenu).not.toBeVisible()
    })
  })

  test.describe('export data functionality', () => {
    test('should open export data dialog from settings menu', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()

      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByRole('heading', { name: /export/i })).toBeVisible()
      await expect(page.getByText(/download.*data/i)).toBeVisible()
    })

    test('should show JSON and CSV format options', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByRole('heading', { name: /export/i })).toBeVisible()

      // Format selection buttons should be visible
      await expect(page.getByRole('button', { name: /json/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /csv/i })).toBeVisible()
    })

    test('should default to JSON format with correct button text', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByRole('heading', { name: /export/i })).toBeVisible()

      // Export button should show JSON format by default
      await expect(page.getByRole('button', { name: /export as json/i })).toBeVisible()
    })

    test('should switch to CSV format when selected', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByRole('heading', { name: /export/i })).toBeVisible()

      // Click CSV format
      const csvButton = page.getByRole('button', { name: /csv/i }).first()
      await csvButton.click()

      // Export button should update to show CSV
      await expect(page.getByRole('button', { name: /export as csv/i })).toBeVisible()
    })

    test('should trigger download when export button is clicked', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByRole('heading', { name: /export/i })).toBeVisible()

      // Wait for download event
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: /export as json/i }).click()
      const download = await downloadPromise

      // Verify download filename
      expect(download.suggestedFilename()).toMatch(/balance-beacon-export.*\.json/)
    })

    test('should close export dialog', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      const exportDialog = page.getByRole('heading', { name: /export/i })
      await expect(exportDialog).toBeVisible()

      const closeButton = page.getByRole('button', { name: /cancel|close/i }).first()
      await closeButton.click()

      await expect(exportDialog).not.toBeVisible()
    })
  })

  test.describe('sign out functionality', () => {
    test('should sign out from settings menu', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()

      await page.getByRole('menuitem', { name: /sign out/i }).click()

      await page.waitForLoadState('networkidle')

      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('delete account functionality', () => {
    test('should open delete account dialog from settings menu', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()

      await page.getByRole('menuitem', { name: /delete account/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*account/i })).toBeVisible()
      await expect(page.getByText(/this action.*permanent/i)).toBeVisible()
    })

    test('should show email confirmation input', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*account/i })).toBeVisible()

      // Email confirmation input should be visible
      const emailInput = page.getByPlaceholder(/enter your email/i)
      await expect(emailInput).toBeVisible()
    })

    test('should have delete button disabled when email is empty', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*account/i })).toBeVisible()

      // Delete button should be disabled initially
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeDisabled()
    })

    test('should keep delete button disabled for wrong email', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*account/i })).toBeVisible()

      // Type wrong email
      const emailInput = page.getByPlaceholder(/enter your email/i)
      await emailInput.fill('wrong-email@example.com')

      // Delete button should still be disabled
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeDisabled()
    })

    test('should show warning about irreversible action', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*account/i })).toBeVisible()

      // Warning text should be visible
      await expect(page.getByText(/permanent.*irreversible/i)).toBeVisible()
    })

    test('should close delete account dialog', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      const deleteDialog = page.getByRole('heading', { name: /delete.*account/i })
      await expect(deleteDialog).toBeVisible()

      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()

      await expect(deleteDialog).not.toBeVisible()
    })

    test('should close delete dialog with X button', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      const deleteDialog = page.getByRole('heading', { name: /delete.*account/i })
      await expect(deleteDialog).toBeVisible()

      // Close with X button
      const closeButton = page.getByRole('button', { name: /close/i })
      await closeButton.click()

      await expect(deleteDialog).not.toBeVisible()
    })
  })
})
