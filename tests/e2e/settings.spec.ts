import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('settings access', () => {
    test('should access settings page', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await expect(page).toHaveURL(/\/settings/)
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should show profile section', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await expect(page.getByText(/profile/i)).toBeVisible()
      await expect(page.getByText(/display name/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should show currency preference', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()
      await expect(page.getByText(/currency/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('profile management', () => {
    test('should update display name', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()

      const displayNameInput = page.getByLabel(/display name/i)
      await expect(displayNameInput).toBeVisible()

      await displayNameInput.clear()
      await displayNameInput.fill('Test User Updated')

      const saveButton = page.getByRole('button', { name: /save|update/i })
      await saveButton.click()

      await expect(page.getByText(/saved|updated/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('currency management', () => {
    test('should change currency preference', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      await expect(settingsLink).toBeVisible()
      await settingsLink.click()

      const currencySelect = page.getByLabel(/currency/i)
      await expect(currencySelect).toBeVisible()

      await currencySelect.selectOption('EUR')

      const saveButton = page.getByRole('button', { name: /save|update/i })
      await saveButton.click()

      await expect(page.getByText(/saved|updated/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
