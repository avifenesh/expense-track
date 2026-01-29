import React, { useState, useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert, Share, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { MainTabScreenProps } from '../../navigation/types'
import { APP_NAME, APP_VERSION, PADDLE_CUSTOMER_PORTAL_URL } from '../../constants'
import { useAuthStore, useSubscriptionStore } from '../../stores'
import { getBiometricTypeLabel } from '../../services/biometric'
import { exportUserData, deleteAccount } from '../../services/auth'
import { ExportFormatModal, type ExportFormat } from '../../components/ExportFormatModal'
import { DeleteAccountModal } from '../../components/DeleteAccountModal'
import { ApiError } from '../../services/api'
import type { SubscriptionStatus } from '../../services/subscription'

function getStatusColor(status: SubscriptionStatus): string {
  switch (status) {
    case 'TRIALING':
      return '#38bdf8'
    case 'ACTIVE':
      return '#22c55e'
    case 'PAST_DUE':
      return '#f59e0b'
    case 'CANCELED':
      return '#64748b'
    case 'EXPIRED':
      return '#ef4444'
    default:
      return '#64748b'
  }
}

function getStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'TRIALING':
      return 'Trial'
    case 'ACTIVE':
      return 'Active'
    case 'PAST_DUE':
      return 'Past Due'
    case 'CANCELED':
      return 'Canceled'
    case 'EXPIRED':
      return 'Expired'
    default:
      return 'Unknown'
  }
}

