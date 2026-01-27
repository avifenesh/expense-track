import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class BudgetsPage extends BasePage {
  async navigateToBudgetsTab() {
    await this.page.getByRole('tab', { name: 'Budgets' }).click()
    await this.page.waitForSelector('#budgetCategoryId', { state: 'visible' })
    // Wait for CSRF token to load (async fetch on component mount)
    await this.page.waitForTimeout(1000)
  }

  async fillBudgetForm(data: { account?: string; category: string; planned: string; currency?: string }) {
    if (data.account) {
      await this.selectOption('Account', data.account)
    }
    await this.selectOption('Category', data.category)
    await this.fillInput('Planned amount', data.planned)
    if (data.currency) {
      await this.selectOption('Currency', data.currency)
    }
  }

  async submitBudget() {
    await this.clickButton('Save budget')
  }

  async updateBudget() {
    await this.clickButton('Save budget')
  }

  async expectBudgetInList(category: string, planned: string) {
    // Wait for the category to appear in the budget list (not the dropdown)
    // Use .first() to handle strict mode - category appears in both list and dropdown
    await expect(this.page.getByText(category).first()).toBeVisible({ timeout: 20000 })
    // Also verify the planned amount appears (use first() as amounts may appear multiple places)
    await expect(this.page.getByText(planned).first()).toBeVisible({ timeout: 10000 })
  }

  async clickEditBudget(category: string) {
    // Find the budget list item by targeting the specific class structure
    // Budget items have 'rounded-2xl' and 'px-4' classes, which distinguishes them
    // from the Card container which has 'rounded-2xl' but uses different padding
    const budgetItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = budgetItems.filter({ hasText: category })
    await expect(targetItem).toBeVisible({ timeout: 10000 })

    // Click the edit button within this specific budget item
    const editButton = targetItem.getByRole('button', { name: /edit/i })
    await expect(editButton).toBeVisible({ timeout: 5000 })
    await editButton.click()
  }

  async clickCancelEdit() {
    await this.clickButton('Cancel')
  }

  async expectEditMode(categoryName: string) {
    // The component uses requestAnimationFrame to scroll the form into view,
    // so we need a longer timeout to wait for the edit mode to be fully active
    await expect(this.page.getByText(`Edit budget: ${categoryName}`)).toBeVisible({ timeout: 10000 })
    await expect(this.page.getByRole('button', { name: 'Cancel' })).toBeVisible({ timeout: 5000 })
    await expect(this.page.getByRole('button', { name: 'Update budget' })).toBeVisible({ timeout: 5000 })
  }

  async expectNotEditMode() {
    await expect(this.page.getByText(/Add or update a budget/)).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'Save budget' })).toBeVisible()
  }

  async expectFormPrefilledWith(data: { planned: string }) {
    const plannedInput = this.page.getByLabel('Planned amount')
    await expect(plannedInput).toHaveValue(data.planned)
  }

  async updateBudgetAmount(amount: string) {
    await this.fillInput('Planned amount', amount)
    await this.clickButton('Update budget')
  }

  async clickDeleteBudget(category: string) {
    // Find the budget list item by targeting the specific class structure
    // Budget items have 'rounded-2xl' and 'px-4' classes, which distinguishes them
    // from the Card container which has 'rounded-2xl' but uses different padding
    const budgetItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = budgetItems.filter({ hasText: category })
    await expect(targetItem).toBeVisible({ timeout: 20000 })

    // Click the remove button within this specific budget item
    // Budget deletion is immediate (no confirmation dialog)
    const removeButton = targetItem.getByRole('button', { name: /remove/i })
    await expect(removeButton).toBeVisible({ timeout: 10000 })
    await removeButton.click()
  }

  async expectNoBudgets() {
    await expect(this.getByText(/no budgets/i)).toBeVisible()
  }

  async filterByAccount(account: string) {
    // Use label matching since account names are displayed text, not values
    await this.selectOption('Account filter', { label: account })
  }

  async filterByType(type: string) {
    // Use label matching since types like 'Expense' are labels (values are 'EXPENSE')
    await this.selectOption('Type filter', { label: type })
  }

  async expectBudgetProgress(category: string, percentage: number) {
    const row = this.page.locator('tr', { hasText: category })
    await expect(row.getByText(`${percentage}%`)).toBeVisible()
  }

  async expectBudgetTotal(label: string, amount: string) {
    await expect(this.page.getByText(label).locator('..').getByText(amount)).toBeVisible()
  }

  async fillIncomeGoal(amount: string) {
    await this.fillInput('Monthly income goal', amount)
  }

  async submitIncomeGoal() {
    await this.clickButton('Set Income Goal')
  }

  async expectIncomeGoalProgress(percentage: number) {
    await expect(this.getByText(`${percentage}%`)).toBeVisible()
  }

  async expectValidationError(message: string | RegExp) {
    await expect(this.getByText(message)).toBeVisible()
  }

  async expectBudgetForm() {
    await expect(this.getByLabel('Category')).toBeVisible()
    await expect(this.getByLabel('Planned amount')).toBeVisible()
  }
}
