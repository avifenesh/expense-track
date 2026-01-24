import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { AppStackScreenProps } from '../../navigation/types'
import { useAccountsStore, useToastStore, type Account } from '../../stores'
import { formatCurrency } from '../../utils/format'

export function AccountsScreen({ navigation }: AppStackScreenProps<'Accounts'>) {
  const accounts = useAccountsStore((state) => state.accounts)
  const activeAccountId = useAccountsStore((state) => state.activeAccountId)
  const isLoading = useAccountsStore((state) => state.isLoading)
  const error = useAccountsStore((state) => state.error)

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    useAccountsStore.getState().fetchAccounts()
  }, [])

  const handleClose = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleSwitchAccount = useCallback(async (accountId: string) => {
    if (accountId === activeAccountId) return

    const success = await useAccountsStore.getState().setActiveAccount(accountId)
    if (success) {
      useToastStore.getState().success('Account switched')
    } else {
      const errorMsg = useAccountsStore.getState().error
      useToastStore.getState().error(errorMsg || 'Failed to switch account')
    }
  }, [activeAccountId])

  const handleEditPress = useCallback((account: Account) => {
    setEditingAccount(account)
    setEditName(account.name)
    setEditError(null)
    setEditModalVisible(true)
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditModalVisible(false)
    setEditingAccount(null)
    setEditName('')
    setEditError(null)
  }, [])

  const validateName = (name: string): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return 'Name is required'
    if (trimmed.length > 50) return 'Name must be 50 characters or less'
    return null
  }

  const handleEditSave = useCallback(async () => {
    if (!editingAccount) return

    const validationError = validateName(editName)
    if (validationError) {
      setEditError(validationError)
      return
    }

    setIsSaving(true)
    setEditError(null)

    const success = await useAccountsStore.getState().updateAccount(editingAccount.id, editName.trim())

    setIsSaving(false)

    if (success) {
      useToastStore.getState().success('Account updated')
      handleEditCancel()
    } else {
      const errorMsg = useAccountsStore.getState().error
      setEditError(errorMsg || 'Failed to update account')
    }
  }, [editingAccount, editName, handleEditCancel])

  const handleDeletePress = useCallback((account: Account) => {
    if (account.id === activeAccountId) {
      Alert.alert(
        'Cannot Delete',
        'This is your active account. Switch to another account before deleting.',
        [{ text: 'OK' }]
      )
      return
    }

    if (accounts.length <= 1) {
      Alert.alert(
        'Cannot Delete',
        'You cannot delete your only account.',
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete "${account.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await useAccountsStore.getState().deleteAccount(account.id)
            if (success) {
              useToastStore.getState().success('Account deleted')
            } else {
              const errorMsg = useAccountsStore.getState().error
              useToastStore.getState().error(errorMsg || 'Failed to delete account')
            }
          },
        },
      ]
    )
  }, [activeAccountId, accounts.length])

  const renderAccountItem = useCallback(({ item }: { item: Account }) => {
    const isActive = item.id === activeAccountId
    const currency = item.preferredCurrency || 'USD'

    return (
      <Pressable
        style={[styles.accountCard, isActive && styles.accountCardActive]}
        onPress={() => handleSwitchAccount(item.id)}
        testID={`accounts.account.${item.id}`}
      >
        <View style={styles.accountHeader}>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{item.name}</Text>
            <View style={[styles.typeBadge, item.type === 'SHARED' && styles.typeBadgeShared]}>
              <Text style={styles.typeBadgeText}>{item.type}</Text>
            </View>
          </View>
          {isActive && (
            <View style={styles.activeIndicator} testID={`accounts.active.${item.id}`}>
              <Text style={styles.activeIndicatorText}>Active</Text>
            </View>
          )}
        </View>

        <Text style={[styles.balance, item.balance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
          {formatCurrency(item.balance, currency)}
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleEditPress(item)}
            testID={`accounts.edit.${item.id}`}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.actionButtonDelete]}
            onPress={() => handleDeletePress(item)}
            disabled={isActive || accounts.length <= 1}
            testID={`accounts.delete.${item.id}`}
          >
            <Text style={[
              styles.actionButtonText,
              styles.actionButtonDeleteText,
              (isActive || accounts.length <= 1) && styles.actionButtonDisabledText
            ]}>
              Delete
            </Text>
          </Pressable>
        </View>
      </Pressable>
    )
  }, [activeAccountId, accounts.length, handleSwitchAccount, handleEditPress, handleDeletePress])

  const renderEmpty = useCallback(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No accounts found</Text>
      </View>
    )
  }, [isLoading])

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="accounts.screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton} testID="accounts.closeButton">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.title}>Accounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer} testID="accounts.error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && accounts.length === 0 ? (
        <View style={styles.loadingContainer} testID="accounts.loading">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading accounts...</Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(item) => item.id}
          renderItem={renderAccountItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          testID="accounts.list"
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleEditCancel}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalBackdrop} onPress={handleEditCancel} />
          <View style={styles.modalContent} testID="accounts.editModal">
            <Text style={styles.modalTitle}>Edit Account</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Account Name</Text>
              <TextInput
                style={[styles.input, editError && styles.inputError]}
                value={editName}
                onChangeText={(text) => {
                  setEditName(text)
                  setEditError(null)
                }}
                placeholder="Enter account name"
                placeholderTextColor="#64748b"
                maxLength={50}
                autoFocus
                testID="accounts.editModal.nameInput"
              />
              {editError && <Text style={styles.fieldError}>{editError}</Text>}
              <Text style={styles.charCount}>{editName.length}/50</Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleEditCancel}
                disabled={isSaving}
                testID="accounts.editModal.cancelButton"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                onPress={handleEditSave}
                disabled={isSaving}
                testID="accounts.editModal.saveButton"
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  closeText: {
    fontSize: 16,
    color: '#38bdf8',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  errorContainer: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 12,
  },
  listContent: {
    padding: 24,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
  accountCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accountCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  typeBadge: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeShared: {
    backgroundColor: 'rgba(168,85,247,0.2)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#38bdf8',
    textTransform: 'uppercase',
  },
  activeIndicator: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  balance: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  balancePositive: {
    color: '#22c55e',
  },
  balanceNegative: {
    color: '#ef4444',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonDelete: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  actionButtonDeleteText: {
    color: '#ef4444',
  },
  actionButtonDisabledText: {
    opacity: 0.4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  charCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#38bdf8',
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
})
