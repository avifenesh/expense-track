import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class CategoriesPage extends BasePage {
  async navigateToCategoriesTab() {
    await this.page.getByRole('tab', { name: 'Labels' }).click()
    await this.page.waitForSelector('#categoryName', { state: 'visible' })
    await this.waitForNetworkSettled()
  }

  async fillCategoryForm(data: { name: string; type?: string }) {
    await this.page.locator('#categoryName').fill(data.name)
    if (data.type) {
      await this.page.locator('#categoryType').selectOption({ label: data.type })
    }
  }

  async submitCategory() {
    await this.clickButton('Add category')
  }

  async expectCategoryInList(name: string) {
    // Use search to find the category (avoids pagination issues)
    await this.page.locator('#category-filter-search').fill(name)
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 10000 })
    await this.page.locator('#category-filter-search').fill('')
  }

  async expectCategoryNotInList(name: string) {
    await expect(this.page.getByText(name)).not.toBeVisible()
  }

  async clickArchiveCategory(name: string) {
    // Search first to ensure category is visible (avoids pagination issues)
    await this.page.locator('#category-filter-search').fill(name)
    const categoryItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = categoryItems.filter({ hasText: name })
    await expect(targetItem).toBeVisible({ timeout: 10000 })
    const archiveButton = targetItem.getByRole('button', { name: /archive/i })
    await archiveButton.click()
    await this.page.locator('#category-filter-search').fill('')
  }

  async clickReactivateCategory(name: string) {
    // Search first to ensure category is visible (avoids pagination issues)
    await this.page.locator('#category-filter-search').fill(name)
    const categoryItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = categoryItems.filter({ hasText: name })
    await expect(targetItem).toBeVisible({ timeout: 10000 })
    const reactivateButton = targetItem.getByRole('button', { name: /reactivate/i })
    await reactivateButton.click()
    await this.page.locator('#category-filter-search').fill('')
  }

  async filterByType(type: string) {
    await this.page.locator('#category-filter-type').selectOption({ label: type })
  }

  async searchCategories(query: string) {
    await this.page.locator('#category-filter-search').fill(query)
  }

  async toggleShowArchived() {
    const button = this.page.getByRole('button', { name: /show archived|hide archived/i })
    await button.click()
  }

  async expectValidationError(message: string | RegExp) {
    await expect(this.getByText(message)).toBeVisible()
  }

  async expectNoMatchingLabels() {
    await expect(this.page.getByText('No matching labels')).toBeVisible()
  }

  async expectTypeBadge(name: string, type: 'Expense' | 'Income') {
    // Search to ensure the category is visible (avoids pagination)
    await this.page.locator('#category-filter-search').fill(name)
    const categoryItems = this.page.locator('div.rounded-2xl.px-4')
    const targetItem = categoryItems.filter({ hasText: name })
    await expect(targetItem.locator('span.rounded-full', { hasText: type })).toBeVisible()
    await this.page.locator('#category-filter-search').fill('')
  }
}
