import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class HoldingsPage extends BasePage {
  async navigateToHoldingsTab() {
    await this.page.getByRole('tab', { name: 'Investments' }).click()
    await this.page.waitForSelector('#symbol', { state: 'visible' })
    await this.waitForNetworkSettled()
  }

  async fillHoldingForm(data: {
    symbol: string
    quantity: string
    averageCost: string
    currency?: string
    notes?: string
  }) {
    await this.page.locator('#symbol').fill(data.symbol)
    await this.page.locator('#quantity').fill(data.quantity)
    await this.page.locator('#averageCost').fill(data.averageCost)
    if (data.currency) {
      await this.page.locator('#holdingCurrency').selectOption({ label: data.currency })
    }
    if (data.notes) {
      await this.page.locator('#holdingNotes').fill(data.notes)
    }
  }

  async submitHolding() {
    await this.page.evaluate(() => {
      const symbolInput = document.querySelector('#symbol')
      const form = symbolInput?.closest('form')
      if (form) form.requestSubmit()
    })
    // Wait for feedback text (success or error) to appear
    await this.page.getByText(/holding added|holding deleted|error|invalid|already exists|rate limit|alpha vantage|API request/i)
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => {})
    // Wait for holdings list to refresh
    await this.page.waitForLoadState('networkidle')
  }

  async expectHoldingInList(symbol: string) {
    await expect(this.page.getByText(symbol, { exact: true }).first()).toBeVisible({ timeout: 20000 })
  }

  async expectHoldingNotInList(symbol: string) {
    await expect(this.page.getByText(symbol, { exact: true })).not.toBeVisible({ timeout: 10000 })
  }

  async expectFeedback(message: string | RegExp) {
    await expect(this.page.getByText(message)).toBeVisible({ timeout: 10000 })
  }

  async expectEmptyState() {
    await expect(this.page.getByText('No holdings tracked yet.')).toBeVisible({ timeout: 10000 })
  }

  async clickRefreshPrices() {
    await this.clickButton('Refresh prices')
  }

  async clickDeleteHolding(symbol: string) {
    const holdingItems = this.page.locator('div.rounded-2xl').filter({ hasText: symbol })
    const deleteButton = holdingItems.locator('button', { hasText: /delete/i })
    await deleteButton.click()
  }
}
