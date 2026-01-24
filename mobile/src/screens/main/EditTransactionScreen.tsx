import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppStackScreenProps } from '../../navigation/types';
import {
  useAccountsStore,
  useTransactionsStore,
  useCategoriesStore,
  type TransactionType,
  type Category,
} from '../../stores';
import { formatCurrency } from '../../utils/format';
import {
  validateTransactionAmount,
  validateTransactionDescription,
  validateTransactionCategory,
  validateTransactionDate,
} from '../../lib/validation';
import type { Currency } from '../../types';

type FormErrors = {
  amount?: string;
  description?: string;
  categoryId?: string;
  date?: string;
  general?: string;
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  ILS: '\u20AA',
};

function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

function isToday(d: Date): boolean {
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

function isYesterday(d: Date): boolean {
  const yesterday = getYesterday();
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateToLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISODate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function EditTransactionScreen({
  navigation,
  route,
}: AppStackScreenProps<'EditTransaction'>) {
  const { transactionId } = route.params;

  // Use individual selectors to prevent infinite re-render loops
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const transactions = useTransactionsStore((state) => state.transactions);
  const updateTransaction = useTransactionsStore((state) => state.updateTransaction);
  const deleteTransaction = useTransactionsStore((state) => state.deleteTransaction);
  const categories = useCategoriesStore((state) => state.categories);
  const categoriesLoading = useCategoriesStore((state) => state.isLoading);
  const fetchCategories = useCategoriesStore((state) => state.fetchCategories);

  const transaction = useMemo(
    () => transactions.find((t) => t.id === transactionId),
    [transactions, transactionId]
  );

  const selectedAccount = accounts.find((a) => a.id === activeAccountId);
  const currency: Currency = selectedAccount?.preferredCurrency || 'USD';

  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (transaction && !isInitialized) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setDescription(transaction.description || '');
      setCategoryId(transaction.categoryId);
      setDate(parseISODate(transaction.date));
      setIsInitialized(true);
    } else if (!transaction && !isInitialized) {
      // Set initialized after a brief delay if transaction not found
      const timer = setTimeout(() => setIsInitialized(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [transaction, isInitialized]);

  useEffect(() => {
    fetchCategories(type);
  }, [fetchCategories, type]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === type && !c.isArchived);
  }, [categories, type]);

  const handleTypeChange = useCallback((newType: TransactionType) => {
    setType(newType);
    setCategoryId(null);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, []);

  const handleAmountChange = useCallback((text: string) => {
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return;
    }
    if (parts[1] && parts[1].length > 2) {
      return;
    }
    setAmount(sanitized);
    setErrors((prev) => ({ ...prev, amount: undefined }));
  }, []);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    setErrors((prev) => ({ ...prev, description: undefined }));
  }, []);

  const handleCategorySelect = useCallback((id: string) => {
    setCategoryId(id);
    setErrors((prev) => ({ ...prev, categoryId: undefined }));
  }, []);

  const handleDateSelect = useCallback((selectedDate: Date) => {
    setDate(selectedDate);
    setShowDatePicker(false);
    setErrors((prev) => ({ ...prev, date: undefined }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const amountError = validateTransactionAmount(amount);
    if (amountError) {
      newErrors.amount = amountError;
    }

    const descriptionError = validateTransactionDescription(description);
    if (descriptionError) {
      newErrors.description = descriptionError;
    }

    const categoryError = validateTransactionCategory(categoryId);
    if (categoryError) {
      newErrors.categoryId = categoryError;
    }

    const dateError = validateTransactionDate(date);
    if (dateError) {
      newErrors.date = dateError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [amount, description, categoryId, date]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      return;
    }

    if (!activeAccountId) {
      setErrors((prev) => ({ ...prev, general: 'No account selected' }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await updateTransaction({
        id: transactionId,
        categoryId: categoryId!,
        type,
        amount: parseFloat(amount),
        currency,
        date: formatDateToLocalISO(date),
        description: description.trim(),
      });

      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update transaction';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    activeAccountId,
    transactionId,
    categoryId,
    type,
    amount,
    currency,
    date,
    description,
    updateTransaction,
    navigation,
  ]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteTransaction(transactionId);
              navigation.goBack();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : 'Failed to delete transaction';
              Alert.alert('Error', message);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [deleteTransaction, transactionId, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderCategoryItem = useCallback(
    (category: Category) => {
      const isSelected = categoryId === category.id;
      return (
        <Pressable
          key={category.id}
          style={[
            styles.categoryChip,
            isSelected && styles.categoryChipSelected,
            { borderColor: category.color },
          ]}
          onPress={() => handleCategorySelect(category.id)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${category.name} category`}
          accessibilityState={{ selected: isSelected }}
        >
          <View
            style={[styles.categoryDot, { backgroundColor: category.color }]}
          />
          <Text
            style={[
              styles.categoryChipText,
              isSelected && styles.categoryChipTextSelected,
            ]}
          >
            {category.name}
          </Text>
        </Pressable>
      );
    },
    [categoryId, handleCategorySelect]
  );

  if (!transaction && !isInitialized) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading transaction...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorTitle}>Transaction Not Found</Text>
          <Text style={styles.errorText}>
            The transaction you&apos;re looking for doesn&apos;t exist or has been deleted.
          </Text>
          <Pressable style={styles.backButton} onPress={handleCancel}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="editTransaction.screen">
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.cancelButton}
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="editTransaction.cancelButton"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Edit Transaction</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[
                  styles.typeButton,
                  type === 'EXPENSE' && styles.typeButtonExpenseActive,
                ]}
                onPress={() => handleTypeChange('EXPENSE')}
                accessibilityRole="button"
                accessibilityLabel="Expense"
                accessibilityState={{ selected: type === 'EXPENSE' }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'EXPENSE' && styles.typeButtonTextActive,
                  ]}
                >
                  Expense
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeButton,
                  type === 'INCOME' && styles.typeButtonIncomeActive,
                ]}
                onPress={() => handleTypeChange('INCOME')}
                accessibilityRole="button"
                accessibilityLabel="Income"
                accessibilityState={{ selected: type === 'INCOME' }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'INCOME' && styles.typeButtonTextActive,
                  ]}
                >
                  Income
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Amount</Text>
            <View
              style={[styles.inputContainer, errors.amount && styles.inputError]}
            >
              <Text style={styles.currencySymbol}>
                {CURRENCY_SYMBOLS[currency]}
              </Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
                accessibilityLabel="Amount"
                accessibilityHint="Enter the transaction amount"
                testID="amount-input"
              />
            </View>
            {errors.amount && (
              <Text style={styles.errorText}>{errors.amount}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            {categoriesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            ) : filteredCategories.length === 0 ? (
              <Text style={styles.emptyText}>
                No categories available for this type
              </Text>
            ) : (
              <View style={styles.categoriesGrid}>
                {filteredCategories.map(renderCategoryItem)}
              </View>
            )}
            {errors.categoryId && (
              <Text style={styles.errorText}>{errors.categoryId}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date</Text>
            <View style={styles.dateRow}>
              <Pressable
                style={[
                  styles.dateChip,
                  isToday(date) && styles.dateChipActive,
                ]}
                onPress={() => handleDateSelect(new Date())}
                accessibilityRole="button"
                accessibilityLabel="Today"
                accessibilityState={{ selected: isToday(date) }}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    isToday(date) && styles.dateChipTextActive,
                  ]}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dateChip,
                  isYesterday(date) && styles.dateChipActive,
                ]}
                onPress={() => handleDateSelect(getYesterday())}
                accessibilityRole="button"
                accessibilityLabel="Yesterday"
                accessibilityState={{ selected: isYesterday(date) }}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    isYesterday(date) && styles.dateChipTextActive,
                  ]}
                >
                  Yesterday
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.dateChip,
                  !isToday(date) && !isYesterday(date) && styles.dateChipActive,
                ]}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Select custom date"
              >
                <Text
                  style={[
                    styles.dateChipText,
                    !isToday(date) && !isYesterday(date) && styles.dateChipTextActive,
                  ]}
                >
                  {!isToday(date) && !isYesterday(date)
                    ? formatDateDisplay(date)
                    : 'Other'}
                </Text>
              </Pressable>
            </View>
            {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
          </View>

          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowDatePicker(false)}
            >
              <View
                style={styles.datePickerModal}
                onStartShouldSetResponder={() => true}
              >
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <View style={styles.datePickerContent}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    return (
                      <Pressable
                        key={i}
                        style={[
                          styles.datePickerOption,
                          date.toDateString() === d.toDateString() &&
                            styles.datePickerOptionActive,
                        ]}
                        onPress={() => handleDateSelect(d)}
                      >
                        <Text
                          style={[
                            styles.datePickerOptionText,
                            date.toDateString() === d.toDateString() &&
                              styles.datePickerOptionTextActive,
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
                    );
                  })}
                </View>
                <Pressable
                  style={styles.datePickerClose}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerCloseText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={[
                styles.descriptionInput,
                errors.description && styles.inputError,
              ]}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="Enter a description"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              maxLength={200}
              accessibilityLabel="Description"
              accessibilityHint="Optional description for the transaction"
              testID="editTransaction.descriptionInput"
            />
            {errors.description && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>

          {amount && categoryId && (
            <View style={styles.previewSection}>
              <Text style={styles.sectionLabel}>Preview</Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewType}>
                  {type === 'EXPENSE' ? 'Expense' : 'Income'}
                </Text>
                <Text
                  style={[
                    styles.previewAmount,
                    type === 'EXPENSE'
                      ? styles.expenseAmount
                      : styles.incomeAmount,
                  ]}
                >
                  {type === 'EXPENSE' ? '-' : '+'}
                  {formatCurrency(parseFloat(amount) || 0, currency)}
                </Text>
                <Text style={styles.previewCategory}>
                  {filteredCategories.find((c) => c.id === categoryId)?.name}
                </Text>
                {description.trim() && (
                  <Text style={styles.previewDescription}>
                    {description.trim()}
                  </Text>
                )}
              </View>
            </View>
          )}

          {errors.general && (
            <View style={styles.generalErrorContainer}>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          )}

          <View style={styles.deleteSection}>
            <Pressable
              style={[
                styles.deleteButton,
                isDeleting && styles.deleteButtonDisabled,
              ]}
              onPress={handleDelete}
              disabled={isDeleting || isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Delete transaction"
              accessibilityState={{ disabled: isDeleting || isSubmitting }}
              testID="editTransaction.deleteButton"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete Transaction</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitButton,
              (isSubmitting || isDeleting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || isDeleting}
            accessibilityRole="button"
            accessibilityLabel="Update transaction"
            accessibilityState={{ disabled: isSubmitting || isDeleting }}
            testID="editTransaction.saveButton"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0f172a" />
            ) : (
              <Text style={styles.submitButtonText}>Update Transaction</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
  backButton: {
    marginTop: 20,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
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
  deleteSection: {
    marginBottom: 24,
  },
  deleteButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
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
});
