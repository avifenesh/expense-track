import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class BudgetsPage extends BasePage {
  async navigateToBudgetsTab() {
    await this.page.getByRole('tab', { name: 'Budgets' }).click()
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
    const item = this.page.locator('div', { hasText: category }).filter({ hasText: planned })
    await expect(item.first()).toBeVisible()
  }

  async clickEditBudget(category: string) {
    const item = this.page.locator('div', { hasText: category })
    await item.getByRole('button', { name: /edit/i }).first().click()
  }

  async clickDeleteBudget(category: string) {
    const item = this.page.locator('div', { hasText: category })
    // Budget deletion is immediate (no confirmation dialog)
    await item.getByRole('button', { name: /remove/i }).first().click()
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
