import React, { useEffect, useCallback, useReducer } from 'react'
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
  RefreshControl,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { AppStackScreenProps } from '../../navigation/types'
import { useAccountsStore, useToastStore, type Account, type DbAccountType } from '../../stores'
import { formatCurrency } from '../../utils/format'
import { validateAccountName } from '../../utils/validation'
import type { Currency } from '../../types'

const ACCOUNT_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
]

const ACCOUNT_TYPES: { value: DbAccountType; label: string }[] = [
  { value: 'SELF', label: 'Personal' },
  { value: 'PARTNER', label: 'Partner' },
  { value: 'OTHER', label: 'Other' },
]

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'ILS', label: 'ILS' },
]

interface CreateModalState {
  visible: boolean
  name: string
  type: DbAccountType
  color: string | null
  preferredCurrency: Currency | null
  error: string | null
  isSubmitting: boolean
}

type CreateModalAction =
  | { type: 'OPEN' }
  | { type: 'CLOSE' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_TYPE'; payload: DbAccountType }
  | { type: 'SET_COLOR'; payload: string | null }
  | { type: 'SET_CURRENCY'; payload: Currency | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: boolean }

const createInitialState: CreateModalState = {
  visible: false,
  name: '',
  type: 'SELF',
  color: ACCOUNT_COLORS[0],
  preferredCurrency: null,
  error: null,
  isSubmitting: false,
}

function createReducer(state: CreateModalState, action: CreateModalAction): CreateModalState {
  switch (action.type) {
    case 'OPEN':
      return { ...createInitialState, visible: true }
    case 'CLOSE':
      return { ...state, visible: false }
    case 'SET_NAME':
      return { ...state, name: action.payload, error: null }
    case 'SET_TYPE':
      return { ...state, type: action.payload }
    case 'SET_COLOR':
      return { ...state, color: action.payload }
    case 'SET_CURRENCY':
      return { ...state, preferredCurrency: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload }
    default:
      return state
  }
}

interface EditModalState {
  visible: boolean
  account: Account | null
  name: string
  type: DbAccountType
  color: string | null
  preferredCurrency: Currency | null
  error: string | null
  isSubmitting: boolean
}

type EditModalAction =
  | { type: 'OPEN'; payload: { account: Account } }
  | { type: 'CLOSE' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_TYPE'; payload: DbAccountType }
  | { type: 'SET_COLOR'; payload: string | null }
  | { type: 'SET_CURRENCY'; payload: Currency | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: boolean }

const editInitialState: EditModalState = {
  visible: false,
  account: null,
  name: '',
  type: 'SELF',
  color: null,
  preferredCurrency: null,
  error: null,
  isSubmitting: false,
}

function mapDisplayTypeToDbType(displayType: 'PERSONAL' | 'SHARED', account: Account): DbAccountType {
  if (displayType === 'PERSONAL') return 'SELF'
  return 'PARTNER'
}

function editReducer(state: EditModalState, action: EditModalAction): EditModalState {
  switch (action.type) {
    case 'OPEN':
      return {
        visible: true,
        account: action.payload.account,
        name: action.payload.account.name,
        type: mapDisplayTypeToDbType(action.payload.account.type, action.payload.account),
        color: action.payload.account.color,
        preferredCurrency: action.payload.account.preferredCurrency,
        error: null,
        isSubmitting: false,
      }
    case 'CLOSE':
      return editInitialState
    case 'SET_NAME':
      return { ...state, name: action.payload, error: null }
    case 'SET_TYPE':
      return { ...state, type: action.payload }
    case 'SET_COLOR':
      return { ...state, color: action.payload }
    case 'SET_CURRENCY':
      return { ...state, preferredCurrency: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload }
    default:
      return state
  }
}

export function AccountsScreen({ navigation }: AppStackScreenProps<'Accounts'>) {
  const accounts = useAccountsStore((state) => state.accounts)
  const activeAccountId = useAccountsStore((state) => state.activeAccountId)
  const isLoading = useAccountsStore((state) => state.isLoading)
  const error = useAccountsStore((state) => state.error)

  const [createState, createDispatch] = useReducer(createReducer, createInitialState)
  const [editState, editDispatch] = useReducer(editReducer, editInitialState)

  useEffect(() => {
    useAccountsStore.getState().fetchAccounts()
  }, [])

  const onRefresh = useCallback(() => {
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

  const handleOpenCreate = useCallback(() => {
    createDispatch({ type: 'OPEN' })
  }, [])

  const handleCreateCancel = useCallback(() => {
    createDispatch({ type: 'CLOSE' })
  }, [])

  const handleCreateSave = useCallback(async () => {
    const validation = validateAccountName(createState.name)
    if (!validation.valid) {
      createDispatch({ type: 'SET_ERROR', payload: validation.error || 'Invalid name' })
      return
    }

    createDispatch({ type: 'SET_SUBMITTING', payload: true })

    try {
      const success = await useAccountsStore.getState().createAccount({
        name: createState.name.trim(),
        type: createState.type,
        color: createState.color,
        preferredCurrency: createState.preferredCurrency,
      })

      if (success) {
        useToastStore.getState().success('Account created')
        handleCreateCancel()
      } else {
        const errorMsg = useAccountsStore.getState().error
        createDispatch({ type: 'SET_ERROR', payload: errorMsg || 'Failed to create account' })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create account'
      createDispatch({ type: 'SET_ERROR', payload: errorMsg })
    } finally {
      createDispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [createState.name, createState.type, createState.color, createState.preferredCurrency, handleCreateCancel])

  const handleEditPress = useCallback((account: Account) => {
    editDispatch({ type: 'OPEN', payload: { account } })
  }, [])

  const handleEditCancel = useCallback(() => {
    editDispatch({ type: 'CLOSE' })
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editState.account) return

    const validation = validateAccountName(editState.name)
    if (!validation.valid) {
      editDispatch({ type: 'SET_ERROR', payload: validation.error || 'Invalid name' })
      return
    }

    editDispatch({ type: 'SET_SUBMITTING', payload: true })

    try {
      const success = await useAccountsStore.getState().updateAccount(editState.account.id, {
        name: editState.name.trim(),
        type: editState.type,
        color: editState.color,
        preferredCurrency: editState.preferredCurrency,
      })

      if (success) {
        useToastStore.getState().success('Account updated')
        handleEditCancel()
      } else {
        const errorMsg = useAccountsStore.getState().error
        editDispatch({ type: 'SET_ERROR', payload: errorMsg || 'Failed to update account' })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update account'
      editDispatch({ type: 'SET_ERROR', payload: errorMsg })
    } finally {
      editDispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [editState.account, editState.name, editState.type, editState.color, editState.preferredCurrency, handleEditCancel])

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

  const renderColorPicker = (
    selectedColor: string | null,
    onSelect: (color: string | null) => void,
    testIdPrefix: string,
    showNoColor = false
  ) => {
    return (
      <View style={styles.colorPickerContainer}>
        <Text style={styles.inputLabel}>Color</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPicker}>
          {showNoColor && (
            <Pressable
              style={[styles.colorOption, styles.noColorOption, !selectedColor && styles.colorOptionSelected]}
              onPress={() => onSelect(null)}
              testID={`${testIdPrefix}.color.none`}
            >
              <Text style={styles.noColorText}>X</Text>
            </Pressable>
          )}
          {ACCOUNT_COLORS.map((color) => (
            <Pressable
              key={color}
              style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorOptionSelected]}
              onPress={() => onSelect(color)}
              testID={`${testIdPrefix}.color.${color}`}
            />
          ))}
        </ScrollView>
      </View>
    )
  }

  const renderTypeSelector = (
    selectedType: DbAccountType,
    onSelect: (type: DbAccountType) => void,
    testIdPrefix: string
  ) => {
    return (
      <View style={styles.typeSelectorContainer}>
        <Text style={styles.inputLabel}>Type</Text>
        <View style={styles.typeSelector}>
          {ACCOUNT_TYPES.map((accountType) => (
            <Pressable
              key={accountType.value}
              style={[styles.typeOption, selectedType === accountType.value && styles.typeOptionSelected]}
              onPress={() => onSelect(accountType.value)}
              testID={`${testIdPrefix}.type.${accountType.value}`}
            >
              <Text style={[styles.typeOptionText, selectedType === accountType.value && styles.typeOptionTextSelected]}>
                {accountType.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

  const renderCurrencySelector = (
    selectedCurrency: Currency | null,
    onSelect: (currency: Currency | null) => void,
    testIdPrefix: string
  ) => {
    return (
      <View style={styles.currencySelectorContainer}>
        <Text style={styles.inputLabel}>Preferred Currency (optional)</Text>
        <View style={styles.currencySelector}>
          <Pressable
            style={[styles.currencyOption, !selectedCurrency && styles.currencyOptionSelected]}
            onPress={() => onSelect(null)}
            testID={`${testIdPrefix}.currency.none`}
          >
            <Text style={[styles.currencyOptionText, !selectedCurrency && styles.currencyOptionTextSelected]}>
              None
            </Text>
          </Pressable>
          {CURRENCIES.map((currency) => (
            <Pressable
              key={currency.value}
              style={[styles.currencyOption, selectedCurrency === currency.value && styles.currencyOptionSelected]}
              onPress={() => onSelect(currency.value)}
              testID={`${testIdPrefix}.currency.${currency.value}`}
            >
              <Text style={[styles.currencyOptionText, selectedCurrency === currency.value && styles.currencyOptionTextSelected]}>
                {currency.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    )
  }

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
            {item.color && (
              <View style={[styles.colorIndicator, { backgroundColor: item.color }]} testID={`accounts.colorIndicator.${item.id}`} />
            )}
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
      <View style={styles.emptyContainer} testID="accounts.empty">
        <Text style={styles.emptyText}>No accounts found</Text>
        <Pressable style={styles.emptyButton} onPress={handleOpenCreate} testID="accounts.emptyCreateButton">
          <Text style={styles.emptyButtonText}>Create Account</Text>
        </Pressable>
      </View>
    )
  }, [isLoading, handleOpenCreate])

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="accounts.screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton} testID="accounts.closeButton">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.title}>Accounts</Text>
        <Pressable onPress={handleOpenCreate} style={styles.addButton} testID="accounts.addButton">
          <Text style={styles.addText}>Add</Text>
        </Pressable>
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
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#38bdf8" />}
        />
      )}

      {/* Create Modal */}
      <Modal visible={createState.visible} transparent animationType="fade" onRequestClose={handleCreateCancel}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={handleCreateCancel} />
          <View style={styles.modalContent} testID="accounts.createModal">
            <Text style={styles.modalTitle}>Create Account</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={[styles.input, createState.error && styles.inputError]}
                value={createState.name}
                onChangeText={(text) => createDispatch({ type: 'SET_NAME', payload: text })}
                placeholder="Enter account name"
                placeholderTextColor="#64748b"
                maxLength={50}
                autoFocus
                testID="accounts.createModal.nameInput"
              />
              {createState.error && <Text style={styles.fieldError}>{createState.error}</Text>}
              <Text style={styles.charCount}>{createState.name.length}/50</Text>
            </View>

            {renderTypeSelector(
              createState.type,
              (type) => createDispatch({ type: 'SET_TYPE', payload: type }),
              'accounts.createModal'
            )}

            {renderColorPicker(
              createState.color,
              (color) => createDispatch({ type: 'SET_COLOR', payload: color }),
              'accounts.createModal'
            )}

            {renderCurrencySelector(
              createState.preferredCurrency,
              (currency) => createDispatch({ type: 'SET_CURRENCY', payload: currency }),
              'accounts.createModal'
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleCreateCancel}
                disabled={createState.isSubmitting}
                testID="accounts.createModal.cancelButton"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, createState.isSubmitting && styles.modalSaveButtonDisabled]}
                onPress={handleCreateSave}
                disabled={createState.isSubmitting}
                testID="accounts.createModal.saveButton"
              >
                {createState.isSubmitting ? (
                  <ActivityIndicator size="small" color="#0f172a" />
                ) : (
                  <Text style={styles.modalSaveText}>Create</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editState.visible} transparent animationType="fade" onRequestClose={handleEditCancel}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={handleEditCancel} />
          <View style={styles.modalContent} testID="accounts.editModal">
            <Text style={styles.modalTitle}>Edit Account</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={[styles.input, editState.error && styles.inputError]}
                value={editState.name}
                onChangeText={(text) => editDispatch({ type: 'SET_NAME', payload: text })}
                placeholder="Enter account name"
                placeholderTextColor="#64748b"
                maxLength={50}
                autoFocus
                testID="accounts.editModal.nameInput"
              />
              {editState.error && <Text style={styles.fieldError}>{editState.error}</Text>}
              <Text style={styles.charCount}>{editState.name.length}/50</Text>
            </View>

            {renderTypeSelector(
              editState.type,
              (type) => editDispatch({ type: 'SET_TYPE', payload: type }),
              'accounts.editModal'
            )}

            {renderColorPicker(
              editState.color,
              (color) => editDispatch({ type: 'SET_COLOR', payload: color }),
              'accounts.editModal',
              true
            )}

            {renderCurrencySelector(
              editState.preferredCurrency,
              (currency) => editDispatch({ type: 'SET_CURRENCY', payload: currency }),
              'accounts.editModal'
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleEditCancel}
                disabled={editState.isSubmitting}
                testID="accounts.editModal.cancelButton"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, editState.isSubmitting && styles.modalSaveButtonDisabled]}
                onPress={handleEditSave}
                disabled={editState.isSubmitting}
                testID="accounts.editModal.saveButton"
              >
                {editState.isSubmitting ? (
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
  addButton: {
    paddingVertical: 8,
    paddingLeft: 16,
  },
  addText: {
    fontSize: 16,
    color: '#38bdf8',
    fontWeight: '500',
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
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
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
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 16,
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
  typeSelectorContainer: {
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  typeOptionSelected: {
    backgroundColor: '#38bdf8',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  typeOptionTextSelected: {
    color: '#0f172a',
  },
  colorPickerContainer: {
    marginBottom: 16,
  },
  colorPicker: {
    flexDirection: 'row',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
  },
  noColorOption: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noColorText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  currencySelectorContainer: {
    marginBottom: 20,
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  currencyOptionSelected: {
    backgroundColor: '#38bdf8',
  },
  currencyOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  currencyOptionTextSelected: {
    color: '#0f172a',
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
