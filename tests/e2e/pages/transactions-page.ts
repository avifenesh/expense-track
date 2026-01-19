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
    // Scope all form fields to the transaction form to avoid matching filter elements
    const form = this.page.locator('#transaction-form')

    if (data.type) {
      // Use exact ID to avoid matching "Type filter"
      await form.locator('#transactionType').selectOption({ label: data.type })
      // Wait for category dropdown to update after type change
      // (category options are filtered by type)
      await this.page.waitForLoadState('domcontentloaded')
    }
    if (data.account) {
      await form.locator('#transactionAccount').selectOption({ label: data.account })
    }
    // Select category (filtered by type, so wait briefly for options to update)
    await form.locator('#transactionCategory').selectOption({ label: data.category })
    await form.getByLabel('Amount').fill(data.amount)
    await form.getByLabel('Date').fill(data.date)
    if (data.description) {
      await form.getByLabel('Description (optional)').fill(data.description)
    }
    if (data.currency) {
      await form.locator('#transactionCurrency').selectOption({ label: data.currency })
    }
  }

  async submitTransaction() {
    await this.clickButton('Save transaction')
  }

  async expectTransactionInList(description: string, amount: string) {
    // Amount in UI is formatted with currency symbol and commas (e.g., "-$50.00", "+$3,000.00")
    // Convert input like "50.00" to a regex that matches the formatted version
    const amountNum = parseFloat(amount)
    // Create regex that matches the amount with optional sign, currency symbol, and commas
    // e.g., "3000.00" should match "-$3,000.00" or "+$3,000.00"
    const formattedWithCommas = amountNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const amountRegex = new RegExp(`[+-]?\\$${formattedWithCommas.replace('.', '\\.')}`)

    // Use rounded-2xl class to target transaction row divs specifically (not parent containers)
    const item = this.page.locator('div.rounded-2xl', { hasText: description }).filter({ hasText: amountRegex })
    await expect(item.first()).toBeVisible({ timeout: 10000 })
  }

  async clickEditTransaction(description: string) {
    // Use rounded-2xl class to target transaction row divs specifically (not parent containers)
    const item = this.page.locator('div.rounded-2xl', { hasText: description })
    await item.getByRole('button', { name: 'Edit' }).first().click()
  }

  async clickDeleteTransaction(description: string) {
    // Use rounded-2xl class to target transaction row divs specifically (not parent containers)
    const item = this.page.locator('div.rounded-2xl', { hasText: description })
    // Transaction deletion is immediate (no confirmation dialog)
    await item.getByRole('button', { name: 'Delete' }).first().click()
  }

  async expectNoTransactions() {
    await expect(this.getByText(/no transactions/i)).toBeVisible()
  }

  async filterByType(type: string) {
    // Use label matching since types like 'Expense' are labels (values are 'EXPENSE')
    await this.selectOption('Type filter', { label: type })
  }

  async filterByCategory(category: string) {
    // Use label matching for category names
    await this.selectOption('Category filter', { label: category })
  }

  async filterByAccount(account: string) {
    // Use label matching for account names
    await this.selectOption('Account filter', { label: account })
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