export function SettingsScreen({ navigation }: MainTabScreenProps<'Settings'>) {
  const biometricCapability = useAuthStore((state) => state.biometricCapability)
  const isBiometricEnabled = useAuthStore((state) => state.isBiometricEnabled)
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)

  const subscriptionStatus = useSubscriptionStore((state) => state.status)
  const subscriptionDaysRemaining = useSubscriptionStore((state) => state.daysRemaining)
  const isSubscriptionLoading = useSubscriptionStore((state) => state.isLoading)
  const subscriptionError = useSubscriptionStore((state) => state.error)
  const fetchSubscription = useSubscriptionStore((state) => state.fetchSubscription)

  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const [biometricError, setBiometricError] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await useAuthStore.getState().logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleToggleBiometric = async () => {
    setBiometricError(null)
    setIsBiometricLoading(true)
    try {
      if (isBiometricEnabled) {
        await useAuthStore.getState().disableBiometric()
      } else {
        await useAuthStore.getState().enableBiometric()
      }
    } catch (err) {
      if (err instanceof Error) {
        setBiometricError(err.message)
      } else {
        setBiometricError('Failed to update biometric settings')
      }
    } finally {
      setIsBiometricLoading(false)
    }
  }

  const handleExportData = useCallback(async (format: ExportFormat) => {
    if (!accessToken) {
      Alert.alert('Error', 'You must be logged in to export data')
      return
    }

    setIsExporting(true)
    try {
      const data = await exportUserData(format, accessToken)

      let shareContent: string
      let filename: string

      if ('format' in data && data.format === 'csv') {
        shareContent = data.data
        filename = 'balance-beacon-export.csv'
      } else {
        shareContent = JSON.stringify(data, null, 2)
        filename = 'balance-beacon-export.json'
      }

      setShowExportModal(false)

      await Share.share({
        message: shareContent,
        title: filename,
      })

      Alert.alert('Success', 'Your data has been exported successfully')
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to export data'
      Alert.alert('Export Failed', errorMessage)
    } finally {
      setIsExporting(false)
    }
  }, [accessToken])

  const handleDeleteAccount = useCallback(async (confirmEmail: string) => {
    if (!accessToken) {
      Alert.alert('Error', 'You must be logged in to delete your account')
      return
    }

    setIsDeleting(true)
    try {
      await deleteAccount(confirmEmail, accessToken)
      setShowDeleteModal(false)

      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted',
        [
          {
            text: 'OK',
            onPress: () => useAuthStore.getState().logout(),
          },
        ],
        { cancelable: false }
      )
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to delete account'
      Alert.alert('Delete Failed', errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }, [accessToken])

  const biometricLabel = biometricCapability ? getBiometricTypeLabel(biometricCapability.biometricType) : 'Biometric'

  const showBiometricOption = biometricCapability?.isAvailable

  const handleManageSubscription = useCallback(async () => {
    try {
      await Linking.openURL(PADDLE_CUSTOMER_PORTAL_URL)
    } catch {
      Alert.alert('Error', 'Unable to open subscription management page')
    }
  }, [])

  const handleUpgrade = useCallback(async () => {
    try {
      await Linking.openURL(PADDLE_CUSTOMER_PORTAL_URL)
    } catch {
      Alert.alert('Error', 'Unable to open upgrade page')
    }
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="settings.screen">
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} testID="settings.scrollView">
        <Text style={styles.title} testID="settings.title">
          Settings
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.menuGroup}>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate('Profile')}
              testID="settings.profileButton"
            >
              <Text style={styles.menuText}>Profile</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Currency</Text>
              <Text style={styles.menuValue}>USD</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate('Accounts')}
              testID="settings.accountsButton"
            >
              <Text style={styles.menuText}>Accounts</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => navigation.navigate('Categories')}
              testID="settings.categoriesButton"
            >
              <Text style={styles.menuText}>Categories</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section} testID="settings.subscriptionSection">
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.menuGroup}>
            {isSubscriptionLoading ? (
              <View style={styles.menuItem}>
                <ActivityIndicator color="#38bdf8" testID="settings.subscriptionLoading" />
              </View>
            ) : subscriptionError ? (
              <View style={styles.menuItem}>
                <Text style={styles.errorText} testID="settings.subscriptionError">{subscriptionError}</Text>
              </View>
            ) : subscriptionStatus ? (
              <>
                <View style={styles.menuItem} testID="settings.subscriptionStatus">
                  <Text style={styles.menuText}>Status</Text>
                  <View
                    style={[styles.statusBadge, { backgroundColor: getStatusColor(subscriptionStatus) }]}
                    testID="settings.subscriptionBadge"
                  >
                    <Text style={styles.statusBadgeText}>{getStatusLabel(subscriptionStatus)}</Text>
                  </View>
                </View>
                {subscriptionDaysRemaining !== null && subscriptionDaysRemaining > 0 && (
                  <View style={styles.menuItem} testID="settings.daysRemaining">
                    <Text style={styles.menuText}>Days Remaining</Text>
                    <Text style={styles.menuValue}>{subscriptionDaysRemaining}</Text>
                  </View>
                )}
                {(subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'PAST_DUE' || subscriptionStatus === 'CANCELED') && (
                  <Pressable
                    style={styles.menuItem}
                    onPress={handleManageSubscription}
                    testID="settings.manageSubscriptionButton"
                  >
                    <Text style={styles.menuText}>Manage Subscription</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                )}
                {subscriptionStatus === 'TRIALING' && (
                  <Pressable
                    style={styles.menuItem}
                    onPress={handleUpgrade}
                    testID="settings.upgradeButton"
                  >
                    <Text style={[styles.menuText, styles.upgradeText]}>Upgrade</Text>
                    <Text style={styles.menuArrow}>›</Text>
                  </Pressable>
                )}
              </>
            ) : null}
          </View>
        </View>

        {showBiometricOption && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.menuGroup}>
              <View style={styles.menuItem}>
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuText}>{biometricLabel}</Text>
                  <Text style={styles.menuSubtext}>Quick unlock with {biometricLabel}</Text>
                </View>
                {isBiometricLoading ? (
                  <ActivityIndicator color="#38bdf8" testID="biometric-loading" />
                ) : (
                  <Switch
                    value={isBiometricEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: '#475569', true: '#38bdf8' }}
                    thumbColor={isBiometricEnabled ? '#fff' : '#94a3b8'}
                    testID="biometric-switch"
                  />
                )}
              </View>
            </View>
            {biometricError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{biometricError}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.menuGroup}>
            <Pressable
              style={styles.menuItem}
              onPress={() => setShowExportModal(true)}
              testID="settings.exportDataButton"
            >
              <Text style={styles.menuText}>Export Data</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => setShowDeleteModal(true)}
              testID="settings.deleteAccountButton"
            >
              <Text style={[styles.menuText, styles.dangerText]}>Delete Account</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.menuGroup}>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Privacy Policy</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <Pressable style={styles.menuItem}>
              <Text style={styles.menuText}>Terms of Service</Text>
              <Text style={styles.menuArrow}>›</Text>
            </Pressable>
            <View style={styles.menuItem}>
              <Text style={styles.menuText}>Version</Text>
              <Text style={styles.menuValue}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          testID="logout-button"
        >
          {isLoggingOut ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.logoutText}>Sign Out</Text>}
        </Pressable>

        <Text style={styles.appName}>{APP_NAME}</Text>
      </ScrollView>

      <ExportFormatModal
        visible={showExportModal}
        isExporting={isExporting}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={handleExportData}
      />

      <DeleteAccountModal
        visible={showDeleteModal}
        userEmail={user?.email || ''}
        isDeleting={isDeleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  menuGroup: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemLeft: {
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: '#fff',
  },
  menuSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuValue: {
    fontSize: 16,
    color: '#64748b',
  },
  menuArrow: {
    fontSize: 20,
    color: '#64748b',
  },
  dangerText: {
    color: '#ef4444',
  },
  upgradeText: {
    color: '#38bdf8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  logoutButton: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  appName: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
})
