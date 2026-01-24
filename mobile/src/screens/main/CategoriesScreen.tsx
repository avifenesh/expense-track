import React, { useEffect, useState, useCallback, useReducer } from 'react'
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
import { useCategoriesStore, useToastStore, type Category, type TransactionType } from '../../stores'
import { validateCategoryName } from '../../utils/validation'

const EXPENSE_COLORS = [
  '#22c55e',
  '#f97316',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#ef4444',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
]

const INCOME_COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#6b7280']

type TabType = 'EXPENSE' | 'INCOME'

interface CreateModalState {
  visible: boolean
  name: string
  color: string
  type: TransactionType
  error: string | null
  isSubmitting: boolean
}

type CreateModalAction =
  | { type: 'OPEN'; payload: { type: TransactionType; color: string } }
  | { type: 'CLOSE' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_COLOR'; payload: string }
  | { type: 'SET_TYPE'; payload: { type: TransactionType; color: string } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: boolean }

const createInitialState: CreateModalState = {
  visible: false,
  name: '',
  color: EXPENSE_COLORS[0],
  type: 'EXPENSE',
  error: null,
  isSubmitting: false,
}

function createReducer(state: CreateModalState, action: CreateModalAction): CreateModalState {
  switch (action.type) {
    case 'OPEN':
      return { ...createInitialState, visible: true, type: action.payload.type, color: action.payload.color }
    case 'CLOSE':
      return { ...state, visible: false }
    case 'SET_NAME':
      return { ...state, name: action.payload, error: null }
    case 'SET_COLOR':
      return { ...state, color: action.payload }
    case 'SET_TYPE':
      return { ...state, type: action.payload.type, color: action.payload.color }
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
  category: Category | null
  name: string
  color: string | null
  error: string | null
  isSubmitting: boolean
}

type EditModalAction =
  | { type: 'OPEN'; payload: { category: Category } }
  | { type: 'CLOSE' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_COLOR'; payload: string | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBMITTING'; payload: boolean }

const editInitialState: EditModalState = {
  visible: false,
  category: null,
  name: '',
  color: null,
  error: null,
  isSubmitting: false,
}

function editReducer(state: EditModalState, action: EditModalAction): EditModalState {
  switch (action.type) {
    case 'OPEN':
      return {
        visible: true,
        category: action.payload.category,
        name: action.payload.category.name,
        color: action.payload.category.color,
        error: null,
        isSubmitting: false,
      }
    case 'CLOSE':
      return editInitialState
    case 'SET_NAME':
      return { ...state, name: action.payload, error: null }
    case 'SET_COLOR':
      return { ...state, color: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload }
    default:
      return state
  }
}

export function CategoriesScreen({ navigation }: AppStackScreenProps<'Categories'>) {
  const categories = useCategoriesStore((state) => state.categories)
  const isLoading = useCategoriesStore((state) => state.isLoading)
  const error = useCategoriesStore((state) => state.error)

  const [activeTab, setActiveTab] = useState<TabType>('EXPENSE')
  const [createState, createDispatch] = useReducer(createReducer, createInitialState)
  const [editState, editDispatch] = useReducer(editReducer, editInitialState)

  useEffect(() => {
    useCategoriesStore.getState().fetchCategories(undefined, true)
  }, [])

  const onRefresh = useCallback(() => {
    useCategoriesStore.getState().fetchCategories(undefined, true)
  }, [])

  const handleClose = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const filteredCategories = categories.filter((c) => c.type === activeTab)

  const getColorPalette = (type: TransactionType) => {
    return type === 'EXPENSE' ? EXPENSE_COLORS : INCOME_COLORS
  }

  const handleOpenCreate = useCallback(() => {
    const color = activeTab === 'EXPENSE' ? EXPENSE_COLORS[0] : INCOME_COLORS[0]
    createDispatch({ type: 'OPEN', payload: { type: activeTab, color } })
  }, [activeTab])

  const handleCreateCancel = useCallback(() => {
    createDispatch({ type: 'CLOSE' })
  }, [])

  const handleCreateSave = useCallback(async () => {
    const validation = validateCategoryName(createState.name)
    if (!validation.valid) {
      createDispatch({ type: 'SET_ERROR', payload: validation.error || 'Invalid name' })
      return
    }

    createDispatch({ type: 'SET_SUBMITTING', payload: true })

    try {
      await useCategoriesStore.getState().createCategory({
        name: createState.name.trim(),
        type: createState.type,
        color: createState.color,
      })
      useToastStore.getState().success('Category created')
      handleCreateCancel()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create category'
      createDispatch({ type: 'SET_ERROR', payload: errorMsg })
    } finally {
      createDispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [createState.name, createState.type, createState.color, handleCreateCancel])

  const handleEditPress = useCallback((category: Category) => {
    editDispatch({ type: 'OPEN', payload: { category } })
  }, [])

  const handleEditCancel = useCallback(() => {
    editDispatch({ type: 'CLOSE' })
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editState.category) return

    const validation = validateCategoryName(editState.name)
    if (!validation.valid) {
      editDispatch({ type: 'SET_ERROR', payload: validation.error || 'Invalid name' })
      return
    }

    editDispatch({ type: 'SET_SUBMITTING', payload: true })

    try {
      await useCategoriesStore.getState().updateCategory({
        id: editState.category.id,
        name: editState.name.trim(),
        color: editState.color,
      })
      useToastStore.getState().success('Category updated')
      handleEditCancel()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update category'
      editDispatch({ type: 'SET_ERROR', payload: errorMsg })
    } finally {
      editDispatch({ type: 'SET_SUBMITTING', payload: false })
    }
  }, [editState.category, editState.name, editState.color, handleEditCancel])

  const handleArchivePress = useCallback((category: Category) => {
    const action = category.isArchived ? 'unarchive' : 'archive'
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Category`,
      `Are you sure you want to ${action} "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          onPress: async () => {
            try {
              if (category.isArchived) {
                await useCategoriesStore.getState().unarchiveCategory(category.id)
                useToastStore.getState().success('Category unarchived')
              } else {
                await useCategoriesStore.getState().archiveCategory(category.id)
                useToastStore.getState().success('Category archived')
              }
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : `Failed to ${action} category`
              useToastStore.getState().error(errorMsg)
            }
          },
        },
      ]
    )
  }, [])

  const handleDeletePress = useCallback((category: Category) => {
    if (category.isHolding) {
      Alert.alert(
        'Cannot Delete',
        'Holding categories cannot be deleted. They are required for tracking investment holdings.',
        [{ text: 'OK' }]
      )
      return
    }

    if (category.isArchived) {
      Alert.alert(
        'Already Archived',
        `"${category.name}" is already archived. Use "Unarchive" to restore it.`,
        [{ text: 'OK' }]
      )
      return
    }

    Alert.alert(
      'Archive Category',
      `Are you sure you want to archive "${category.name}"? Archived categories can be restored later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await useCategoriesStore.getState().archiveCategory(category.id)
              useToastStore.getState().success('Category archived')
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Failed to archive category'
              useToastStore.getState().error(errorMsg)
            }
          },
        },
      ]
    )
  }, [])

  const renderCategoryItem = useCallback(
    ({ item }: { item: Category }) => {
      const colorDot = item.color || (item.type === 'EXPENSE' ? EXPENSE_COLORS[0] : INCOME_COLORS[0])

      return (
        <View
          style={[styles.categoryCard, item.isArchived && styles.categoryCardArchived]}
          testID={`categories.category.${item.id}`}
        >
          <View style={styles.categoryHeader}>
            <View style={styles.categoryInfo}>
              <View style={[styles.colorDot, { backgroundColor: colorDot }]} testID={`categories.colorDot.${item.id}`} />
              <Text style={[styles.categoryName, item.isArchived && styles.categoryNameArchived]}>{item.name}</Text>
              {item.isArchived && (
                <View style={styles.archivedBadge} testID={`categories.archived.${item.id}`}>
                  <Text style={styles.archivedBadgeText}>Archived</Text>
                </View>
              )}
              {item.isHolding && (
                <View style={styles.holdingBadge} testID={`categories.holding.${item.id}`}>
                  <Text style={styles.holdingBadgeText}>Holding</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleEditPress(item)}
              testID={`categories.edit.${item.id}`}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleArchivePress(item)}
              testID={`categories.archive.${item.id}`}
            >
              <Text style={styles.actionButtonText}>{item.isArchived ? 'Unarchive' : 'Archive'}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.actionButtonDelete, item.isHolding && styles.actionButtonDisabled]}
              onPress={() => handleDeletePress(item)}
              disabled={item.isHolding}
              testID={`categories.delete.${item.id}`}
            >
              <Text
                style={[styles.actionButtonText, styles.actionButtonDeleteText, item.isHolding && styles.actionButtonDisabledText]}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        </View>
      )
    },
    [handleEditPress, handleArchivePress, handleDeletePress]
  )

  const renderEmpty = useCallback(() => {
    if (isLoading) return null
    return (
      <View style={styles.emptyContainer} testID="categories.empty">
        <Text style={styles.emptyText}>No {activeTab.toLowerCase()} categories</Text>
        <Pressable style={styles.emptyButton} onPress={handleOpenCreate} testID="categories.emptyCreateButton">
          <Text style={styles.emptyButtonText}>Create Category</Text>
        </Pressable>
      </View>
    )
  }, [isLoading, activeTab, handleOpenCreate])

  const renderColorPicker = (
    selectedColor: string | null,
    onSelect: (color: string | null) => void,
    type: TransactionType,
    testIdPrefix: string,
    showNoColor = false
  ) => {
    const palette = getColorPalette(type)
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
              <Text style={styles.noColorText}>✕</Text>
            </Pressable>
          )}
          {palette.map((color) => (
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

  const renderTypeSelector = () => (
    <View style={styles.typeSelectorContainer}>
      <Text style={styles.inputLabel}>Type</Text>
      <View style={styles.typeSelector}>
        <Pressable
          style={[styles.typeOption, createState.type === 'EXPENSE' && styles.typeOptionSelected]}
          onPress={() => createDispatch({ type: 'SET_TYPE', payload: { type: 'EXPENSE', color: EXPENSE_COLORS[0] } })}
          testID="categories.createModal.typeExpense"
        >
          <Text style={[styles.typeOptionText, createState.type === 'EXPENSE' && styles.typeOptionTextSelected]}>Expense</Text>
        </Pressable>
        <Pressable
          style={[styles.typeOption, createState.type === 'INCOME' && styles.typeOptionSelected]}
          onPress={() => createDispatch({ type: 'SET_TYPE', payload: { type: 'INCOME', color: INCOME_COLORS[0] } })}
          testID="categories.createModal.typeIncome"
        >
          <Text style={[styles.typeOptionText, createState.type === 'INCOME' && styles.typeOptionTextSelected]}>Income</Text>
        </Pressable>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="categories.screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton} testID="categories.closeButton">
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.title}>Categories</Text>
        <Pressable onPress={handleOpenCreate} style={styles.addButton} testID="categories.addButton">
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar} testID="categories.tabBar">
        <Pressable
          style={[styles.tab, activeTab === 'EXPENSE' && styles.tabActive]}
          onPress={() => setActiveTab('EXPENSE')}
          testID="categories.tabExpense"
        >
          <Text style={[styles.tabText, activeTab === 'EXPENSE' && styles.tabTextActive]}>EXPENSE</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'INCOME' && styles.tabActive]}
          onPress={() => setActiveTab('INCOME')}
          testID="categories.tabIncome"
        >
          <Text style={[styles.tabText, activeTab === 'INCOME' && styles.tabTextActive]}>INCOME</Text>
        </Pressable>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorContainer} testID="categories.error">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && categories.length === 0 ? (
        <View style={styles.loadingContainer} testID="categories.loading">
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading categories...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCategories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategoryItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          testID="categories.list"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor="#38bdf8" />}
        />
      )}

      {/* Create Modal */}
      <Modal visible={createState.visible} transparent animationType="fade" onRequestClose={handleCreateCancel}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={handleCreateCancel} />
          <View style={styles.modalContent} testID="categories.createModal">
            <Text style={styles.modalTitle}>Create Category</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={[styles.input, createState.error && styles.inputError]}
                value={createState.name}
                onChangeText={(text) => createDispatch({ type: 'SET_NAME', payload: text })}
                placeholder="Enter category name"
                placeholderTextColor="#64748b"
                maxLength={100}
                autoFocus
                testID="categories.createModal.nameInput"
              />
              {createState.error && <Text style={styles.fieldError}>{createState.error}</Text>}
              <Text style={styles.charCount}>{createState.name.length}/100</Text>
            </View>

            {renderTypeSelector()}
            {renderColorPicker(
              createState.color,
              (color) => createDispatch({ type: 'SET_COLOR', payload: color }),
              createState.type,
              'categories.createModal'
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleCreateCancel}
                disabled={createState.isSubmitting}
                testID="categories.createModal.cancelButton"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, createState.isSubmitting && styles.modalSaveButtonDisabled]}
                onPress={handleCreateSave}
                disabled={createState.isSubmitting}
                testID="categories.createModal.saveButton"
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
          <View style={styles.modalContent} testID="categories.editModal">
            <Text style={styles.modalTitle}>Edit Category</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={[styles.input, editState.error && styles.inputError]}
                value={editState.name}
                onChangeText={(text) => editDispatch({ type: 'SET_NAME', payload: text })}
                placeholder="Enter category name"
                placeholderTextColor="#64748b"
                maxLength={100}
                autoFocus
                testID="categories.editModal.nameInput"
              />
              {editState.error && <Text style={styles.fieldError}>{editState.error}</Text>}
              <Text style={styles.charCount}>{editState.name.length}/100</Text>
            </View>

            {editState.category &&
              renderColorPicker(
                editState.color,
                (color) => editDispatch({ type: 'SET_COLOR', payload: color }),
                editState.category.type,
                'categories.editModal',
                true
              )}

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={handleEditCancel}
                disabled={editState.isSubmitting}
                testID="categories.editModal.cancelButton"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveButton, editState.isSubmitting && styles.modalSaveButtonDisabled]}
                onPress={handleEditSave}
                disabled={editState.isSubmitting}
                testID="categories.editModal.saveButton"
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabActive: {
    backgroundColor: '#38bdf8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0f172a',
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
  categoryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  categoryCardArchived: {
    opacity: 0.6,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  categoryNameArchived: {
    color: '#94a3b8',
  },
  archivedBadge: {
    backgroundColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  archivedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  holdingBadge: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  holdingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#a855f7',
    textTransform: 'uppercase',
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
  actionButtonDisabled: {
    opacity: 0.4,
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
    gap: 12,
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
    marginBottom: 20,
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
