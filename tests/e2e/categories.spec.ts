import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { CategoriesPage } from './pages/categories-page'

// Use unique names to avoid conflicts between test runs
const uniqueSuffix = () => Date.now().toString(36).slice(-4)

/** Wait for a Next.js server action POST to complete */
function waitForServerAction(page: import('@playwright/test').Page) {
  return page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      res.request().headers()['next-action'] !== undefined,
  )
}

test.describe('categories', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('category creation', () => {
    test('should create a new expense category', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)
      const catName = `E2E Expense ${uniqueSuffix()}`

      await categoriesPage.navigateToCategoriesTab()

      await categoriesPage.fillCategoryForm({
        name: catName,
        type: 'Expense',
      })

      const actionDone = waitForServerAction(page)
      await categoriesPage.submitCategory()
      await actionDone

      // Reload and verify category in list
      await page.reload()
      await page.waitForLoadState('networkidle')
      await categoriesPage.navigateToCategoriesTab()

      await categoriesPage.expectCategoryInList(catName)

      await dashboardPage.clickSignOut()
    })

    test('should create a new income category', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)
      const catName = `E2E Income ${uniqueSuffix()}`

      await categoriesPage.navigateToCategoriesTab()

      await categoriesPage.fillCategoryForm({
        name: catName,
        type: 'Income',
      })

      const actionDone = waitForServerAction(page)
      await categoriesPage.submitCategory()
      await actionDone

      await page.reload()
      await page.waitForLoadState('networkidle')
      await categoriesPage.navigateToCategoriesTab()

      await categoriesPage.expectCategoryInList(catName)
      await categoriesPage.expectTypeBadge(catName, 'Income')

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for empty name', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)

      await categoriesPage.navigateToCategoriesTab()

      await categoriesPage.fillCategoryForm({ name: '' })
      await categoriesPage.submitCategory()

      // HTML5 required validation prevents submission - form stays unchanged
      await expect(page.locator('#categoryName')).toHaveValue('')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('category archiving', () => {
    test('should archive and reactivate a category', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)

      await categoriesPage.navigateToCategoriesTab()

      const archiveName = `E2E Archive ${uniqueSuffix()}`

      // Create a category to archive
      await categoriesPage.fillCategoryForm({
        name: archiveName,
        type: 'Expense',
      })

      let actionDone = waitForServerAction(page)
      await categoriesPage.submitCategory()
      await actionDone

      await page.reload()
      await page.waitForLoadState('networkidle')
      await categoriesPage.navigateToCategoriesTab()

      // Verify creation succeeded before archiving
      await categoriesPage.expectCategoryInList(archiveName)

      // Archive it
      actionDone = waitForServerAction(page)
      await categoriesPage.clickArchiveCategory(archiveName)
      await actionDone

      // After archive, category should disappear from the (non-archived) list
      // Wait for the UI to re-render after server action
      await page.waitForLoadState('networkidle')

      // Verify the category vanished from non-archived view (client-side update via router.refresh)
      await categoriesPage.searchCategories(archiveName)
      await categoriesPage.expectNoMatchingLabels()
      await categoriesPage.searchCategories('')

      // Show archived
      await categoriesPage.toggleShowArchived()
      await categoriesPage.expectCategoryInList(archiveName)

      // Reactivate
      actionDone = waitForServerAction(page)
      await categoriesPage.clickReactivateCategory(archiveName)
      await actionDone

      await page.reload()
      await page.waitForLoadState('networkidle')
      await categoriesPage.navigateToCategoriesTab()

      // Should be visible again without archived filter
      await categoriesPage.expectCategoryInList(archiveName)

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('category filtering', () => {
    test('should filter categories by type', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)

      await categoriesPage.navigateToCategoriesTab()
      await page.waitForLoadState('networkidle')

      // Filter by Expense - should see expense categories
      await categoriesPage.filterByType('Expense')
      await categoriesPage.expectCategoryInList('Groceries')

      // Filter by Income - should see income categories
      await categoriesPage.filterByType('Income')
      await categoriesPage.expectCategoryInList('Salary')

      // Reset to All
      await categoriesPage.filterByType('All types')

      await dashboardPage.clickSignOut()
    })

    test('should search categories by name', async ({ page }) => {
      const categoriesPage = new CategoriesPage(page)
      const dashboardPage = new DashboardPage(page)

      await categoriesPage.navigateToCategoriesTab()
      await page.waitForLoadState('networkidle')

      // Search for a known category
      await categoriesPage.searchCategories('Groceries')
      await categoriesPage.expectCategoryInList('Groceries')

      // Search for something that doesn't exist
      await categoriesPage.searchCategories('xyznonexistent')
      await categoriesPage.expectNoMatchingLabels()

      // Clear search
      await categoriesPage.searchCategories('')

      await dashboardPage.clickSignOut()
    })
  })
})
