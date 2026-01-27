import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class RecurringPage extends BasePage {
  async navigateToRecurringTab() {
    await this.page.getByRole('tab', { name: 'Auto-repeat' }).click()
    await this.page.waitForSelector('#recurringAmount', { state: 'visible' })
    await this.waitForNetworkSettled()
  }

  async fillRecurringForm(data: {
    type?: string
    category: string
    amount: string
    startMonth: string
    dayOfMonth?: string
    description?: string
  }) {
    if (data.type) {
      await this.page.locator('#recurringType').selectOption({ label: data.type })
    }
    await this.page.locator('#recurringCategoryId').selectOption({ label: data.category })
    await this.page.locator('#recurringAmount').fill(data.amount)
    await this.page.locator('#startMonth').fill(data.startMonth)
    if (data.dayOfMonth) {
      await this.page.locator('#dayOfMonth').fill(data.dayOfMonth)
    }
    if (data.description) {
      await this.page.locator('#recurringDescription').fill(data.description)
    }
  }

  async submitRecurring() {
    await this.clickButton('Save recurring template')
  }

  async expectTemplateInList(categoryName: string) {
    // Use template card container to avoid matching dropdown options
    const templateCards = this.page.locator('div.rounded-2xl.px-4')
    const targetCard = templateCards.filter({ hasText: categoryName })
    await expect(targetCard.first()).toBeVisible({ timeout: 10000 })
  }

  async clickPauseTemplate(categoryName: string) {
    const templateItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = templateItems.filter({ hasText: categoryName }).first()
    await expect(targetItem).toBeVisible({ timeout: 10000 })
    const pauseButton = targetItem.getByRole('button', { name: /pause/i })
    await pauseButton.click()
  }

  async clickActivateTemplate(categoryName: string) {
    // Find a paused template card (one that has an "Activate" button)
    const templateItems = this.page.locator('div.rounded-2xl.px-4')
    const pausedItems = templateItems.filter({ hasText: categoryName }).filter({
      has: this.page.getByRole('button', { name: /^activate$/i }),
    })
    await expect(pausedItems.first()).toBeVisible({ timeout: 10000 })
    await pausedItems.first().getByRole('button', { name: /^activate$/i }).click()
  }

  async clickApplyTemplatesThisMonth() {
    await this.clickButton('Apply templates this month')
  }

  async toggleShowPaused() {
    const button = this.page.getByRole('button', { name: /show paused|hide paused/i })
    await button.click()
  }

  async filterByType(type: string) {
    await this.page.locator('#recurring-filter-type').selectOption({ label: type })
  }

  async expectNoTemplates() {
    await expect(this.page.getByText(/no auto-repeat items|no matching templates/i)).toBeVisible()
  }

  async expectValidationError(message: string | RegExp) {
    await expect(this.getByText(message)).toBeVisible()
  }

  async expectActiveTemplatesCount(count: string) {
    const statsCard = this.page.locator('text=Active templates').locator('..')
    await expect(statsCard.getByText(count)).toBeVisible()
  }
}
