/**
 * Settings E2E Tests
 * Tests export data and delete account flows with real backend
 */

import { device, element, by, expect, waitFor } from 'detox'
import { TestApiClient } from '../helpers/api-client'
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures'
import {
  SettingsScreen,
  ExportFormatModal,
  DeleteAccountModal,
  navigateToTab,
  performLogin,
} from '../contracts/ui-contracts'

describe('Settings E2E Tests', () => {
  let api: TestApiClient

  beforeAll(async () => {
    api = new TestApiClient()
    await api.ensureTestUser(TEST_USER, true)
  })

  beforeEach(async () => {
    await device.launchApp({ newInstance: true })

    // Use performLogin which handles subscription loading state
    await performLogin(TEST_USER.email, TEST_USER.password)

    await navigateToTab('Settings')
    await SettingsScreen.waitForScreen()
    // Wait for subscription data to load before interacting with the screen
    await SettingsScreen.waitForSubscriptionLoaded()
  })

  describe('Settings Screen UI', () => {
    it('displays settings screen with data management options', async () => {
      await expect(element(by.id('settings.screen'))).toBeVisible()

      // Scroll to Data section (buttons are below the fold)
      await waitFor(element(by.id('settings.exportDataButton')))
        .toBeVisible()
        .whileElement(by.id('settings.scrollView'))
        .scroll(300, 'down')

      await expect(element(by.id('settings.exportDataButton'))).toBeVisible()
      await expect(element(by.id('settings.deleteAccountButton'))).toBeVisible()
    })
  })

  describe('Export Data Flow', () => {
    it('opens export format modal when Export Data is tapped', async () => {
      await SettingsScreen.tapExportData()
      await ExportFormatModal.waitForModal()
      await ExportFormatModal.assertVisible()
    })

    it('shows JSON and CSV format options', async () => {
      await SettingsScreen.tapExportData()
      await ExportFormatModal.waitForModal()

      await expect(element(by.id('export-format-modal.json'))).toBeVisible()
      await expect(element(by.id('export-format-modal.csv'))).toBeVisible()
    })

    it('closes export modal when Cancel is tapped', async () => {
      await SettingsScreen.tapExportData()
      await ExportFormatModal.waitForModal()

      await ExportFormatModal.tapCancel()

      await waitFor(element(by.id('export-format-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.SHORT)
    })
  })

  describe('Delete Account Flow', () => {
    it('opens delete account modal when Delete Account is tapped', async () => {
      await SettingsScreen.tapDeleteAccount()
      await DeleteAccountModal.waitForModal()
      await DeleteAccountModal.assertVisible()
    })

    it('shows email confirmation input and warning', async () => {
      await SettingsScreen.tapDeleteAccount()
      await DeleteAccountModal.waitForModal()

      await expect(element(by.id('delete-account-modal.email-input'))).toBeVisible()
      await expect(element(by.text('This action cannot be undone'))).toBeVisible()
    })

    it('has confirm button disabled when email is empty', async () => {
      await SettingsScreen.tapDeleteAccount()
      await DeleteAccountModal.waitForModal()

      await DeleteAccountModal.assertConfirmDisabled()
    })

    it('keeps confirm button disabled for wrong email', async () => {
      await SettingsScreen.tapDeleteAccount()
      await DeleteAccountModal.waitForModal()

      await DeleteAccountModal.enterEmail('wrong-email@example.com')

      await DeleteAccountModal.assertConfirmDisabled()
    })

    it('closes delete modal when Cancel is tapped', async () => {
      await SettingsScreen.tapDeleteAccount()
      await DeleteAccountModal.waitForModal()

      await DeleteAccountModal.tapCancel()

      await waitFor(element(by.id('delete-account-modal')))
        .not.toBeVisible()
        .withTimeout(TIMEOUTS.SHORT)
    })
  })
})
