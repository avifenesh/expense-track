import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class DashboardPage extends BasePage {
  async navigateToDashboard() {
    await this.goto('/')
    await expect(this.page).toHaveURL(/\/?account=/)
  }

  async selectAccount(accountName: string) {
    const accountSelect = this.getByLabel('Filter by account')
    await accountSelect.selectOption({ label: accountName })
  }

  async expectAccountOption(accountName: string, shouldExist: boolean = true) {
    const accountSelect = this.getByLabel('Filter by account')
    const option = accountSelect.locator('option', { hasText: accountName })
    if (shouldExist) {
      await expect(option).toHaveCount(1)
    } else {
      await expect(option).toHaveCount(0)
    }
  }

  async expectSelectedAccount(accountName: string) {
    const accountSelect = this.getByLabel('Filter by account')
    await expect(accountSelect.locator('option:checked')).toHaveText(accountName)
  }

  async expectAccountSwitchMessage(accountName: string) {
    await expect(this.getByText(`${accountName} will open by default next time.`)).toBeVisible()
  }

  async clickSignOut() {
    await this.clickButton('Sign out')
  }

  async clickAddTransaction() {
    await this.clickButton('Add Transaction')
  }

  async clickAddHolding() {
    await this.clickButton('Add Holding')
  }

  async expectStatCard(label: string) {
    await expect(this.page.getByText(label)).toBeVisible()
  }

  async expectTransactionsList() {
    await expect(this.getByRole('heading', { name: /transactions/i })).toBeVisible()
  }

  async selectMonth(monthKey: string) {
    const monthSelect = this.getByLabel('Filter by month')
    await monthSelect.selectOption(monthKey)
  }

  async navigateToTab(tabName: string) {
    await this.page.getByRole('tab', { name: tabName }).click()
  }

  async expectTab(tabName: string) {
    await expect(this.page.getByRole('tab', { name: tabName })).toBeVisible()
  }

  async expectSubscriptionBanner(text: string | RegExp) {
    await expect(this.getByText(text)).toBeVisible()
  }

  async clickUpgrade() {
    await this.page.getByRole('link', { name: /upgrade/i }).click()
  }
}
