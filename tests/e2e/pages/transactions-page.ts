import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class TransactionsPage extends BasePage {
  async navigateToTransactionsTab() {
    await this.page.getByRole('tab', { name: 'Transactions' }).click()
  }

  async fillTransactionForm(data: {
    type?: string
    account?: string
    category: string
    amount: string
    date: string
    description?: string
    currency?: string
  }) {
    if (data.type) {
      await this.selectOption('Transaction type', data.type)
    }
    if (data.account) {
      await this.selectOption('Account', data.account)
    }
    await this.selectOption('Category', data.category)
    await this.fillInput('Amount', data.amount)
    await this.fillInput('Date', data.date)
    if (data.description) {
      await this.page.getByLabel('Description (optional)').fill(data.description)
    }
    if (data.currency) {
      await this.selectOption('Currency', data.currency)
    }
  }

  async submitTransaction() {
    await this.clickButton('Add Transaction')
  }

  async expectTransactionInList(description: string, amount: string) {
    const row = this.page.locator('tr', { hasText: description })
    await expect(row).toBeVisible()
    await expect(row.getByText(amount)).toBeVisible()
  }

  async clickEditTransaction(description: string) {
    const row = this.page.locator('tr', { hasText: description })
    await row.getByRole('button', { name: /edit/i }).click()
  }

  async clickDeleteTransaction(description: string) {
    const row = this.page.locator('tr', { hasText: description })
    await row.getByRole('button', { name: /delete/i }).click()
  }

  async confirmDelete() {
    await this.clickButton('Confirm')
  }

  async expectNoTransactions() {
    await expect(this.getByText(/no transactions/i)).toBeVisible()
  }

  async filterByType(type: string) {
    await this.selectOption('Type filter', type)
  }

  async filterByCategory(category: string) {
    await this.selectOption('Category filter', category)
  }

  async filterByAccount(account: string) {
    await this.selectOption('Account filter', account)
  }

  async searchTransactions(query: string) {
    await this.fillInput('Search', query)
  }

  async expectTransactionCount(count: number) {
    const rows = this.page.locator('tbody tr')
    await expect(rows).toHaveCount(count)
  }

  async clickExportTransactions() {
    await this.clickButton('Export')
  }

  async expectValidationError(message: string | RegExp) {
    await expect(this.getByText(message)).toBeVisible()
  }

  async expectTransactionForm() {
    await expect(this.getByLabel('Category')).toBeVisible()
    await expect(this.getByLabel('Amount')).toBeVisible()
    await expect(this.getByLabel('Date')).toBeVisible()
  }
}
