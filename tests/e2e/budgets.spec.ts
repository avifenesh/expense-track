import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { BudgetsPage } from './pages/budgets-page'
import { TEST_CATEGORIES } from './helpers/fixtures'

test.describe('budgets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('budget creation', () => {
    test('should create a new budget', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()
      await budgetsPage.expectBudgetForm()

      await budgetsPage.fillBudgetForm({
        category: TEST_CATEGORIES.GROCERIES,
        planned: '500.00',
      })

      await budgetsPage.submitBudget()

      await expect(page.getByText(/budget updated/i)).toBeVisible()
      await budgetsPage.expectBudgetInList(TEST_CATEGORIES.GROCERIES, '500')

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for missing category', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()

      await budgetsPage.fillBudgetForm({
        category: '',
        planned: '500.00',
      })

      await budgetsPage.submitBudget()

      await budgetsPage.expectValidationError(/select a category/i)

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for negative amount', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()

      await budgetsPage.fillBudgetForm({
        category: TEST_CATEGORIES.ENTERTAINMENT,
        planned: '-100',
      })

      await budgetsPage.submitBudget()

      await budgetsPage.expectValidationError(/valid.*amount/i)

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('budget editing', () => {
    test('should edit an existing budget', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()

      await budgetsPage.fillBudgetForm({
        category: TEST_CATEGORIES.UTILITIES,
        planned: '200.00',
      })

      await budgetsPage.submitBudget()

      await budgetsPage.clickEditBudget(TEST_CATEGORIES.UTILITIES)

      await page.getByLabel('Planned amount').fill('250.00')
      await budgetsPage.updateBudget()

      await expect(page.getByText(/budget updated/i)).toBeVisible()
      await budgetsPage.expectBudgetInList(TEST_CATEGORIES.UTILITIES, '250')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('budget deletion', () => {
    test('should delete a budget', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()

      await budgetsPage.fillBudgetForm({
        category: TEST_CATEGORIES.ENTERTAINMENT,
        planned: '150.00',
      })

      await budgetsPage.submitBudget()

      await budgetsPage.clickDeleteBudget(TEST_CATEGORIES.ENTERTAINMENT)
      await budgetsPage.confirmDelete()

      await expect(page.getByText(/budget removed/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('budget filtering', () => {
    test('should filter budgets by account', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()
      await page.waitForLoadState('networkidle')

      const accountFilter = page.getByLabel('Account filter')
      await expect(accountFilter).toBeVisible()
      await budgetsPage.filterByAccount('TestUserOne')
      await page.waitForLoadState('networkidle')

      await dashboardPage.clickSignOut()
    })

    test('should filter budgets by type', async ({ page }) => {
      const budgetsPage = new BudgetsPage(page)
      const dashboardPage = new DashboardPage(page)

      await budgetsPage.navigateToBudgetsTab()
      await page.waitForLoadState('networkidle')

      const typeFilter = page.getByLabel('Type filter')
      await expect(typeFilter).toBeVisible()
      await budgetsPage.filterByType('Expense')
      await page.waitForLoadState('networkidle')
      await budgetsPage.filterByType('All')
      await page.waitForLoadState('networkidle')

      await dashboardPage.clickSignOut()
    })
  })
})
