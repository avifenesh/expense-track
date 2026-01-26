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

    test('should show JSON and CSV format options', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      // Check format options are visible
      await expect(page.getByRole('button', { name: /json/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /csv/i })).toBeVisible()
      await expect(page.getByText(/structured data format/i)).toBeVisible()
      await expect(page.getByText(/spreadsheet compatible/i)).toBeVisible()
    })

    test('should allow format selection', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      // Default should be JSON
      const exportButton = page.getByRole('button', { name: /export as json/i })
      await expect(exportButton).toBeVisible()

      // Click CSV format
      await page.getByRole('button', { name: /csv/i }).click()

      // Export button should update
      await expect(page.getByRole('button', { name: /export as csv/i })).toBeVisible()
    })

    test('should trigger download when export is clicked', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      // Wait for CSRF token to load
      await expect(page.getByRole('button', { name: /export as json/i })).toBeEnabled({ timeout: 5000 })

      // Set up download listener
      const downloadPromise = page.waitForEvent('download')

      // Click export
      await page.getByRole('button', { name: /export as json/i }).click()

      // Verify download started
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/balance-beacon-export.*\.json/)
    })

    test('should export CSV format', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      // Select CSV
      await page.getByRole('button', { name: /csv/i }).click()

      // Wait for CSRF token to load
      await expect(page.getByRole('button', { name: /export as csv/i })).toBeEnabled({ timeout: 5000 })

      // Set up download listener
      const downloadPromise = page.waitForEvent('download')

      // Click export
      await page.getByRole('button', { name: /export as csv/i }).click()

      // Verify download started
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/balance-beacon-export.*\.csv/)
    })

    test('should show GDPR compliance text', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /export my data/i }).click()

      await expect(page.getByText(/gdpr.*article.*20/i)).toBeVisible()
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

    test('should show email confirmation input', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      // Check for email input field
      const emailInput = page.getByRole('textbox')
      await expect(emailInput).toBeVisible()

      // Check for instruction text
      await expect(page.getByText(/type.*to confirm/i)).toBeVisible()
    })

    test('should disable delete button when email does not match', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      // Wait for CSRF token to load
      await page.waitForTimeout(500)

      // Delete button should be disabled initially
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeDisabled()

      // Enter wrong email
      const emailInput = page.getByRole('textbox')
      await emailInput.fill('wrong@email.com')

      // Button should still be disabled
      await expect(deleteButton).toBeDisabled()
    })

    test('should enable delete button when email matches', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      // Get the user email from the instruction text
      const instructionText = await page.getByText(/type.*to confirm/i).textContent()
      const emailMatch = instructionText?.match(/Type\s+(\S+@\S+)\s+to confirm/i)
      const userEmail = emailMatch?.[1] || ''

      // Wait for CSRF token
      await page.waitForTimeout(500)

      // Enter matching email
      const emailInput = page.getByRole('textbox')
      await emailInput.fill(userEmail)

      // Button should now be enabled
      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeEnabled()
    })

    test('should close dialog with close button', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      const deleteDialog = page.getByRole('heading', { name: /delete.*account/i })
      await expect(deleteDialog).toBeVisible()

      // Click the X close button
      const closeButton = page.getByRole('button', { name: /close/i })
      await closeButton.click()

      await expect(deleteDialog).not.toBeVisible()
    })

    test('should show warning about irreversible action', async ({ page }) => {
      const accountButton = page.getByRole('button', { name: /account/i })
      await accountButton.click()
      await page.getByRole('menuitem', { name: /delete account/i }).click()

      // Check for warning text
      await expect(page.getByText(/permanent.*irreversible/i)).toBeVisible()
      await expect(page.getByText(/transactions.*budgets.*categories/i)).toBeVisible()
    })

    // Note: We don't actually delete the test account as that would break other tests
    // The actual delete flow is covered by unit tests and API tests
  })
})
