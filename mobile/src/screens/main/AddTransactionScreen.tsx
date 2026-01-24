import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { AppStackScreenProps } from '../../navigation/types'
import {
  useAccountsStore,
  useTransactionsStore,
  useCategoriesStore,
  useToastStore,
  type TransactionType,
  type Category,
} from '../../stores'
import { formatCurrency } from '../../utils/format'
import {
  validateTransactionAmount,
  validateTransactionDescription,
  validateTransactionCategory,
  validateTransactionDate,
} from '../../lib/validation'
import type { Currency } from '../../types'

type FormErrors = {
  amount?: string
  description?: string
  categoryId?: string
  date?: string
  general?: string
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  ILS: '₪',
}

function getYesterday(): Date {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday
}

function isToday(d: Date): boolean {
  const today = new Date()
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
}

function isYesterday(d: Date): boolean {
  const yesterday = getYesterday()
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateToLocalISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function AddTransactionScreen({ navigation }: AppStackScreenProps<'CreateTransaction'>) {
  // Select only STATE values, not functions, to prevent re-render loops
  // Functions are accessed via getState() within callbacks to avoid subscription issues
  const accounts = useAccountsStore((state) => state.accounts)
  const activeAccountId = useAccountsStore((state) => state.activeAccountId)
  const categories = useCategoriesStore((state) => state.categories)
  const categoriesLoading = useCategoriesStore((state) => state.isLoading)

  const selectedAccount = accounts.find((a) => a.id === activeAccountId)
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD'

  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Fetch categories when type changes
  useEffect(() => {
    useCategoriesStore.getState().fetchCategories(type)
  }, [type])

  useEffect(() => {
    setCategoryId(null)
    setErrors((prev) => ({ ...prev, categoryId: undefined }))
  }, [type])

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type && !c.isArchived)
  }, [categories, type])

  const handleTypeChange = useCallback((newType: TransactionType) => {
    setType(newType)
  }, [])

  const handleAmountChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, '')
    const parts = sanitized.split('.')
    if (parts.length > 2) {
      return
    }
    if (parts[1] && parts[1].length > 2) {
      return
    }
    setAmount(sanitized)
    setErrors((prev) => ({ ...prev, amount: undefined }))
  }, [])

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text)
    setErrors((prev) => ({ ...prev, description: undefined }))
  }, [])

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id)
    setErrors((prev) => ({ ...prev, categoryId: undefined }))
  }, [])

  const handleDateSelect = useCallback((selectedDate: Date) => {
    setDate(selectedDate)
    setShowDatePicker(false)
    setErrors((prev) => ({ ...prev, date: undefined }))
  }, [])

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    const amountError = validateTransactionAmount(amount)
    if (amountError) {
      newErrors.amount = amountError
    }

    const descriptionError = validateTransactionDescription(description)
    if (descriptionError) {
      newErrors.description = descriptionError
    }

    const categoryError = validateTransactionCategory(categoryId)
    if (categoryError) {
      newErrors.categoryId = categoryError
    }

    const dateError = validateTransactionDate(date)
    if (dateError) {
      newErrors.date = dateError
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [amount, description, categoryId, date])

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    if (!activeAccountId) {
      setErrors((prev) => ({ ...prev, general: 'No account selected' }))
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      await useTransactionsStore.getState().createTransaction({
        accountId: activeAccountId,
        categoryId: categoryId!,
        type,
        amount: parseFloat(amount),
        currency,
        date: formatDateToLocalISO(date),
        description: description.trim() || undefined,
        isRecurring: false,
      })

      useToastStore.getState().success('Transaction created')
      navigation.goBack()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create transaction'
      useToastStore.getState().error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [validateForm, activeAccountId, categoryId, type, amount, currency, date, description, navigation])

  const handleCancel = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const renderCategoryItem = useCallback(
    (category: Category) => {
      const isSelected = categoryId === category.id
      return (
        <Pressable
          key={category.id}
          style={[styles.categoryChip, isSelected && styles.categoryChipSelected, { borderColor: category.color }]}
          onPress={() => handleCategorySelect(category.id)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${category.name} category`}
          accessibilityState={{ selected: isSelected }}
          testID={`addTransaction.category.${category.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
        >
          <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
          <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>{category.name}</Text>
        </Pressable>
      )
    },
    [categoryId, handleCategorySelect],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="addTransaction.screen">
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header} testID="addTransaction.header">
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="addTransaction.cancelButton"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} testID="addTransaction.title">
            Add Transaction
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          testID="addTransaction.scrollView"
        >
          {/* Type Selector */}
          <View style={styles.section} testID="addTransaction.typeSection">
            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeButton, type === 'EXPENSE' && styles.typeButtonExpenseActive]}
                onPress={() => handleTypeChange('EXPENSE')}
                accessibilityRole="button"
                accessibilityLabel="Expense"
                accessibilityState={{ selected: type === 'EXPENSE' }}
                testID="addTransaction.type.expense"
              >
                <Text style={[styles.typeButtonText, type === 'EXPENSE' && styles.typeButtonTextActive]}>Expense</Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, type === 'INCOME' && styles.typeButtonIncomeActive]}
                onPress={() => handleTypeChange('INCOME')}
                accessibilityRole="button"
                accessibilityLabel="Income"
                accessibilityState={{ selected: type === 'INCOME' }}
                testID="addTransaction.type.income"
              >
                <Text style={[styles.typeButtonText, type === 'INCOME' && styles.typeButtonTextActive]}>Income</Text>
              </Pressable>
            </View>
          </View>

          {/* Amount Input */}
          <View style={styles.section} testID="addTransaction.amountSection">
            <Text style={styles.sectionLabel}>Amount</Text>
            <View style={[styles.inputContainer, errors.amount && styles.inputError]}>
              <Text style={styles.currencySymbol}>{CURRENCY_SYMBOLS[currency]}</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                accessibilityLabel="Amount"
                accessibilityHint="Enter the transaction amount"
                testID="addTransaction.amountInput"
              />
            </View>
            {errors.amount && (
              <Text style={styles.errorText} testID="addTransaction.amountError">
                {errors.amount}
              </Text>
            )}
          </View>

          {/* Category Selector */}
          <View style={styles.section} testID="addTransaction.categorySection">
            <Text style={styles.sectionLabel}>Category</Text>
            {categoriesLoading ? (
              <View style={styles.loadingContainer} testID="addTransaction.categoryLoading">
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            ) : filteredCategories.length === 0 ? (
              <Text style={styles.emptyText} testID="addTransaction.categoryEmpty">
                No categories available for this type
              </Text>
            ) : (
              <View style={styles.categoriesGrid} testID="addTransaction.categoryGrid">
                {filteredCategories.map(renderCategoryItem)}
              </View>
            )}
            {errors.categoryId && (
              <Text style={styles.errorText} testID="addTransaction.categoryError">
                {errors.categoryId}
              </Text>
            )}
          </View>

          {/* Date Selector */}
          <View style={styles.section} testID="addTransaction.dateSection">
            <Text style={styles.sectionLabel}>Date</Text>
            <View style={styles.dateRow}>
              <Pressable
                style={[styles.dateChip, isToday(date) && styles.dateChipActive]}
                onPress={() => handleDateSelect(new Date())}
                accessibilityRole="button"
                accessibilityLabel="Today"
                accessibilityState={{ selected: isToday(date) }}
                testID="addTransaction.date.today"
              >
                <Text style={[styles.dateChipText, isToday(date) && styles.dateChipTextActive]}>Today</Text>
              </Pressable>
              <Pressable
                style={[styles.dateChip, isYesterday(date) && styles.dateChipActive]}
                onPress={() => handleDateSelect(getYesterday())}
                accessibilityRole="button"
                accessibilityLabel="Yesterday"
                accessibilityState={{ selected: isYesterday(date) }}
                testID="addTransaction.date.yesterday"
              >
                <Text style={[styles.dateChipText, isYesterday(date) && styles.dateChipTextActive]}>Yesterday</Text>
              </Pressable>
              <Pressable
                style={[styles.dateChip, !isToday(date) && !isYesterday(date) && styles.dateChipActive]}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Select custom date"
                testID="addTransaction.date.other"
              >
                <Text style={[styles.dateChipText, !isToday(date) && !isYesterday(date) && styles.dateChipTextActive]}>
                  {!isToday(date) && !isYesterday(date) ? formatDateDisplay(date) : 'Other'}
                </Text>
              </Pressable>
            </View>
            {errors.date && (
              <Text style={styles.errorText} testID="addTransaction.dateError">
                {errors.date}
              </Text>
            )}
          </View>

          {/* Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
              <View style={styles.datePickerModal} onStartShouldSetResponder={() => true}>
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <View style={styles.datePickerContent}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date()
                    d.setDate(d.getDate() - i)
                    return (
                      <Pressable
                        key={i}
                        style={[
                          styles.datePickerOption,
                          date.toDateString() === d.toDateString() && styles.datePickerOptionActive,
                        ]}
                        onPress={() => handleDateSelect(d)}
                      >
                        <Text
                          style={[
                            styles.datePickerOptionText,
                            date.toDateString() === d.toDateString() && styles.datePickerOptionTextActive,
                          ]}
                        >
                          {i === 0
                            ? 'Today'
                            : i === 1
                              ? 'Yesterday'
                              : d.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
                <Pressable style={styles.datePickerClose} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.datePickerCloseText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>

          {/* Description Input */}
          <View style={styles.section} testID="addTransaction.descriptionSection">
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.descriptionInput, errors.description && styles.inputError]}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Enter a description"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              maxLength={200}
              accessibilityLabel="Description"
              accessibilityHint="Optional description for the transaction"
              testID="addTransaction.descriptionInput"
            />
            {errors.description && (
              <Text style={styles.errorText} testID="addTransaction.descriptionError">
                {errors.description}
              </Text>
            )}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {/* Preview */}
          {amount && categoryId && (
            <View style={styles.previewSection}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewType}>{type === 'EXPENSE' ? 'Expense' : 'Income'}</Text>
                <Text style={[styles.previewAmount, type === 'EXPENSE' ? styles.expenseAmount : styles.incomeAmount]}>
                  {type === 'EXPENSE' ? '-' : '+'}
                  {formatCurrency(parseFloat(amount) || 0, currency)}
                </Text>
                <Text style={styles.previewCategory}>{filteredCategories.find((c) => c.id === categoryId)?.name}</Text>
                {description.trim() && <Text style={styles.previewDescription}>{description.trim()}</Text>}
              </View>
            </View>
          )}

          {errors.general && (
            <View style={styles.generalErrorContainer}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer} testID="addTransaction.footer">
          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Save transaction"
            accessibilityState={{ disabled: isSubmitting }}
            testID="addTransaction.submitButton"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0f172a" testID="addTransaction.submitLoading" />
            ) : (
              <Text style={styles.submitButtonText}>Save Transaction</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
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
  cancelButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  cancelButtonText: {
    color: '#38bdf8',
    fontSize: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94a3b8',
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonExpenseActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: '#ef4444',
  },
  typeButtonIncomeActive: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: '#22c55e',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#94a3b8',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
    paddingVertical: 16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateChipActive: {
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderColor: '#38bdf8',
  },
  dateChipText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  dateChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 360,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  datePickerContent: {
    gap: 8,
  },
  datePickerOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  datePickerOptionActive: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  datePickerOptionText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  datePickerOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  datePickerClose: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  datePickerCloseText: {
    fontSize: 16,
    color: '#38bdf8',
  },
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top',
    minHeight: 100,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  charCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
  previewSection: {
    marginBottom: 24,
  },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  previewType: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  previewAmount: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  incomeAmount: {
    color: '#22c55e',
  },
  expenseAmount: {
    color: '#ef4444',
  },
  previewCategory: {
    fontSize: 16,
    color: '#fff',
  },
  previewDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  generalErrorContainer: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  generalErrorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  submitButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
})
