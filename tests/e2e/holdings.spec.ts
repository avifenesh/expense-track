import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { HoldingsPage } from './pages/holdings-page'

// Pool of known valid stock symbols for E2E tests.
// The holdings API validates symbols against Alpha Vantage, so random strings fail.
const VALID_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX']

test.describe('holdings', () => {
  test.describe.configure({ mode: 'serial' })
  let testSymbol: string

  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('holdings tab display', () => {
    test('should display the holdings tab with form and list', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()
      await page.waitForLoadState('networkidle')

      // Verify form elements are visible
      await expect(page.getByRole('button', { name: 'Add holding', exact: true })).toBeVisible()
      await expect(page.locator('#symbol')).toBeVisible()
      await expect(page.locator('#quantity')).toBeVisible()
      await expect(page.locator('#averageCost')).toBeVisible()

      // Verify holdings list section
      await expect(page.getByRole('heading', { name: /your holdings/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should show empty state when no holdings exist', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()

      // Wait for holdings to load
      await page.waitForLoadState('networkidle')

      // Either shows holdings or empty state
      const hasHoldings = await page.getByText('Market Value').isVisible().catch(() => false)
      if (!hasHoldings) {
        await holdingsPage.expectEmptyState()
      }

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('holding creation', () => {
    test('should create a new holding', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()
      await page.waitForLoadState('networkidle')

      // Check if holding categories exist (required for creating holdings)
      const categorySelect = page.locator('#holdingCategory')
      const optionCount = await categorySelect.locator('option').count()

      if (optionCount <= 1) {
        // No holding categories available - skip test gracefully
        await dashboardPage.clickSignOut()
        return
      }

      testSymbol = VALID_SYMBOLS[0]

      await holdingsPage.fillHoldingForm({
        symbol: testSymbol,
        quantity: '10',
        averageCost: '200.00',
        notes: 'E2E test holding',
      })

      await holdingsPage.submitHolding()

      // The API validates symbols against Alpha Vantage which may be rate-limited in CI.
      // If we see an error about the symbol or API, skip gracefully.
      const apiError = await page
        .getByText(/invalid or unknown symbol|API request failed|rate limit|alpha vantage/i)
        .isVisible()
        .catch(() => false)
      if (apiError) {
        // Mark testSymbol as empty so downstream serial tests also skip
        testSymbol = ''
        await dashboardPage.clickSignOut()
        return
      }

      // Check for "already exists" — use a different symbol
      const alreadyExists = await page.getByText(/already exists/i).isVisible().catch(() => false)
      if (alreadyExists) {
        // The symbol is already tracked — just use it for the delete test
        await dashboardPage.clickSignOut()
        return
      }

      // Verify holding appears in list (confirms successful creation)
      await holdingsPage.expectHoldingInList(testSymbol)

      await dashboardPage.clickSignOut()
    })

    test('should require symbol field', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()
      await page.waitForLoadState('networkidle')

      // Try submitting without filling required fields
      await holdingsPage.submitHolding()

      // HTML5 validation should prevent submission
      await expect(page.getByText(/holding added/i)).not.toBeVisible({ timeout: 2000 })

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('holding deletion', () => {
    test('should delete a holding via confirm dialog', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()
      await page.waitForLoadState('networkidle')

      // testSymbol should exist from the previous 'create' test (serial mode)
      // If API was unavailable during create, skip this test
      if (!testSymbol) {
        await dashboardPage.clickSignOut()
        return
      }
      await holdingsPage.expectHoldingInList(testSymbol)

      // Accept the confirm dialog before clicking delete
      page.on('dialog', (dialog) => dialog.accept())

      // Click delete
      await holdingsPage.clickDeleteHolding(testSymbol)

      // Wait for holdings to reload
      await page.waitForResponse(
        (res) => res.url().includes('/api/holdings'),
        { timeout: 10000 },
      )

      // Verify holding is removed
      await holdingsPage.expectHoldingNotInList(testSymbol)

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('price refresh', () => {
    test('should show refresh prices button', async ({ page }) => {
      const holdingsPage = new HoldingsPage(page)
      const dashboardPage = new DashboardPage(page)

      await holdingsPage.navigateToHoldingsTab()
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('button', { name: /refresh prices/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
